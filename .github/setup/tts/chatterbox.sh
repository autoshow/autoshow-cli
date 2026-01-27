#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="$CONFIG_DIR/.chatterbox-installed"

check_marker "$MARKER_FILE" && exit 0

require_tts_env

if tts_can_import "chatterbox"; then
  touch "$MARKER_FILE"
  exit 0
fi

# Install chatterbox-tts from PyPI
tts_pip install chatterbox-tts >/dev/null 2>&1 || {
  log "ERROR: Failed to install chatterbox-tts"
  exit 1
}

# Optional flash-attn for CUDA
if tts_python -c "import torch; print(torch.cuda.is_available())" 2>/dev/null | grep -q "True"; then
  MAX_JOBS=4 tts_pip install flash-attn --no-build-isolation >/dev/null 2>&1 || true
fi

if tts_can_import "chatterbox"; then
  touch "$MARKER_FILE"
  log "Chatterbox TTS installed successfully"
fi
