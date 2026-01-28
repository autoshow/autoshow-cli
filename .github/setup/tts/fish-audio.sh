#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="$CONFIG_DIR/.fish-audio-installed"

check_marker "$MARKER_FILE" && exit 0

require_tts_env

# Check if dependencies are available
if tts_can_import "requests" && tts_can_import "torch"; then
  # Download weights automatically for setup:tts
  CHECKPOINT_DIR="${FISHAUDIO_CHECKPOINT_PATH:-build/checkpoints/openaudio-s1-mini}"
  
  if [ ! -d "$CHECKPOINT_DIR" ] || [ -z "$(ls -A "$CHECKPOINT_DIR" 2>/dev/null)" ]; then
    log "Downloading FishAudio S1-mini weights (~2GB)..."
    
    # Ensure huggingface_hub is available
    tts_pip install "huggingface_hub[cli]" >/dev/null 2>&1 || true
    
    mkdir -p "$CHECKPOINT_DIR"
    
    # Try downloading via Python
    DOWNLOAD_OUTPUT=$(tts_python -c "from huggingface_hub import snapshot_download; snapshot_download('fishaudio/openaudio-s1-mini', local_dir='$CHECKPOINT_DIR')" 2>&1)
    DOWNLOAD_STATUS=$?
    
    if [ $DOWNLOAD_STATUS -eq 0 ]; then
      log "FishAudio weights downloaded successfully"
    elif echo "$DOWNLOAD_OUTPUT" | grep -q "GatedRepoError\|401\|Unauthorized"; then
      log "WARNING: FishAudio model requires HuggingFace authentication"
      log "  1. Run: hf auth login"
      log "  2. Accept license at: https://huggingface.co/fishaudio/openaudio-s1-mini"
      log "  3. Then run: hf download fishaudio/openaudio-s1-mini --local-dir $CHECKPOINT_DIR"
    else
      log "WARNING: Failed to download weights. You can download manually:"
      log "  hf download fishaudio/openaudio-s1-mini --local-dir $CHECKPOINT_DIR"
    fi
  else
    log "FishAudio weights already present at $CHECKPOINT_DIR"
  fi
  
  touch "$MARKER_FILE"
  log "FishAudio TTS installed successfully"
  exit 0
fi

# Install dependencies
log "Installing FishAudio dependencies..."
tts_pip install requests >/dev/null 2>&1 || {
  log "ERROR: Failed to install requests"
  exit 1
}

# Optional flash-attn for CUDA (improves CLI inference speed)
if tts_python -c "import torch; print(torch.cuda.is_available())" 2>/dev/null | grep -q "True"; then
  log "CUDA available, attempting to install flash-attn..."
  MAX_JOBS=4 tts_pip install flash-attn --no-build-isolation >/dev/null 2>&1 || \
    log "WARNING: flash-attn installation failed, continuing without it"
fi

# Re-run to download weights
exec "$0"
