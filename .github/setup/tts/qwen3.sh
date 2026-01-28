#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="$CONFIG_DIR/.qwen3-installed"

check_marker "$MARKER_FILE" && exit 0

require_tts_env

if tts_can_import "qwen_tts"; then
  touch "$MARKER_FILE"
  exit 0
fi

# Install qwen-tts from PyPI with compatible transformers version
# qwen_tts requires transformers>=4.48 for ALL_ATTENTION_FUNCTIONS
tts_pip install "transformers>=4.48" >/dev/null 2>&1 || {
  log "ERROR: Failed to upgrade transformers"
  exit 0
}

tts_pip install qwen-tts >/dev/null 2>&1 || {
  log "ERROR: Failed to install qwen-tts"
  log "Qwen3 TTS will be unavailable"
  exit 0
}

# Optional: Install flash-attn for better performance (requires compatible GPU)
if tts_python -c "import torch; print(torch.cuda.is_available())" 2>/dev/null | grep -q "True"; then
  log "CUDA available, attempting to install flash-attn for better performance..."
  MAX_JOBS=4 tts_pip install flash-attn --no-build-isolation >/dev/null 2>&1 || \
    log "WARNING: flash-attn installation failed, continuing without it"
fi

if tts_can_import "qwen_tts"; then
  touch "$MARKER_FILE"
  log "Qwen3 TTS installed successfully"
else
  log "WARNING: Qwen3 TTS installation verification failed"
fi
