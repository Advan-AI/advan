#!/usr/bin/env bash
#
# Start Next.js dev server together with local worker processes.
#
# ──────────────────────────────────────────────
# Phase 2 — Infrastructure Services
# ──────────────────────────────────────────────
# Redis is started automatically when REDIS_URL is set unless DEV_ALL_SKIP_REDIS=1.
# Uses systemctl (redis-server) or redis-server --daemonize when available.
#
# Ollama is started automatically when LLM_CHAT_PROVIDER=ollama (default) unless
# DEV_ALL_SKIP_OLLAMA=1. Uses `ollama serve` when the CLI is installed, otherwise
# a Docker container named advan-ollama (override via DEV_ALL_OLLAMA_CONTAINER).
#
# Usage:
#   chmod +x scripts/dev-all.sh
#   ./scripts/dev-all.sh
#
# Optional env (skip a service if you do not need it):
#   DEV_ALL_SKIP_REDIS=1       — do not start or wait for Redis
#   DEV_ALL_SKIP_OLLAMA=1      — do not start or wait for Ollama
#   DEV_ALL_SKIP_EMBEDDING=1   — skip BullMQ embedding worker
#   DEV_ALL_SKIP_NOTIFICATION=1 — skip BullMQ notification (email) worker
#   DEV_ALL_SKIP_TEMPORAL=1    — skip Temporal worker daemon
#   DEV_ALL_SKIP_SOCKET=1      — skip Socket.IO HITL server
#   DEV_ALL_SKIP_TRIAGE=1      — skip copilot triage worker
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
OLLAMA_DOCKER_CONTAINER="${DEV_ALL_OLLAMA_CONTAINER:-advan-ollama}"
OLLAMA_DOCKER_CREATED=0

ollama_base_url() {
  echo "${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
}

ollama_host_port() {
  local raw="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
  raw="${raw#*://}"
  raw="${raw%%/*}"
  if [[ "$raw" == *:* ]]; then
    echo "$raw"
  else
    echo "${raw}:11434"
  fi
}

ollama_publish_port() {
  local hostport
  hostport="$(ollama_host_port)"
  echo "${hostport##*:}"
}

ollama_is_healthy() {
  curl -sf "$(ollama_base_url)/api/tags" >/dev/null 2>&1
}

redis_is_healthy() {
  command -v redis-cli >/dev/null 2>&1 && redis-cli ping 2>/dev/null | grep -q PONG
}

ensure_redis() {
  if [[ "${DEV_ALL_SKIP_REDIS:-}" == "1" ]]; then
    echo "[dev-all] Skipping Redis (DEV_ALL_SKIP_REDIS=1)"
    return 0
  fi

  if [[ -z "${REDIS_URL:-}" ]]; then
    echo "[dev-all] WARN: REDIS_URL unset — BullMQ workers will not start."
    return 0
  fi

  if redis_is_healthy; then
    echo "[dev-all] Redis already running (PONG)"
    return 0
  fi

  echo "[dev-all] Redis not reachable — attempting startup…"

  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files redis-server.service &>/dev/null; then
    if sudo -n systemctl start redis-server 2>/dev/null || systemctl start redis-server 2>/dev/null; then
      echo "[dev-all] Started redis-server via systemctl"
    fi
  elif command -v redis-server >/dev/null 2>&1; then
    echo "[dev-all] Starting redis-server → $LOG_DIR/redis.log"
    redis-server --daemonize yes --logfile "$LOG_DIR/redis.log" 2>/dev/null || true
  elif command -v docker >/dev/null 2>&1; then
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx advan-redis; then
      docker start advan-redis >>"$LOG_DIR/redis.log" 2>&1 || true
    else
      docker run -d --name advan-redis -p 6379:6379 redis:7-alpine >>"$LOG_DIR/redis.log" 2>&1 || true
    fi
  else
    echo "[dev-all] WARN: Redis unreachable. Install redis-server or start Docker redis:7-alpine."
    return 0
  fi

  local i
  for i in $(seq 1 15); do
    if redis_is_healthy; then
      echo "[dev-all] Redis ready"
      return 0
    fi
    sleep 1
  done

  echo "[dev-all] WARN: Redis did not become healthy within 15s — workers may fail to connect."
}

ollama_model_present() {
  local model="$1"
  curl -sf "$(ollama_base_url)/api/tags" 2>/dev/null | grep -qE "\"name\":\"${model}(:|\")"
}

pull_ollama_model() {
  local model="$1"
  if ollama_model_present "$model"; then
    return 0
  fi
  echo "[dev-all] Pulling Ollama model: $model (first run may take several minutes)…"
  if command -v ollama >/dev/null 2>&1; then
    ollama pull "$model" >>"$LOG_DIR/ollama.log" 2>&1 &
    PIDS+=("$!")
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$OLLAMA_DOCKER_CONTAINER"; then
    docker exec "$OLLAMA_DOCKER_CONTAINER" ollama pull "$model" >>"$LOG_DIR/ollama.log" 2>&1 &
    PIDS+=("$!")
  fi
}

ensure_ollama_models() {
  local chat_model="${OLLAMA_CHAT_MODEL:-llama3.2}"
  local embed_model="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"
  local triage_model="${OLLAMA_TRIAGE_MODEL:-$chat_model}"

  pull_ollama_model "$chat_model"
  if [[ "$triage_model" != "$chat_model" ]]; then
    pull_ollama_model "$triage_model"
  fi
  pull_ollama_model "$embed_model"
}

ensure_ollama() {
  if [[ "${DEV_ALL_SKIP_OLLAMA:-}" == "1" ]]; then
    echo "[dev-all] Skipping Ollama (DEV_ALL_SKIP_OLLAMA=1)"
    return 0
  fi

  if [[ "${LLM_CHAT_PROVIDER:-ollama}" != "ollama" ]]; then
    echo "[dev-all] LLM_CHAT_PROVIDER is not ollama — skipping Ollama startup"
    return 0
  fi

  if ollama_is_healthy; then
    echo "[dev-all] Ollama already running at $(ollama_base_url)"
    ensure_ollama_models
    return 0
  fi

  echo "[dev-all] Ollama not reachable at $(ollama_base_url) — attempting startup…"

  if command -v ollama >/dev/null 2>&1; then
    echo "[dev-all] Starting ollama serve → $LOG_DIR/ollama.log"
    # Honour OLLAMA_HOST when set (e.g. OLLAMA_HOST=127.0.0.1:11434).
    ollama serve >>"$LOG_DIR/ollama.log" 2>&1 &
    PIDS+=("$!")
  elif command -v docker >/dev/null 2>&1; then
    local publish_port
    publish_port="$(ollama_publish_port)"
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$OLLAMA_DOCKER_CONTAINER"; then
      echo "[dev-all] Starting Docker container $OLLAMA_DOCKER_CONTAINER → $LOG_DIR/ollama.log"
      if ! docker start "$OLLAMA_DOCKER_CONTAINER" >>"$LOG_DIR/ollama.log" 2>&1; then
        echo "[dev-all] WARN: Failed to start Docker container $OLLAMA_DOCKER_CONTAINER — see $LOG_DIR/ollama.log"
        return 0
      fi
    else
      echo "[dev-all] Creating Docker container $OLLAMA_DOCKER_CONTAINER on :$publish_port → $LOG_DIR/ollama.log"
      if ! docker run -d --name "$OLLAMA_DOCKER_CONTAINER" -p "${publish_port}:11434" ollama/ollama >>"$LOG_DIR/ollama.log" 2>&1; then
        echo "[dev-all] WARN: Failed to create Docker container $OLLAMA_DOCKER_CONTAINER — see $LOG_DIR/ollama.log"
        return 0
      fi
      OLLAMA_DOCKER_CREATED=1
    fi
  else
    echo "[dev-all] WARN: Ollama unreachable and neither 'ollama' nor 'docker' found."
    echo "[dev-all]       Chat/embeddings will fall back to Groq where configured."
    return 0
  fi

  local i
  for i in $(seq 1 45); do
    if ollama_is_healthy; then
      echo "[dev-all] Ollama ready at $(ollama_base_url)"
      ensure_ollama_models
      return 0
    fi
    sleep 1
  done

  echo "[dev-all] WARN: Ollama did not become healthy within 45s — check $LOG_DIR/ollama.log"
}

temporal_is_healthy() {
  local addr="${TEMPORAL_ADDRESS:-127.0.0.1:7233}"
  local host="${addr%%:*}"
  local port="${addr##*:}"
  # Check if gRPC port is active using bash socket access
  timeout 1 bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" >/dev/null 2>&1
}

ensure_temporal_server() {
  if [[ "${DEV_ALL_SKIP_TEMPORAL:-}" == "1" ]]; then
    echo "[dev-all] Skipping Temporal Server (DEV_ALL_SKIP_TEMPORAL=1)"
    return 0
  fi

  if temporal_is_healthy; then
    echo "[dev-all] Temporal dev server already running at ${TEMPORAL_ADDRESS:-127.0.0.1:7233}"
    return 0
  fi

  if command -v temporal >/dev/null 2>&1; then
    echo "[dev-all] Temporal dev server not running — attempting startup…"
    echo "[dev-all] Starting temporal server start-dev → $LOG_DIR/temporal-server.log"
    local addr="${TEMPORAL_ADDRESS:-127.0.0.1:7233}"
    local host="${addr%%:*}"
    local port="${addr##*:}"
    temporal server start-dev --ip "$host" --port "$port" >>"$LOG_DIR/temporal-server.log" 2>&1 &
    PIDS+=("$!")
    
    local i
    for i in $(seq 1 15); do
      if temporal_is_healthy; then
        echo "[dev-all] Temporal dev server ready"
        return 0
      fi
      sleep 1
    done
    echo "[dev-all] WARN: Temporal dev server did not become healthy within 15s — check $LOG_DIR/temporal-server.log"
  else
    echo "[dev-all] WARN: 'temporal' CLI command not found. Please install Temporal CLI or start a cluster."
  fi
}

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
  if [[ "$OLLAMA_DOCKER_CREATED" == "1" ]] && command -v docker >/dev/null 2>&1; then
    docker stop "$OLLAMA_DOCKER_CONTAINER" >/dev/null 2>&1 || true
  fi
  wait 2>/dev/null || true
  echo "[dev-all] Done."
}

trap cleanup EXIT INT TERM

start_bg() {
  local name="$1"
  shift
  echo "[dev-all] Starting $name → $LOG_DIR/${name}.log"
  # Tiny pools: Next.js + workers share one Supabase pooler quota.
  env DB_POOL_ROLE=worker \
    DB_MAX_CONNECTIONS="${WORKER_DB_MAX_CONNECTIONS:-2}" \
    "$@" >>"$LOG_DIR/${name}.log" 2>&1 &
  PIDS+=("$!")
}

# Prior interrupted `dev:all` runs leave orphan workers that each open a DB pool
# and can exhaust Supabase (EAI_AGAIN / CONNECT_TIMEOUT under load).
stop_stale_workers() {
  local patterns=(
    "lib/queue/workers/embedding-worker.ts"
    "lib/queue/workers/notification-worker.ts"
    "lib/queue/workers/copilot-triage-worker.ts"
    "lib/realtime/socket-server.ts"
    "lib/temporal/worker.ts"
  )
  local pat pids
  local found=0
  for pat in "${patterns[@]}"; do
    pids="$(pgrep -f "$pat" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      found=1
      # shellcheck disable=SC2086
      kill -TERM $pids 2>/dev/null || true
    fi
  done
  if [[ "$found" == "1" ]]; then
    echo "[dev-all] Stopped leftover workers from a prior run (frees Supabase pool slots)"
    sleep 0.8
    for pat in "${patterns[@]}"; do
      pids="$(pgrep -f "$pat" 2>/dev/null || true)"
      if [[ -n "$pids" ]]; then
        # shellcheck disable=SC2086
        kill -KILL $pids 2>/dev/null || true
      fi
    done
  fi
}

ensure_redis
ensure_ollama
ensure_temporal_server
stop_stale_workers

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
