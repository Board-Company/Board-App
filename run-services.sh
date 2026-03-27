#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/.run-services"
BACKEND_DIR="$ROOT_DIR/Board-Backend"
LLM_DIR="$ROOT_DIR/Board-LLM"
NIMBUS_DIR="$ROOT_DIR/nimbus"

START_ANDROID=false
START_IOS=false
RESET_METRO_CACHE=false

usage() {
  cat <<'EOF'
Usage: ./run-services.sh [options]

Starts the Board backend, Board LLM service, and React Native Metro bundler.

Options:
  --android      Also run the React Native Android app
  --ios          Also run the React Native iOS app
  --reset-cache  Start Metro with --reset-cache
  --help         Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --android)
      START_ANDROID=true
      ;;
    --ios)
      START_IOS=true
      ;;
    --reset-cache)
      RESET_METRO_CACHE=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

mkdir -p "$LOG_DIR"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

require_directory() {
  local dir_path="$1"
  if [[ ! -d "$dir_path" ]]; then
    echo "Missing required directory: $dir_path" >&2
    exit 1
  fi
}

check_optional_env_file() {
  local file_path="$1"
  local label="$2"
  if [[ ! -f "$file_path" ]]; then
    echo "Warning: $label file not found at $file_path"
  fi
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-30}"
  local delay_seconds="${4:-1}"

  if ! command -v curl >/dev/null 2>&1; then
    echo "curl not found, skipping health check for $name"
    return 0
  fi

  for ((i = 1; i <= attempts; i++)); do
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      echo "$name is up at $url"
      return 0
    fi
    sleep "$delay_seconds"
  done

  echo "Warning: $name did not become healthy at $url"
  return 1
}

PIDS=()
PID_NAMES=()
PID_REPORTED=()

cleanup() {
  local exit_code=$?

  if [[ ${#PIDS[@]} -gt 0 ]]; then
    echo
    echo "Stopping services..."
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill "$pid" >/dev/null 2>&1 || true
      fi
    done

    for pid in "${PIDS[@]}"; do
      wait "$pid" 2>/dev/null || true
    done
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

start_service() {
  local name="$1"
  local workdir="$2"
  local log_file="$3"
  shift 3

  echo "Starting $name..."
  (
    cd "$workdir"
    exec "$@"
  ) >"$log_file" 2>&1 &

  local pid=$!
  PIDS+=("$pid")
  PID_NAMES+=("$name")
  PID_REPORTED+=("false")

  echo "$name started with PID $pid"
  echo "Log: $log_file"
}

require_command npm
require_command npx
require_command python3
require_directory "$BACKEND_DIR"
require_directory "$LLM_DIR"
require_directory "$NIMBUS_DIR"

check_optional_env_file "$BACKEND_DIR/.env" "Board-Backend .env"
check_optional_env_file "$LLM_DIR/.env" "Board-LLM .env"
check_optional_env_file "$NIMBUS_DIR/.env" "nimbus .env"

BACKEND_LOG="$LOG_DIR/backend.log"
LLM_LOG="$LOG_DIR/llm.log"
METRO_LOG="$LOG_DIR/metro.log"
APP_LOG="$LOG_DIR/app.log"

: >"$BACKEND_LOG"
: >"$LLM_LOG"
: >"$METRO_LOG"
: >"$APP_LOG"

start_service "Board-Backend" "$BACKEND_DIR" "$BACKEND_LOG" bash -lc "if command -v poetry >/dev/null 2>&1; then poetry run python api.py; else python3 -m poetry run python api.py; fi"
wait_for_http "http://127.0.0.1:8000/health" "Board-Backend" || true

start_service "Board-LLM" "$LLM_DIR" "$LLM_LOG" bash -lc "if command -v poetry >/dev/null 2>&1; then poetry run python llm_service.py; else python3 -m poetry run python llm_service.py; fi"
wait_for_http "http://127.0.0.1:8001/health" "Board-LLM" || true

if [[ "$RESET_METRO_CACHE" == true ]]; then
  start_service "Nimbus Metro" "$NIMBUS_DIR" "$METRO_LOG" npm run start:fast
else
  start_service "Nimbus Metro" "$NIMBUS_DIR" "$METRO_LOG" npm start
fi

sleep 3

if [[ "$START_ANDROID" == true ]]; then
  start_service "Nimbus Android" "$NIMBUS_DIR" "$APP_LOG" npx react-native run-android --no-packager
fi

if [[ "$START_IOS" == true ]]; then
  start_service "Nimbus iOS" "$NIMBUS_DIR" "$APP_LOG" npx react-native run-ios --no-packager
fi

echo
echo "All requested services have been started."
echo "Backend: http://127.0.0.1:8000"
echo "LLM:     http://127.0.0.1:8001"
echo "Logs:    $LOG_DIR"
echo
echo "Press Ctrl+C to stop everything."

while true; do
  for i in "${!PIDS[@]}"; do
    pid="${PIDS[$i]}"
    name="${PID_NAMES[$i]}"
    already_reported="${PID_REPORTED[$i]}"
    if ! kill -0 "$pid" >/dev/null 2>&1 && [[ "$already_reported" != "true" ]]; then
      echo
      echo "$name exited. Other services are still running."
      echo "Check the logs in $LOG_DIR for details."
      PID_REPORTED[$i]="true"
    fi
  done
  sleep 2
done
