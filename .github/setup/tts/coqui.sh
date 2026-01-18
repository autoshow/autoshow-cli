#!/bin/bash
set -euo pipefail
ts() {
  if command -v gdate &>/dev/null; then
    gdate "+%H:%M:%S.%3N"
  else
    perl -MTime::HiRes=gettimeofday -e '($s,$us)=gettimeofday();@t=localtime($s);printf"%02d:%02d:%02d.%03d\n",$t[2],$t[1],$t[0],$us/1000'
  fi
}
log() { echo "[$(ts)] $*"; }

MARKER_FILE="build/config/.coqui-installed"

# Skip if already installed via marker file
if [ -f "$MARKER_FILE" ]; then
  exit 0
fi

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  log "ERROR: Shared TTS environment missing at build/pyenv/tts/bin/pip"
  log "Run: bun setup:tts to set up the base TTS environment first"
  exit 1
fi

pip() { "build/pyenv/tts/bin/pip" "$@"; }

if build/pyenv/tts/bin/python -c "import TTS" 2>/dev/null; then
  touch "$MARKER_FILE"
  exit 0
else
  if ! pip install setuptools wheel >/dev/null 2>&1; then
    log "ERROR: Failed to install setuptools/wheel"
    exit 1
  fi
  
  if ! pip install sentencepiece >/dev/null 2>&1; then
    if ! pip install --only-binary :all: sentencepiece >/dev/null 2>&1; then
      log "WARNING: Failed to install sentencepiece, continuing anyway"
    fi
  fi
  
  TTS_INSTALL_OUTPUT=$(pip install TTS 2>&1) && TTS_INSTALL_SUCCESS=true || TTS_INSTALL_SUCCESS=false
  
  if [ "$TTS_INSTALL_SUCCESS" = true ]; then
    :
  else
    TTS_INSTALL_OUTPUT=$(pip install "TTS==0.22.0" 2>&1) && TTS_INSTALL_SUCCESS=true || TTS_INSTALL_SUCCESS=false
    
    if [ "$TTS_INSTALL_SUCCESS" = true ]; then
      :
    else
      TTS_INSTALL_OUTPUT=$(pip install git+https://github.com/coqui-ai/TTS.git 2>&1) && TTS_INSTALL_SUCCESS=true || TTS_INSTALL_SUCCESS=false
      
      if [ "$TTS_INSTALL_SUCCESS" = true ]; then
        :
      else
        log "ERROR: All Coqui TTS installation methods failed"
        log "Error details:"
        echo "$TTS_INSTALL_OUTPUT"
        log "Coqui TTS will be unavailable, but Kitten TTS should still work"
        log "WARNING: Continuing with setup without Coqui TTS"
        exit 0
      fi
    fi
  fi
  
  if build/pyenv/tts/bin/python -c "import TTS" 2>/dev/null; then
    touch "$MARKER_FILE"
  else
    log "WARNING: Coqui TTS installation verification failed"
    log "The package may have installed but import is failing"
    log "Continuing with setup - Kitten TTS should still work"
    exit 0
  fi
fi

if [ "${NO_MODELS:-false}" != "true" ]; then
  build/pyenv/tts/bin/python - <<'PY' >/dev/null 2>&1 || true
try:
    from TTS.api import TTS
    tts = TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=False)
except Exception as e:
    pass
PY
fi