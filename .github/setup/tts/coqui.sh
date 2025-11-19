#!/bin/bash
set -euo pipefail
p='[setup/tts/coqui]'

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  echo "$p ERROR: Shared TTS environment missing at build/pyenv/tts/bin/pip"
  echo "$p Run: npm run setup:tts to set up the base TTS environment first"
  exit 1
fi

pip() { "build/pyenv/tts/bin/pip" "$@"; }

if build/pyenv/tts/bin/python -c "import TTS; print('Coqui TTS already installed')" 2>/dev/null; then
  exit 0
else
  if ! pip install setuptools wheel >/dev/null 2>&1; then
    echo "$p ERROR: Failed to install setuptools/wheel"
    exit 1
  fi
  
  if ! pip install sentencepiece >/dev/null 2>&1; then
    if ! pip install --only-binary :all: sentencepiece >/dev/null 2>&1; then
      echo "$p WARNING: Failed to install sentencepiece, continuing anyway"
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
        echo "$p ERROR: All Coqui TTS installation methods failed"
        echo "$p Error details:"
        echo "$TTS_INSTALL_OUTPUT"
        echo "$p Coqui TTS will be unavailable, but Kitten TTS should still work"
        echo "$p WARNING: Continuing with setup without Coqui TTS"
        exit 0
      fi
    fi
  fi
  
  if build/pyenv/tts/bin/python -c "import TTS" 2>/dev/null; then
    :
  else
    echo "$p WARNING: Coqui TTS installation verification failed"
    echo "$p The package may have installed but import is failing"
    echo "$p Continuing with setup - Kitten TTS should still work"
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