#!/bin/bash
set -euo pipefail
TASK_DIR="$(cd "$(dirname "$0")" && pwd)"
rustc --edition=2021 --target wasm32-unknown-unknown --crate-type cdylib -C opt-level=3 -C panic=abort -C debuginfo=0 "$TASK_DIR/core.rs" -o "$TASK_DIR/core.wasm"
