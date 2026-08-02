"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Building2,
  FileText,
  Brain,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Database,
  RefreshCw,
  Info,
} from "lucide-react";

interface SourceChunk {
  sourceFileName: string;
  snippet: string;
  score: number;
}

interface RAGResponse {
  answer: string;
  sourceChunks: SourceChunk[];
  conversationId: string;
  turnCount: number;
  memorySummary?: string;
}

const PRESET_QUESTIONS = [
  {
    orgId: "org-alpha-demo",
    question: "What is our incident response time and data retention policy?",
    label: "Org Alpha SLA & Retention Query",
  },
  {
    orgId: "org-alpha-demo",
    question: "What is Project Orion and what are its qubit specs?",
    label: "Org Alpha Tenant Isolation Test (Asking about Org Beta Secret)",
  },
  {
    orgId: "org-beta-demo",
    question: "What is Project Orion and what are its qubit specs?",
    label: "Org Beta Query (Secret Project Orion Document)",
  },
];

export function AlibabaRAGDemo() {
  const [selectedOrg, setSelectedOrg] = useState<string>("org-alpha-demo");
  const [conversationId] = useState<string>(
    () => "conv-ui-" + Math.random().toString(36).substring(2, 7)
  );
  const [inputQuery, setInputQuery] = useState<string>(
    "What is our incident response time and data retention policy?"
  );
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("orgId", selectedOrg);
      formData.append("file", file);

      const res = await fetch("/api/alibaba/ingest", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to upload document");
      }

      const data = await res.json();
      setUploadStatus(
        `✓ File '${data.filename}' successfully uploaded to Alibaba OSS & indexed into Tablestore Vector Search! (${data.chunksCreated} chunks created)`
      );
    } catch (err: any) {
      console.error("Upload Error:", err);
      setError(err.message || "Failed to upload file to Alibaba KB");
    } finally {
      setUploading(false);
    }
  }

  async function handleSendQuery(customText?: string) {
    const textToSend = customText || inputQuery;
    if (!textToSend.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/alibaba/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: selectedOrg,
          customerMessage: textToSend,
          conversationId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to execute RAG agent query");
      }

      const data: RAGResponse = await res.json();
      setResponse(data);
    } catch (err: any) {
      console.error("RAG Demo Error:", err);
      setError(err.message || "Error calling Alibaba RAG endpoint");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80">
      {/* Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-4 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-400/20 dark:text-orange-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Alibaba Cloud Model Studio + Tablestore Live RAG
              </h3>
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                Option A Live Integration
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              `qwen-plus` LLM + `text-embedding-v4` (1024D) + Tablestore Vector Search
            </p>
          </div>
        </div>

        {/* Tenant Switcher & Upload */}
        <div className="flex flex-wrap items-center gap-2">
          {/* File Upload Button */}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-600" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            )}
            Upload to Alibaba KB
            <input
              type="file"
              accept=".txt,.pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setSelectedOrg("org-alpha-demo")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedOrg === "org-alpha-demo"
                  ? "bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Org Alpha
            </button>
            <button
              onClick={() => setSelectedOrg("org-beta-demo")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedOrg === "org-beta-demo"
                  ? "bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Org Beta
            </button>
          </div>
        </div>
      </div>

      {/* Preset Query Chips */}
      <div className="mt-4">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Interactive Test Scenarios:
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedOrg(q.orgId);
                setInputQuery(q.question);
                handleSendQuery(q.question);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-orange-50 hover:border-orange-200 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                [{q.orgId}]
              </span>{" "}
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="relative mt-4">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendQuery()}
          placeholder="Ask a question about uploaded documents..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-24 text-sm text-slate-900 focus:border-orange-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
        />
        <button
          onClick={() => handleSendQuery()}
          disabled={loading || !inputQuery.trim()}
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Send <Send className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Upload Success Banner */}
      {uploadStatus && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-xs text-green-700 dark:bg-green-950/50 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Response Panel */}
      <AnimatePresence mode="wait">
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/50"
          >
            {/* Answer Header */}
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Brain className="h-4 w-4 text-orange-500" />
                Grounded Assistant Response (qwen-plus):
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span>Turn: #{response.turnCount}</span>
                <span>Conv: {response.conversationId}</span>
              </div>
            </div>

            {/* Answer Content */}
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {response.answer}
            </p>

            {/* Source Citations */}
            <div className="mt-4 rounded-lg bg-white p-3 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Database className="h-3.5 w-3.5 text-blue-500" />
                Tablestore Vector Search Retrieved Chunks ({response.sourceChunks.length}):
              </div>

              {response.sourceChunks.length === 0 ? (
                <p className="mt-2 text-xs italic text-slate-500">
                  No chunks returned (Strict Tenant Isolation prevented access to other orgs' documents).
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {response.sourceChunks.map((chunk, idx) => (
                    <li
                      key={idx}
                      className="rounded border border-slate-100 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="flex items-center justify-between font-semibold text-orange-600 dark:text-orange-400">
                        <span>📄 Source: {chunk.sourceFileName}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-slate-600 dark:text-slate-400">
                        {chunk.snippet}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Memory Summary Badge */}
            {response.memorySummary && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-purple-50 p-2.5 text-xs text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                <Info className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Agent Memory State:</strong> "{response.memorySummary}"
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
