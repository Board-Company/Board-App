#!/usr/bin/env bash
# Start or manage the Docker stack (Redis + API + LLM), mirroring the Python services from run-services.sh.
# React Native Metro and the Android/iOS app stay on the host.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export COMPOSE_FILE="$ROOT_DIR/docker/stack.yml"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/docker-stack.sh <command> [options]

Commands:
  up       Build (if needed) and start all services in the background
  down     Stop and remove containers for this project (named volumes kept)
  logs     Follow logs (optional: service name, e.g. ./scripts/docker-stack.sh logs backend)
  ps       Show container status

Options (after the command):
  --project, -p <name>   Docker Compose project name (default: board-stack).
                         Use a unique name per parallel stack.
  --backend-port <port>  Host port for API (default: 8000). Inside container stays 8000.
  --llm-port <port>      Host port for LLM (default: 8001).
  --engine-workers <n>   Stockfish worker replicas (default: 3). Each runs one analysis at a time.
  --public               Bind API and LLM on 0.0.0.0 (LAN devices + EC2). Default is 127.0.0.1 only.

Environment (same effect as flags):
  COMPOSE_PROJECT_NAME   Same as --project
  BACKEND_PUBLISH        Same as --backend-port
  LLM_PUBLISH            Same as --llm-port
  ENGINE_WORKER_REPLICAS Same as --engine-workers (default: 3)
  DOCKER_BIND            Host bind address for published ports (default: 127.0.0.1). Use 0.0.0.0 for EC2/LAN.

Examples:
  ./scripts/docker-stack.sh up
  ./scripts/docker-stack.sh up --public
  ./scripts/docker-stack.sh up --project feature-x --backend-port 18000 --llm-port 18001
  COMPOSE_PROJECT_NAME=pr-42 BACKEND_PUBLISH=28000 LLM_PUBLISH=28001 ./scripts/docker-stack.sh up
EOF
}

ACTION="${1:-}"
if [[ -z "$ACTION" || "$ACTION" == "-h" || "$ACTION" == "--help" ]]; then
  usage
  exit "$([[ -n "$ACTION" ]] && echo 0 || echo 1)"
fi
shift

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-board-stack}"
BACKEND_PUBLISH="${BACKEND_PUBLISH:-8000}"
LLM_PUBLISH="${LLM_PUBLISH:-8001}"
ENGINE_WORKER_REPLICAS="${ENGINE_WORKER_REPLICAS:-3}"
DOCKER_BIND="${DOCKER_BIND:-127.0.0.1}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project|-p)
      COMPOSE_PROJECT_NAME="${2:?missing value for $1}"
      shift 2
      ;;
    --backend-port)
      BACKEND_PUBLISH="${2:?missing value for $1}"
      shift 2
      ;;
    --llm-port)
      LLM_PUBLISH="${2:?missing value for $1}"
      shift 2
      ;;
    --engine-workers)
      ENGINE_WORKER_REPLICAS="${2:?missing value for $1}"
      shift 2
      ;;
    --public)
      DOCKER_BIND="0.0.0.0"
      shift
      ;;
    *)
      break
      ;;
  esac
done

export COMPOSE_PROJECT_NAME BACKEND_PUBLISH LLM_PUBLISH ENGINE_WORKER_REPLICAS DOCKER_BIND

cd "$ROOT_DIR"

case "$ACTION" in
  up)
    docker compose up -d --build --scale "engine-worker=${ENGINE_WORKER_REPLICAS}"
    echo
    echo "Stack project: $COMPOSE_PROJECT_NAME (bind: $DOCKER_BIND)"
    echo "  API:             http://127.0.0.1:${BACKEND_PUBLISH}/health"
    echo "  LLM:             http://127.0.0.1:${LLM_PUBLISH}/health"
    echo "  engine-worker:   ${ENGINE_WORKER_REPLICAS} replica(s) (Stockfish via Redis queue)"
    if [[ "$DOCKER_BIND" == "0.0.0.0" ]]; then
      echo
      echo "Listening on all interfaces — use your LAN IP or EC2 public IP in nimbus BASE_URL (and LLM_SERVICE_URL if set)."
      echo "EC2: allow inbound TCP ${BACKEND_PUBLISH} and ${LLM_PUBLISH} (or put nginx/Caddy on 443)."
    else
      echo
      echo "Loopback only — Android emulator: BASE_URL http://10.0.2.2:${BACKEND_PUBLISH}/ (LLM port follows BASE_URL unless LLM_SERVICE_URL is set)."
      echo "USB device: adb reverse tcp:${BACKEND_PUBLISH} tcp:${BACKEND_PUBLISH} and tcp:${LLM_PUBLISH} tcp:${LLM_PUBLISH}"
    fi
    echo
    echo "Host: start Metro in nimbus (e.g. npm run start:fast), then run-android with --no-packager."
    echo "Parallel stack: different --project and --backend-port / --llm-port."
    ;;
  down)
    docker compose down
    ;;
  logs)
    docker compose logs -f "$@"
    ;;
  ps)
    docker compose ps
    ;;
  *)
    echo "Unknown command: $ACTION" >&2
    usage >&2
    exit 1
    ;;
esac
