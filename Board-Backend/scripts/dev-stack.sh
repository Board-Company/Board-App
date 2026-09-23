#!/usr/bin/env bash
# Start (or stop) the backend on this machine: Redis, the API on all interfaces, and
# N Stockfish workers. Logs land in ./logs. Intended for a dev box a phone talks to.
#
#   scripts/dev-stack.sh up [workers]   # default 3 workers
#   scripts/dev-stack.sh down
#   scripts/dev-stack.sh status
set -euo pipefail
cd "$(dirname "$0")/.."

PY=.venv/bin/python
PORT=${PORT:-8000}
LOGS=logs
mkdir -p "$LOGS"
export PATH=/opt/homebrew/bin:$PATH
export STOCKFISH_PATH=${STOCKFISH_PATH:-$(command -v stockfish || true)}

start_redis() {
  redis-cli ping >/dev/null 2>&1 && { echo "redis: already running"; return; }
  redis-server --port 6379 --bind 127.0.0.1 --daemonize yes --appendonly yes \
    --appendfsync everysec --logfile "$PWD/$LOGS/redis.log"
  sleep 1
  echo "redis: started"
}

case "${1:-up}" in
  up)
    workers=${2:-3}
    [ -n "$STOCKFISH_PATH" ] || { echo "stockfish not found on PATH"; exit 1; }
    start_redis
    pkill -f "uvicorn api:app" 2>/dev/null || true
    pkill -f "python -m engine_worker" 2>/dev/null || true
    sleep 1
    # 0.0.0.0 so a phone on the LAN (or Tailscale) can reach it, not just localhost.
    nohup $PY -m uvicorn api:app --host 0.0.0.0 --port "$PORT" > "$LOGS/api.log" 2>&1 &
    for _ in $(seq 60); do
      curl -sf "localhost:$PORT/health" >/dev/null && break
      sleep 0.5
    done
    for _ in $(seq "$workers"); do
      nohup $PY -m engine_worker >> "$LOGS/workers.log" 2>&1 &
    done
    for _ in $(seq 60); do
      [ "$(redis-cli client list | grep -c 'cmd=brpoplpush')" -ge "$workers" ] && break
      sleep 0.5
    done
    echo "api:     http://$(ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || echo 127.0.0.1):$PORT"
    echo "health:  $(curl -s localhost:$PORT/health)"
    echo "workers: $(redis-cli client list | grep -c 'cmd=brpoplpush') waiting for jobs"
    ;;
  down)
    pkill -f "uvicorn api:app" 2>/dev/null || true
    pkill -f "python -m engine_worker" 2>/dev/null || true
    echo "api and workers stopped (redis left running)"
    ;;
  status)
    echo "api:     $(curl -s "localhost:$PORT/health" || echo down)"
    echo "workers: $(redis-cli client list 2>/dev/null | grep -c 'cmd=brpoplpush') idle"
    ;;
  *) echo "usage: $0 {up [workers]|down|status}"; exit 1 ;;
esac
