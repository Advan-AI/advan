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

# Build + serve from repo `.env` (must be in the Docker build context).
# Platform-injected env still wins because load-dotenv does not override.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN test -f .env || (echo "ERROR: fc-sandbox Dockerfile requires a .env file in the build context." && exit 1)
RUN node scripts/load-dotenv.js npm run build

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
COPY --from=builder --chown=user:user /app/.env ./.env
COPY --from=builder --chown=user:user /app/scripts/load-dotenv.js ./load-dotenv.js

# No USER directive here — Alibaba's own /.fce2b/entrypoint (injected during
# envd/template registration) needs to run its privileged init as the base
# image's default user first; setting USER user before it made sandbox
# creation fail with "operation not permitted" starting '/.fce2b/entrypoint'.
# Files above are still chowned to user:user for the app process itself.

# FC Custom Container Runtime requires the container to listen on 9000.
EXPOSE 9000
ENV PORT=9000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "load-dotenv.js", "node", "server.js"]
