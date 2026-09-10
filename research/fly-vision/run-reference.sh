#!/bin/bash
set -euo pipefail
TASK_DIR="$(cd "$(dirname "$0")" && pwd)"
export PYTHON_DOTENV_DISABLED=1
cd /tmp
exec "$TASK_DIR/.venv/bin/python" -u "$TASK_DIR/reference.py"
