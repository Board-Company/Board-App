#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/Board-Backend"
LLM_DIR="$ROOT_DIR/Board-LLM"
NIMBUS_DIR="$ROOT_DIR/nimbus"

# Board-Backend requires-python is >=3.12,<3.14; Homebrew's default python3 may be 3.14+.
backend_poetry_python() {
  if command -v python3.13 >/dev/null 2>&1; then command -v python3.13
  elif command -v python3.12 >/dev/null 2>&1; then command -v python3.12
  fi
}

echo "Installing Board-Backend dependencies..."
(
  cd "$BACKEND_DIR"
  if command -v poetry >/dev/null 2>&1; then
    poetry_cmd=(poetry)
  else
    poetry_cmd=(python3 -m poetry)
  fi
  if py="$(backend_poetry_python)" && [[ -n "$py" ]]; then
    "${poetry_cmd[@]}" env use "$py"
  fi
  "${poetry_cmd[@]}" install
)

echo
echo "Installing Board-LLM dependencies..."
(
  cd "$LLM_DIR"
  if command -v poetry >/dev/null 2>&1; then
    poetry install
  else
    python3 -m poetry install
  fi
)

echo
echo "Installing Nimbus dependencies..."
(
  cd "$NIMBUS_DIR"
  npm install --legacy-peer-deps
)

echo
echo "All dependencies are installed."
