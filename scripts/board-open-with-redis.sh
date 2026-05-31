#!/usr/bin/env bash
# Start the full Docker stack (Redis + API + LLM + engine-worker), then open Metro/Android in Terminal tabs.
# Intended as the default dev entrypoint (e.g. Cmd+Shift+R → Run Build Task).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

wake_docker_desktop_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || return 0
  command -v docker >/dev/null 2>&1 || return 0
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  echo "Docker daemon not up — opening Docker Desktop (macOS)..."
  open -a Docker 2>/dev/null || true
  local i
  for i in $(seq 1 120); do
    if docker info >/dev/null 2>&1; then
      echo "Docker is ready."
      return 0
    fi
    sleep 1
  done
  echo "WARNING: Docker did not become ready within 120s. Stack startup may fail." >&2
  return 1
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"
  local delay_seconds="${4:-2}"

  if ! command -v curl >/dev/null 2>&1; then
    echo "curl not found, skipping health check for $name"
    return 0
  fi

  echo "Waiting for $name at $url ..."
  for ((i = 1; i <= attempts; i++)); do
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      echo "$name is up."
      return 0
    fi
    sleep "$delay_seconds"
  done

  echo "WARNING: $name did not become healthy at $url" >&2
  return 1
}

wake_docker_desktop_macos || true

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Starting Docker stack: Redis + API + LLM + engine-worker"
  "$SCRIPT_DIR/docker-stack.sh" up
  wait_for_http "http://127.0.0.1:8000/health" "Board-Backend API" || true
  wait_for_http "http://127.0.0.1:8001/health" "Board-LLM" || true
else
  echo "WARNING: docker not available or daemon not running; falling back to host-run backend tabs." >&2
  exec "$SCRIPT_DIR/open-services-in-terminal.sh" "$@"
fi

exec "$SCRIPT_DIR/open-services-in-terminal.sh" --docker-stack "$@"
