# Comprehensive Engineering Guide: RAG + Agent Memory Architecture

In enterprise AI engineering, **Retrieval-Augmented Generation (RAG)** and **Agent Memory** solve two distinct fundamental limitations of Large Language Models (LLMs):

1. **RAG solves the Knowledge Boundary Problem** (Static parametric weights vs. dynamic, enterprise-specific unstructured domain data).
2. **Memory solves the Context Window & State Persistence Problem** (Finite token context limits vs. unbounded multi-turn conversation sessions).

Below is the deep, step-by-step engineering breakdown of how RAG and Agent Memory work together in our production system on **Alibaba Cloud Model Studio, Tablestore, and Function Compute**.

---

```
                                  USER QUERY
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │  1. Vector Embedding (1024D) │
                      │  (Model Studio / DashScope)   │
                      └───────────────┬───────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│  2. Tablestore Vector Search  │               │ 3. Agent Memory Fetch         │
│  (KnnVectorQuery + Org Filter)│               │ (agent_memory Table)          │
└───────────────┬───────────────┘               └───────────────┬───────────────┘
                │                                               │
                │ Top-K Semantic Chunks                         │ Prior Summary
                └───────────────────────┬───────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │ 4. Grounded Prompt Assembly   │
                        │ (System + Context + Memory)   │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │ 5. Model Studio LLM Inference │
                        │ (Qwen-Plus Generation)        │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │ 6. Memory State Update &      │
                        │    N-Turn Summarization       │
                        └───────────────────────────────┘
```

---

## Concept 1: Dense Vector Embeddings & Vector Space

Unstructured text (documents, customer support policies, tickets) cannot be compared directly using exact string matching. Instead, text is mapped into a **continuous high-dimensional vector space** $\mathbb{R}^D$ where semantic similarity corresponds to geometric proximity.

### How it works in our system:
* **Embedding Model**: `text-embedding-v4` produces a **1024-dimensional dense floating-point vector** $\mathbf{v} \in \mathbb{R}^{1024}$ for every chunk:
  $$\mathbf{v} = [-0.1035, 0.0069, 0.0132, \dots, -0.0040]$$
* **Normalized Metric Space**: Words or documents with similar semantic meanings (e.g. *"SLA response time"* and *"incident resolution guarantee"*) land near each other in this 1024-dimensional space.
* **Cosine Distance**: Similarity between query vector $\mathbf{q}$ and chunk vector $\mathbf{d}$ is computed via the dot product of normalized vectors:
  $$\text{CosineSimilarity}(\mathbf{q}, \mathbf{d}) = \frac{\mathbf{q} \cdot \mathbf{d}}{\|\mathbf{q}\| \|\mathbf{d}\|}$$

---

## Concept 2: Hierarchical Ingestion, Chunking & Idempotency

Raw documents (PDFs, `.txt` files) are too large to pass directly into an LLM context window. They must be split into digestible chunks without breaking semantic sentences.

### How it works in `lib/alibaba/ingestion.ts`:

1. **Sliding Window Chunking**:
   * **Target Chunk Size**: ~600 tokens ($\approx 2,400$ characters).
   * **Overlap**: 200 characters.
   * **Boundary Search**: The chunker searches backwards for paragraph breaks (`\n\n`), newlines (`\n`), or spaces (` `) to prevent splitting words in half.

2. **Content-Hashed Idempotency**:
   * Event-driven triggers (like OSS `ObjectCreated` or S3 webhooks) have **at-least-once delivery guarantees**, meaning duplicate events WILL happen.
   * We calculate a deterministic SHA-256 hash from the `ossKey` and `eTag`:
     $$\text{DocumentID} = \text{SHA256}(\text{ossKey} + \text{eTag})[0\dots16]$$
   * Before embedding or writing chunks, the ingestion pipeline checks for `marker-{documentId}` in Tablestore. If present, the operation short-circuits instantly (0 duplicate chunks created).

---

## Concept 3: Tablestore Search Index & Multi-Tenant Vector Queries

Traditional vector databases store vectors separately from metadata. **Alibaba Cloud Tablestore** combines structured NoSQL table storage with an integrated **Inverted + Vector Search Index Engine** (`KnnVectorQuery`).

### Table Design in `lib/alibaba/tablestore-client.ts`:

* **Partition Key**: `orgId` (string) — Groups data by tenant.
* **Row Key**: `chunkId` (string) — Unique identifier (`chunk-{docId}-{index}`).
* **Vector Index**: `knowledge_base_vector_idx` on column `embedding` (dimension `1024`, metric `VM_COSINE`).

### Strict Multi-Tenant Boundary Enforcement:
To prevent cross-tenant data leaks in enterprise SaaS, vector search MUST NEVER run unconstrained across all organizations.

Our query wraps the `KnnVectorQuery` inside a strict boolean filter:

```typescript
searchQuery: {
  query: {
    queryType: TableStore.QueryType.KNN_VECTOR_QUERY,
    query: {
      fieldName: "embedding",
      topK: 4,
      float32QueryVector: queryEmbedding,
      // Hard Tenant Isolation Filter
      filter: {
        queryType: TableStore.QueryType.TERM_QUERY,
        query: {
          fieldName: "orgId",
          term: "org-alpha-demo"
        }
      }
    }
  }
}
```

* **Execution Engine**: Tablestore prunes all vectors outside `orgId = "org-alpha-demo"` *before* computing cosine distance. Even if Org B has a document with a $0.99$ similarity score, Org A's query will never see or return it.

---

## Concept 4: Agent Memory Lifecycle & $N$-Turn Summarization

LLM context windows grow linearly with every dialogue turn. If a customer chat reaches 30 turns, re-sending all 30 turns:
1. Exhausts context limits.
2. Increases inference latency and cost exponentially.
3. Causes "Lost-in-the-Middle" context degradation in the LLM.

### State Persistence in `agent_memory` Table:

```typescript
export interface AgentMemoryRow {
  orgId: string;          // Partition key
  conversationId: string; // Row key
  summaryText: string;    // Compressed history
  keyFacts: string;       // Extracted JSON entities
  turnCount: number;      // Total dialogue turns
  lastUpdatedAt: string;  // ISO timestamp
}
```

### The $N$-Turn Summarization Algorithm (`lib/alibaba/rag-agent.ts`):

1. Every turn increments `turnCount` in Tablestore.
2. When `turnCount % 4 === 0` (every 4 turns):
   * An asynchronous background call to `getChatCompletion()` is triggered with a compression prompt:
     > *"Summarize the key facts and user context from this conversation exchange in 2-3 concise sentences."*
   * The new summary replaces `summaryText` in Tablestore.
3. **Result**: Subsequent turns carry a compact 2-sentence summary instead of 20 raw conversation messages, keeping prompt size bounded and cheap.

---

## Concept 5: Grounded Prompt Assembly & Citation Enforcement

When the user asks a question, the agent brings **RAG Knowledge Chunks** and **Agent Memory** together into a single structured prompt.

### The Assembled Context Layout:

```text
================ SYSTEM DIRECTIVES ================
You are Advan AI Support Copilot. Answer based ONLY on the context below.
Cite sources using [Source: filename]. If context is missing, admit it.

=========== RETRIEVED KNOWLEDGE BASE ============
[Chunk 1 | Source: sla-policy.txt]
Standard Support SLA is 99.9% uptime with 15-minute response time.

[Chunk 2 | Source: sla-policy.txt]
Data retention policy is 7 years stored with client-side encryption.

=============== AGENT MEMORY SUMMARY ===============
PREVIOUS CONVERSATION SUMMARY:
Customer previously asked about enterprise onboarding timelines.

============= CONVERSATION HISTORY & QUERY =============
User: What is our incident response time and data retention policy?
```

### Why this prevents hallucinations:
1. **Explicit Source Tagging**: Every retrieved chunk is prepended with `[Source: filename]`.
2. **Negative Constraint**: System instructions explicitly forbid answering beyond retrieved chunks.
3. **Memory Grounding**: `PREVIOUS CONVERSATION SUMMARY` maintains continuity (e.g. if the user says *"What was the second option you mentioned?"*).

---

## Concept 6: End-to-End Control Flow Execution Sequence

Tracing the complete execution path when a customer sends a message:

```
Customer Message: "What is our incident response time?"
   │
   ├──► 1. getEmbedding("What is our incident response time?")
   │       └── DashScope API → returns float[1024]
   │
   ├──► 2. Tablestore Vector Query
   │       └── KnnVectorQuery(orgId: "org-alpha-demo", topK: 4)
   │       └── Returns: [ { sourceFileName: "sla-policy.txt", chunkText: "..." } ]
   │
   ├──► 3. getAgentMemory(orgId, conversationId)
   │       └── Returns: { summaryText: "...", turnCount: 3 }
   │
   ├──► 4. Synthesize Grounded Prompt
   │       └── System + Chunks + Memory + History + Message
   │
   ├──► 5. getChatCompletion(messages)
   │       └── Qwen-Plus LLM → returns:
   │           "Our incident response time is 15 minutes [Source: sla-policy.txt]."
   │
   └──► 6. Update agent_memory Table
           ├── turnCount = 4 (Triggers summarization)
           └── putAgentMemory() → updates Tablestore
```

---

## Summary of Architectural Benefits

| Architectural Layer | Engineering Problem Solved | Technology Used |
| :--- | :--- | :--- |
| **Vector Space** | Maps unstructured semantics to geometry | `text-embedding-v4` (1024D) |
| **Ingestion Pipeline** | At-least-once event delivery idempotency | Hash markers (`marker-{docId}`) |
| **Tablestore Search** | Zero-leak multi-tenant vector retrieval | `KnnVectorQuery` + `TERM_QUERY` filter |
| **Agent Memory** | Unbounded conversation token explosion | $N$-turn summarization thresholding |
| **Grounded Synthesis** | Prevents LLM hallucinations & enforces citations | `qwen-plus` + `[Source: file]` grounding |
