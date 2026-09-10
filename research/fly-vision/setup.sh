#!/bin/bash
set -euo pipefail
TASK_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$TASK_DIR/.cache"
uv venv --python 3.12 "$TASK_DIR/.venv"
uv pip install --python "$TASK_DIR/.venv/bin/python" -r "$TASK_DIR/requirements.txt"
"$TASK_DIR/.venv/bin/python" "$TASK_DIR/download.py"
