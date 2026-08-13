# FC Sandbox (E2B-compatible) image — Alibaba Cloud Function Compute Custom
# Container Runtime. Separate from the root Dockerfile (which builds the
# full Cloud Run app on port 3000 with Redis/Temporal/BullMQ workers); this
# is the leaner sandbox execution image on port 9000.
#
# Build from the REPO ROOT (build context must include app source), with
# this file selected explicitly:
#   docker build -f fc-sandbox/Dockerfile -t advan-sandbox-e2b .
# (A bare `docker build .` from repo root would pick up the OTHER
# Dockerfile at the repo root instead — that one is unrelated to this image.)

# ── Stage 1: Dependency Resolver ──────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps

# ── Stage 2: Application Builder ───────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time-only stub values (not real secrets) — `next build` statically
# analyzes routes that import modules evaluating these at import time (e.g.
# NextAuth provider config). Mirrors the same stub set already used by the
# root Dockerfile for the same reason. Runtime values come from the FC
# Function's environmentVariables (see fc-sandbox/s.yaml), not this stage.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/advan_ai"
ENV NEXTAUTH_SECRET="sFebVd7uh2iychvHmL9IBfEetUiXw3GQYvu0To2PGcQ="
ENV NEXTAUTH_URL="http://localhost:3000"
ENV AUTH_SECRET="sFebVd7uh2iychvHmL9IBfEetUiXw3GQYvu0To2PGcQ="
ENV AUTH_URL="http://localhost:3000"
ENV GOOGLE_CLIENT_ID="53330586668-4gml938cerv7j5kk323n7rmt8cgltf21.apps.googleusercontent.com"
ENV GOOGLE_CLIENT_SECRET="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"
ENV ANTHROPIC_API_KEY="sk-ant-stub-for-build"
# Additional build-time-only stubs — several lib/ modules call requireEnv()
# at import time (lib/env/required.ts throws if unset), and Next's "collect
# page data" build step statically imports every API route. These are the
# ones the FC Sandbox route tree pulls in transitively; not present in the
# root Dockerfile's (shorter, possibly stale) stub list.
ENV DASHSCOPE_CHAT_BASE_URL="https://dashscope-stub.invalid/v1"
ENV DASHSCOPE_EMBEDDING_ENDPOINT="https://dashscope-stub.invalid/v1/embeddings"
ENV DASHSCOPE_CHAT_MODEL="qwen-stub"
ENV DASHSCOPE_EMBEDDING_MODEL="text-embedding-stub"
ENV DASHSCOPE_GLOBAL_EMBEDDING_ENDPOINT="https://dashscope-stub.invalid/v1/embeddings"
ENV TEMPORAL_TASK_QUEUE="advan-agents"
ENV STRIPE_SECRET_KEY="sk_test_stub_for_build"
ENV DB_APP_NAME="advan-sandbox-e2b-build"
ENV AWS_REGION="us-east-1"
ENV AWS_ACCESS_KEY_ID="stub-for-build"
ENV AWS_SECRET_ACCESS_KEY="stub-for-build"
ENV AWS_S3_BUCKET="advan-sandbox-e2b-build-stub"
ENV HALLUCINATION_THRESHOLD="0.5"
ENV OLLAMA_BASE_URL="http://localhost:11434"
ENV OLLAMA_EMBEDDING_MODEL="nomic-embed-text"
ENV OLLAMA_TRIAGE_MODEL="llama3"
ENV OLLAMA_CHAT_MODEL="llama3"
ENV EMBEDDING_DIMENSION="768"
ENV SOCKET_PORT="3002"
ENV MCP_ORG_ID="stub-org"
ENV MCP_PORT="3001"
ENV MCP_ALLOWED_ORIGIN="http://localhost:3000"
ENV GROQ_CHAT_MODEL="llama3-groq-stub"
ENV TRIAGE_AUTO_SEND_THRESHOLD="0.9"
ENV USER_NAME="Build Stub"
ENV USER_EMAIL="build-stub@advan.ai"
ENV STRIPE_PRICE_STARTER_FLAT="price_stub"
ENV STRIPE_PRICE_STARTER_METERED="price_stub"
ENV STRIPE_PRICE_PRO_FLAT="price_stub"
ENV STRIPE_PRICE_PRO_METERED="price_stub"
ENV STRIPE_PRICE_ENTERPRISE_FLAT="price_stub"
ENV STRIPE_PRICE_ENTERPRISE_METERED="price_stub"

RUN npm run build

# ── Stage 3: Runner (Alibaba FC Sandbox / E2B-compatible base) ──────────
# Built on Alibaba's own openclaw runtime image rather than node:20-slim —
# a plain Debian base registers fine as a Docker image but timed out during
# FC Sandbox's envd injection step; Alibaba's base is the one confirmed
# (by direct test) to complete template registration. Only the runner base
# changed — deps/builder stages above still do the actual Next.js build.
FROM fc-e2b-registry.ap-southeast-1.cr.aliyuncs.com/runtime/openclaw:v0.0.37 AS runner

USER root
WORKDIR /home/user

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone Next.js output only (next.config.mjs: output: "standalone") —
# this is what keeps the final image small: no source tree, no full
# node_modules, just the traced production bundle.
COPY --from=builder --chown=user:user /app/public ./public
COPY --from=builder --chown=user:user /app/.next/standalone ./
COPY --from=builder --chown=user:user /app/.next/static ./.next/static

# No USER directive here — Alibaba's own /.fce2b/entrypoint (injected during
# envd/template registration) needs to run its privileged init as the base
# image's default user first; setting USER user before it made sandbox
# creation fail with "operation not permitted" starting '/.fce2b/entrypoint'.
# Files above are still chowned to user:user for the app process itself.

# FC Custom Container Runtime requires the container to listen on 9000.
EXPOSE 9000
ENV PORT=9000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
