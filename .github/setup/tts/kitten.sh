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

MARKER_FILE="build/config/.kitten-installed"

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

if build/pyenv/tts/bin/python -c "import kittentts" 2>/dev/null; then
  touch "$MARKER_FILE"
  exit 0
else
  pip install setuptools wheel >/dev/null 2>&1 || true
  
  if pip install https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl >/dev/null 2>&1; then
    :
  else
    if pip install kittentts >/dev/null 2>&1; then
      :
    else
      WHEEL_URL="https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl"
      TEMP_WHEEL="/tmp/kittentts-0.1.0-py3-none-any.whl"
      
      if curl -L -o "$TEMP_WHEEL" "$WHEEL_URL" 2>/dev/null; then
        if pip install "$TEMP_WHEEL" >/dev/null 2>&1; then
          rm -f "$TEMP_WHEEL"
        else
          rm -f "$TEMP_WHEEL"
          
          if pip install git+https://github.com/KittenML/KittenTTS.git >/dev/null 2>&1; then
            :
          else
            log "ERROR: All Kitten TTS installation methods failed"
            log "This may be due to:"
            log "  - Network connectivity issues"
            log "  - Missing system dependencies"
            log "Kitten TTS will be unavailable, but Coqui TTS should still work"
            log "WARNING: Continuing with setup without Kitten TTS"
            exit 0
          fi
        fi
      else
        log "ERROR: Failed to download Kitten TTS wheel file"
        log "Network issue or URL changed. Continuing without Kitten TTS"
        exit 0
      fi
    fi
  fi
  
  if build/pyenv/tts/bin/python -c "import kittentts" 2>/dev/null; then
    touch "$MARKER_FILE"
  else
    log "WARNING: Kitten TTS installation verification failed"
    log "The package may have installed but import is failing"
    log "Continuing with setup - Coqui TTS should still work"
    exit 0
  fi
fi

if [ "${NO_MODELS:-false}" != "true" ]; then
  build/pyenv/tts/bin/python - <<'PY' >/dev/null 2>&1 || true
try:
    from kittentts import KittenTTS
    import os
    os.environ['HF_HOME'] = 'build/models/kitten'
    os.makedirs('build/models/kitten', exist_ok=True)
    m = KittenTTS("KittenML/kitten-tts-nano-0.1")
except Exception as e:
    pass
PY
fi