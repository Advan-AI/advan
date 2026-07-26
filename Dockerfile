# ── Stage 1: Dependency Resolver ──────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app

# Resolve deps from package.json on the server (no committed lockfile).
COPY package.json ./
RUN npm install --legacy-peer-deps

# ── Stage 2: Application Builder ───────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables required for building
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

# Build Next.js standalone server
RUN npm run build

# ── Stage 3: Runner ───────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root system user for security hardening
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Copy static public assets
COPY --from=builder /app/public ./public

# Copy full node_modules and repository source files
# This guarantees 100% flawless compatibility for running workers on the fly (e.g. tsx, tsc path resolutions)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy next standalone built outputs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure our production runner script is executable
RUN chmod +x /app/scripts/prod-runner.js

# Change ownership of next-related directories to nextjs user
RUN chown -R nextjs:nodejs /app/.next /app/scripts

USER nextjs

# Cloud Run injects the PORT environment variable automatically (defaults to 8080/3000)
EXPOSE 3000
EXPOSE 3002

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# By default, run our supervisor to launch Next.js, Socket.IO, BullMQ, and Temporal Workers.
# To run Next.js alone, override CMD during deployment: ["node", "server.js"]
CMD ["node", "scripts/prod-runner.js"]
