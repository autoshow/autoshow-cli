#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="$CONFIG_DIR/.kitten-installed"

check_marker "$MARKER_FILE" && exit 0

require_tts_env

if tts_can_import "kittentts"; then
  touch "$MARKER_FILE"
  exit 0
fi

tts_pip install setuptools wheel >/dev/null 2>&1 || true

if tts_pip install https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl >/dev/null 2>&1; then
  :
elif tts_pip install kittentts >/dev/null 2>&1; then
  :
else
  WHEEL_URL="https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl"
  TEMP_WHEEL="/tmp/kittentts-0.1.0-py3-none-any.whl"
  
  if curl -L -o "$TEMP_WHEEL" "$WHEEL_URL" 2>/dev/null; then
    if tts_pip install "$TEMP_WHEEL" >/dev/null 2>&1; then
      rm -f "$TEMP_WHEEL"
    else
      rm -f "$TEMP_WHEEL"
      if tts_pip install git+https://github.com/KittenML/KittenTTS.git >/dev/null 2>&1; then
        :
      else
        log "ERROR: All Kitten TTS installation methods failed"
        log "Kitten TTS will be unavailable, but Coqui TTS should still work"
        exit 0
      fi
    fi
  else
    log "ERROR: Failed to download Kitten TTS wheel file"
    log "Continuing without Kitten TTS"
    exit 0
  fi
fi

if tts_can_import "kittentts"; then
  touch "$MARKER_FILE"
else
  log "WARNING: Kitten TTS installation verification failed"
  log "Continuing with setup - Coqui TTS should still work"
fi
