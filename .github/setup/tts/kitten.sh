#!/bin/bash
set -euo pipefail
p='[setup/tts/kitten]'

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  echo "$p ERROR: Shared TTS environment missing at build/pyenv/tts/bin/pip"
  echo "$p Run: npm run setup:tts to set up the base TTS environment first"
  exit 1
fi

pip() { "build/pyenv/tts/bin/pip" "$@"; }

echo "$p Checking if Kitten TTS is already installed"
if build/pyenv/tts/bin/python -c "import kittentts; print('Kitten TTS already installed')" 2>/dev/null; then
  echo "$p Kitten TTS already installed, skipping installation"
else
  echo "$p Installing Kitten TTS"
  
  echo "$p Installing additional dependencies that Kitten TTS might need"
  pip install setuptools wheel >/dev/null 2>&1 || { echo "$p WARNING: Failed to install setuptools/wheel"; }
  
  echo "$p Attempting Kitten TTS installation (method 1: GitHub release)"
  if pip install https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl 2>&1; then
    echo "$p Successfully installed Kitten TTS from GitHub release"
  else
    echo "$p Method 1 failed, attempting method 2: pip search for kittentts"
    if pip install kittentts 2>&1; then
      echo "$p Successfully installed Kitten TTS from PyPI"
    else
      echo "$p Method 2 failed, attempting method 3: manual download and install"
      
      WHEEL_URL="https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl"
      TEMP_WHEEL="/tmp/kittentts-0.1.0-py3-none-any.whl"
      
      echo "$p Downloading wheel file manually"
      if curl -L -o "$TEMP_WHEEL" "$WHEEL_URL" 2>/dev/null; then
        echo "$p Wheel downloaded, attempting local installation"
        if pip install "$TEMP_WHEEL" 2>&1; then
          echo "$p Successfully installed Kitten TTS from downloaded wheel"
          rm -f "$TEMP_WHEEL"
        else
          echo "$p Method 3 failed, attempting method 4: Git installation"
          rm -f "$TEMP_WHEEL"
          
          if pip install git+https://github.com/KittenML/KittenTTS.git 2>&1; then
            echo "$p Successfully installed Kitten TTS from Git repository"
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
  
  echo "$p Verifying Kitten TTS installation"
  if build/pyenv/tts/bin/python -c "import kittentts; print('Kitten TTS verification successful')" 2>/dev/null; then
    echo "$p Kitten TTS installation verified successfully"
  else
    echo "$p WARNING: Kitten TTS installation verification failed"
    echo "$p The package may have installed but import is failing"
    echo "$p Continuing with setup - Coqui TTS should still work"
    exit 0
  fi
fi

if [ "${NO_MODELS:-false}" != "true" ]; then
  echo "$p Pre-downloading Kitten TTS model to avoid runtime errors"
  build/pyenv/tts/bin/python - <<'PY' || echo "$p WARNING: Model pre-download failed, will download on first use"
try:
    from kittentts import KittenTTS
    import os
    print("Kitten TTS import successful, attempting to pre-download model")
    
    os.environ['HF_HOME'] = 'build/models/kitten'
    os.makedirs('build/models/kitten', exist_ok=True)
    
    m = KittenTTS("KittenML/kitten-tts-nano-0.1")
    print("OK: Model pre-downloaded successfully")
except Exception as e:
    print(f"Model pre-download failed: {e}")
    print("This is normal - model will download on first use")
    raise
PY
fi

echo "$p Kitten TTS setup completed successfully"
echo "$p Done"