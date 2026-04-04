#!/usr/bin/env bash
# Start local Redis via Board-Backend/docker-compose.yml, then open Board services in Terminal tabs.
# Intended as the default dev entrypoint (e.g. Cmd+Shift+R → Run Build Task).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/Board-Backend"

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
  echo "WARNING: Docker did not become ready within 120s. Redis compose may fail." >&2
  return 1
}

wake_docker_desktop_macos || true

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && [[ -f "$BACKEND_DIR/docker-compose.yml" ]]; then
  echo "Starting Redis: docker compose up -d redis (in Board-Backend)"
  (cd "$BACKEND_DIR" && docker compose up -d redis)
else
  echo "WARNING: docker not available or daemon not running; skipping compose redis." >&2
fi

if [[ -f "$BACKEND_DIR/scripts/ensure-redis.sh" ]]; then
  if [[ -x "$BACKEND_DIR/scripts/ensure-redis.sh" ]]; then
    "$BACKEND_DIR/scripts/ensure-redis.sh" || echo "WARNING: Redis check failed; Board-Backend tab may error until Redis is up." >&2
  else
    bash "$BACKEND_DIR/scripts/ensure-redis.sh" || echo "WARNING: Redis check failed; Board-Backend tab may error until Redis is up." >&2
  fi
fi

exec "$SCRIPT_DIR/open-services-in-terminal.sh" "$@"
