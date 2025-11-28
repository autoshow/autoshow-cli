#!/bin/bash
set -euo pipefail
p='[setup/tts/kitten]'

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  echo "$p ERROR: Shared TTS environment missing at build/pyenv/tts/bin/pip"
  echo "$p Run: bun setup:tts to set up the base TTS environment first"
  exit 1
fi

pip() { "build/pyenv/tts/bin/pip" "$@"; }

if build/pyenv/tts/bin/python -c "import kittentts" 2>/dev/null; then
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
            echo "$p ERROR: All Kitten TTS installation methods failed"
            echo "$p This may be due to:"
            echo "$p   - Network connectivity issues"
            echo "$p   - Missing system dependencies"
            echo "$p Kitten TTS will be unavailable, but Coqui TTS should still work"
            echo "$p WARNING: Continuing with setup without Kitten TTS"
            exit 0
          fi
        fi
      else
        echo "$p ERROR: Failed to download Kitten TTS wheel file"
        echo "$p Network issue or URL changed. Continuing without Kitten TTS"
        exit 0
      fi
    fi
  fi
  
  if build/pyenv/tts/bin/python -c "import kittentts" 2>/dev/null; then
    :
  else
    echo "$p WARNING: Kitten TTS installation verification failed"
    echo "$p The package may have installed but import is failing"
    echo "$p Continuing with setup - Coqui TTS should still work"
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