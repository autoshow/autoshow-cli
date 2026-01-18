#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="$CONFIG_DIR/.coqui-installed"

check_marker "$MARKER_FILE" && exit 0

require_tts_env

if tts_can_import "TTS"; then
  touch "$MARKER_FILE"
  exit 0
fi

if ! tts_pip install setuptools wheel >/dev/null 2>&1; then
  log "ERROR: Failed to install setuptools/wheel"
  exit 1
fi

if ! tts_pip install sentencepiece >/dev/null 2>&1; then
  tts_pip install --only-binary :all: sentencepiece >/dev/null 2>&1 || \
    log "WARNING: Failed to install sentencepiece, continuing anyway"
fi

TTS_INSTALL_OUTPUT=""
TTS_INSTALL_SUCCESS=false

if TTS_INSTALL_OUTPUT=$(tts_pip install TTS 2>&1); then
  TTS_INSTALL_SUCCESS=true
elif TTS_INSTALL_OUTPUT=$(tts_pip install "TTS==0.22.0" 2>&1); then
  TTS_INSTALL_SUCCESS=true
elif TTS_INSTALL_OUTPUT=$(tts_pip install git+https://github.com/coqui-ai/TTS.git 2>&1); then
  TTS_INSTALL_SUCCESS=true
fi

if [ "$TTS_INSTALL_SUCCESS" = false ]; then
  log "ERROR: All Coqui TTS installation methods failed"
  log "Error details:"
  echo "$TTS_INSTALL_OUTPUT"
  log "Coqui TTS will be unavailable, but Kitten TTS should still work"
  exit 0
fi

if tts_can_import "TTS"; then
  touch "$MARKER_FILE"
else
  log "WARNING: Coqui TTS installation verification failed"
  log "Continuing with setup - Kitten TTS should still work"
fi
