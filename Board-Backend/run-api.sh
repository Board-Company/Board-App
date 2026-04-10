#!/usr/bin/env bash
# Start Board-Backend; ensures Redis is up (Docker Compose or existing broker), then frees port 8000.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -x "$SCRIPT_DIR/scripts/ensure-redis.sh" ]]; then
  "$SCRIPT_DIR/scripts/ensure-redis.sh"
elif [[ -f "$SCRIPT_DIR/scripts/ensure-redis.sh" ]]; then
  bash "$SCRIPT_DIR/scripts/ensure-redis.sh"
fi

free_port() {
  local port="$1"
  local pids=()
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)

  if [[ ${#pids[@]} -eq 0 ]]; then
    return 0
  fi

  echo "Port $port is in use; stopping PID(s): ${pids[*]}"
  for pid in "${pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  sleep 1
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  done
}

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof not found; install Xcode CLI tools or run: brew install lsof" >&2
  exit 1
fi

free_port 8000

if command -v poetry >/dev/null 2>&1; then
  exec poetry run python api.py
else
  exec python3 -m poetry run python api.py
fi
