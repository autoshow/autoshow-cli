#!/bin/bash
set -euo pipefail
p='[setup/tts/coqui]'

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  echo "$p ERROR: Shared TTS environment missing at build/pyenv/tts/bin/pip"
  echo "$p Run: npm run setup:tts to set up the base TTS environment first"
  exit 1
fi

pip() { "build/pyenv/tts/bin/pip" "$@"; }

echo "$p Checking if Coqui TTS is already installed"
if build/pyenv/tts/bin/python -c "import TTS; print('Coqui TTS already installed')" 2>/dev/null; then
  echo "$p Coqui TTS already installed, skipping installation"
else
  echo "$p Installing Coqui TTS"
  
  echo "$p Installing additional dependencies for Coqui TTS"
  if ! pip install setuptools wheel >/dev/null 2>&1; then
    echo "$p ERROR: Failed to install setuptools/wheel"
    exit 1
  fi
  
  echo "$p Installing sentencepiece for text processing"
  if ! pip install sentencepiece >/dev/null 2>&1; then
    if ! pip install --only-binary :all: sentencepiece >/dev/null 2>&1; then
      echo "$p WARNING: Failed to install sentencepiece, continuing anyway"
    fi
  fi
  
  echo "$p Attempting Coqui TTS installation (method 1: latest version)"
  TTS_INSTALL_OUTPUT=$(pip install TTS 2>&1) && TTS_INSTALL_SUCCESS=true || TTS_INSTALL_SUCCESS=false
  
  if [ "$TTS_INSTALL_SUCCESS" = true ]; then
    echo "$p Successfully installed Coqui TTS latest version"
  else
    echo "$p Method 1 failed, attempting method 2: specific version 0.22.0"
    TTS_INSTALL_OUTPUT=$(pip install "TTS==0.22.0" 2>&1) && TTS_INSTALL_SUCCESS=true || TTS_INSTALL_SUCCESS=false
    
    if [ "$TTS_INSTALL_SUCCESS" = true ]; then
      echo "$p Successfully installed Coqui TTS version 0.22.0"
    else
      echo "$p Method 2 failed, attempting method 3: Git installation"
      TTS_INSTALL_OUTPUT=$(pip install git+https://github.com/coqui-ai/TTS.git 2>&1) && TTS_INSTALL_SUCCESS=true || TTS_INSTALL_SUCCESS=false
      
      if [ "$TTS_INSTALL_SUCCESS" = true ]; then
        echo "$p Successfully installed Coqui TTS from Git"
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
  
  echo "$p Verifying Coqui TTS installation"
  if build/pyenv/tts/bin/python -c "import TTS; print('Coqui TTS verification successful')" 2>/dev/null; then
    echo "$p Coqui TTS installation verified successfully"
  else
    echo "$p WARNING: Coqui TTS installation verification failed"
    echo "$p The package may have installed but import is failing"
    echo "$p Continuing with setup - Kitten TTS should still work"
    exit 0
  fi
fi

if [ "${NO_MODELS:-false}" != "true" ]; then
  echo "$p Testing Coqui TTS model loading"
  build/pyenv/tts/bin/python - <<'PY' || echo "$p WARNING: Default model test failed, will download on first use"
try:
    from TTS.api import TTS
    print("Coqui TTS API import successful")
    tts = TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=False)
    print("OK: Default model loaded successfully")
except Exception as e:
    print(f"Model test failed: {e}")
    print("This is normal - model will download on first use")
PY
fi

echo "$p Coqui TTS setup completed successfully"
echo "$p Done"