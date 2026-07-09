#!/usr/bin/env bash
#
# Start Next.js dev server together with local worker processes.
#
# Prerequisites (run separately — e.g. Docker or system services):
#   - Postgres (DATABASE_URL)
#   - Redis (REDIS_URL) — BullMQ embedding queue
#   - Temporal dev server on TEMPORAL_ADDRESS (default localhost:7233)
#   - Ollama on OLLAMA_BASE_URL — chat + embeddings
#
# Usage:
#   chmod +x scripts/dev-all.sh
#   ./scripts/dev-all.sh
#
# Optional env (skip a service if you do not need it):
#   DEV_ALL_SKIP_EMBEDDING=1   — skip BullMQ embedding worker
#   DEV_ALL_SKIP_NOTIFICATION=1 — skip BullMQ notification (email) worker
#   DEV_ALL_SKIP_TEMPORAL=1    — skip Temporal worker daemon
#   DEV_ALL_SKIP_SOCKET=1      — skip Socket.IO HITL server
#
# Logs: scripts/logs/*.log
#

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
elif [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

LOG_DIR="$ROOT/scripts/logs"
mkdir -p "$LOG_DIR"

PIDS=()
cleanup() {
  local pid
  echo ""
  echo "[dev-all] Shutting down background workers..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 0.5
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "[dev-all] Done."
}

trap cleanup EXIT INT TERM

start_bg() {
  local name="$1"
  shift
  echo "[dev-all] Starting $name → $LOG_DIR/${name}.log"
  "$@" >>"$LOG_DIR/${name}.log" 2>&1 &
  PIDS+=("$!")
}

if [[ "${DEV_ALL_SKIP_EMBEDDING:-}" != "1" ]]; then
  if [[ -z "${REDIS_URL:-}" ]]; then
    echo "[dev-all] WARN: REDIS_URL unset — skipping embedding worker (set DEV_ALL_SKIP_EMBEDDING=1 to silence)."
  else
    start_bg "embedding-worker" npx tsx lib/queue/workers/embedding-worker.ts
  fi
fi

if [[ "${DEV_ALL_SKIP_NOTIFICATION:-}" != "1" ]]; then
  if [[ -z "${REDIS_URL:-}" || -z "${RESEND_API_KEY:-}" ]]; then
    echo "[dev-all] WARN: REDIS_URL and/or RESEND_API_KEY unset — skipping notification worker (set DEV_ALL_SKIP_NOTIFICATION=1 to silence)."
  else
    start_bg "notification-worker" npx tsx lib/queue/workers/notification-worker.ts
  fi
fi

if [[ "${DEV_ALL_SKIP_TRIAGE:-}" != "1" ]]; then
  if [[ -z "${REDIS_URL:-}" ]]; then
    echo "[dev-all] WARN: REDIS_URL unset — skipping copilot triage worker (set DEV_ALL_SKIP_TRIAGE=1 to silence)."
  else
    start_bg "copilot-triage-worker" npx tsx lib/queue/workers/copilot-triage-worker.ts
  fi
fi

if [[ "${DEV_ALL_SKIP_TEMPORAL:-}" != "1" ]]; then
  start_bg "temporal-worker" npm run temporal:worker
fi

if [[ "${DEV_ALL_SKIP_SOCKET:-}" != "1" ]]; then
  start_bg "socket-server" npx tsx lib/realtime/socket-server.ts
fi

if ((${#PIDS[@]} > 0)); then
  echo "[dev-all] Background PIDs: ${PIDS[*]}"
  echo "[dev-all] Tail logs: tail -f $LOG_DIR/*.log"
fi

echo "[dev-all] Starting Next.js (foreground)…"
exec npm run dev
