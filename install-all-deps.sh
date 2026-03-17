#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/Board-Backend"
LLM_DIR="$ROOT_DIR/Board-LLM"
NIMBUS_DIR="$ROOT_DIR/nimbus"

echo "Installing Board-Backend dependencies..."
(
  cd "$BACKEND_DIR"
  poetry install
)

echo
echo "Installing Board-LLM dependencies..."
(
  cd "$LLM_DIR"
  poetry install
)

echo
echo "Installing Nimbus dependencies..."
(
  cd "$NIMBUS_DIR"
  npm install --legacy-peer-deps
)

echo
echo "All dependencies are installed."
