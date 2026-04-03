#!/usr/bin/env bash
# Ensure Redis is reachable at REDIS_URL host (default 127.0.0.1:6379).
# If Redis is not already up: starts the `redis` service via Docker Compose (needs Docker Desktop running).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"

redis_pong() {
  if command -v redis-cli >/dev/null 2>&1; then
    if [[ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null || true)" == "PONG" ]]; then
      return 0
    fi
  fi
  if command -v docker >/dev/null 2>&1 && [[ -f docker-compose.yml ]]; then
    docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG
    return $?
  fi
  return 1
}

if redis_pong; then
  echo "Redis OK (${REDIS_HOST}:${REDIS_PORT})"
  exit 0
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && [[ -f docker-compose.yml ]]; then
  echo "Starting Redis (docker compose up -d redis)..."
  docker compose up -d redis
  for _ in $(seq 1 40); do
    if redis_pong; then
      echo "Redis OK (${REDIS_HOST}:${REDIS_PORT})"
      exit 0
    fi
    sleep 0.25
  done
  echo "Redis did not become ready after docker compose up." >&2
  exit 1
fi

echo "Redis is not reachable at ${REDIS_HOST}:${REDIS_PORT} and Docker is not available to start it." >&2
echo "Options:" >&2
echo "  brew install redis && brew services start redis" >&2
echo "  Or install Docker and run: cd Board-Backend && docker compose up -d redis" >&2
exit 1
