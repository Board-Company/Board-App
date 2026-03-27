#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/Board-Backend"
LLM_DIR="$ROOT_DIR/Board-LLM"
NIMBUS_DIR="$ROOT_DIR/nimbus"

START_ANDROID=false
START_IOS=false

usage() {
  cat <<'EOF'
Usage: ./open-services-in-terminal.sh [options]

Opens Terminal.app tabs for Board services.

Options:
  --android  Also open a tab for run-android (uses existing Metro tab; --no-packager)
  --ios      Also open a tab for run-ios (uses existing Metro tab; --no-packager)
  --help     Show this help message
EOF
}

apple_quote() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --android)
      START_ANDROID=true
      ;;
    --ios)
      START_IOS=true
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

if [[ "$START_ANDROID" == false && "$START_IOS" == false ]]; then
  START_ANDROID=true
fi

poetry_run_cmd='if command -v poetry >/dev/null 2>&1; then poetry run; else python3 -m poetry run; fi'
backend_cmd="cd '$BACKEND_DIR' && $poetry_run_cmd python api.py"
llm_cmd="cd '$LLM_DIR' && $poetry_run_cmd python llm_service.py"
metro_cmd="cd '$NIMBUS_DIR' && npm run start:fast"
# Metro already runs in a prior tab; avoid a second packager from the RN CLI.
android_cmd="cd '$NIMBUS_DIR' && npx react-native run-android --no-packager"
ios_cmd="cd '$NIMBUS_DIR' && npx react-native run-ios --no-packager"

APPLE_SCRIPT="$(mktemp -t open-board-services).applescript"

{
  echo 'tell application "Terminal"'
  echo '  activate'
  echo '  if (count of windows) = 0 then'
  echo '    do script ""'
  echo '    delay 0.3'
  echo '  end if'
  echo "  do script $(apple_quote "$backend_cmd") in front window"
  echo '  delay 0.3'
  echo '  tell application "System Events" to keystroke "t" using command down'
  echo '  delay 0.3'
  echo "  do script $(apple_quote "$llm_cmd") in front window"
  echo '  delay 0.3'
  echo '  tell application "System Events" to keystroke "t" using command down'
  echo '  delay 0.3'
  echo "  do script $(apple_quote "$metro_cmd") in front window"

  if [[ "$START_ANDROID" == true ]]; then
    echo '  delay 0.3'
    echo '  tell application "System Events" to keystroke "t" using command down'
    echo '  delay 0.3'
    echo "  do script $(apple_quote "$android_cmd") in front window"
  fi

  if [[ "$START_IOS" == true ]]; then
    echo '  delay 0.3'
    echo '  tell application "System Events" to keystroke "t" using command down'
    echo '  delay 0.3'
    echo "  do script $(apple_quote "$ios_cmd") in front window"
  fi

  echo 'end tell'
} > "$APPLE_SCRIPT"

osascript "$APPLE_SCRIPT"
rm -f "$APPLE_SCRIPT"

echo "Opened Terminal.app tabs for Board services."
