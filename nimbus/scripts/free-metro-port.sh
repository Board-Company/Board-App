#!/usr/bin/env bash
# Clears the default Metro port so react-native start can bind (avoids EADDRINUSE).
set -euo pipefail
PORT="${METRO_PORT:-8081}"
if ! command -v lsof >/dev/null 2>&1; then
  exit 0
fi
pids=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [[ -z "$pids" ]]; then
  exit 0
fi
echo "Freeing port $PORT (previous listener PIDs: $pids)"
kill $pids 2>/dev/null || true
sleep 0.3
pids=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [[ -n "$pids" ]]; then
  kill -9 $pids 2>/dev/null || true
fi
