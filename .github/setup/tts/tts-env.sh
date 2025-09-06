#!/bin/bash
set -euo pipefail
p='[setup/tts/tts-env]'

ensure_python311() {
  if command -v python3.11 &>/dev/null; then
    echo "$p Python 3.11 already available"
    return 0
  fi
  
  if command -v brew &>/dev/null; then
    echo "$p Installing Python 3.11 via Homebrew"
    brew install python@3.11 >/dev/null 2>&1 || {
      echo "$p WARNING: Failed to install Python 3.11 via Homebrew"
      return 1
    }
    echo "$p Python 3.11 installed successfully"
    return 0
  else
    echo "$p ERROR: Homebrew not found, cannot install Python 3.11"
    return 1
  fi
}

get_python311_path() {
  for pth in python3.11 /usr/local/bin/python3.11 /opt/homebrew/bin/python3.11; do
    if command -v "$pth" &>/dev/null; then
      v=$("$pth" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      if [ "$v" = "3.11" ]; then
        echo "$pth"
        return 0
      fi
    fi
  done
  return 1
}

VENV="build/pyenv/tts"

echo "$p Setting up TTS environment with Python 3.11"

if ! ensure_python311; then
  echo "$p ERROR: Cannot install Python 3.11, TTS features unavailable"
  exit 1
fi

PY311=$(get_python311_path) || {
  echo "$p ERROR: Python 3.11 not found after installation"
  exit 1
}

echo "$p Using Python 3.11 at: $PY311"

echo "$p Checking TTS environment status"
if [ -d "$VENV" ] && [ -x "$VENV/bin/python" ]; then
  echo "$p TTS environment directory exists, checking Python version"
  VENV_PY_VERSION=$("$VENV/bin/python" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
  
  if [ "$VENV_PY_VERSION" = "3.11" ]; then
    echo "$p Existing environment uses Python 3.11"
    if [ "${NO_MODELS:-false}" != "true" ]; then
      echo "$p Verifying existing environment packages including TTS libraries"
      if "$VENV/bin/python" -c "import torch, numpy, soundfile, librosa, scipy" 2>/dev/null && \
         "$VENV/bin/python" -c "import TTS" 2>/dev/null && \
         "$VENV/bin/python" -c "import kittentts" 2>/dev/null; then
        echo "$p Existing TTS environment is complete with all TTS packages, skipping recreation"
        mkdir -p build/config
        if [ ! -f "build/config/.tts-config.json" ]; then
          cat >build/config/.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF
        fi
        echo "$p Done"
        exit 0
      else
        echo "$p Existing environment missing TTS packages, recreating"
      fi
    else
      echo "$p Skipping TTS package verification in NO_MODELS mode"
      if "$VENV/bin/python" -c "import torch, numpy, soundfile, librosa, scipy" 2>/dev/null; then
        mkdir -p build/config
        if [ ! -f "build/config/.tts-config.json" ]; then
          cat >build/config/.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF
        fi
        echo "$p Done"
        exit 0
      else
        echo "$p Existing environment appears incomplete, recreating"
      fi
    fi
  else
    echo "$p Existing environment uses incompatible Python $VENV_PY_VERSION, recreating with Python 3.11"
  fi
fi

echo "$p Creating fresh TTS environment with Python 3.11"
if [ -d "$VENV" ]; then
  echo "$p Removing existing incompatible environment"
  chmod -R u+w "$VENV" 2>/dev/null || true
  rm -rf "$VENV" 2>/dev/null || {
    echo "$p WARNING: Could not remove existing environment completely, creating backup"
    mv "$VENV" "${VENV}.backup.$(date +%s)" 2>/dev/null || true
  }
fi

"$PY311" -m venv "$VENV" || { echo "$p ERROR: Failed to create virtual environment with Python 3.11"; exit 1; }
pip() { "$VENV/bin/pip" "$@"; }

echo "$p Installing shared TTS packages"
pip install --upgrade pip >/dev/null 2>&1

echo "$p Installing numpy and audio libraries"
pip install "numpy<2" soundfile librosa scipy >/dev/null 2>&1 || { echo "$p ERROR: Failed to install audio libraries"; exit 1; }

echo "$p Installing PyTorch"
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || pip install torch torchaudio >/dev/null 2>&1 || { echo "$p ERROR: Failed to install PyTorch"; exit 1; }

mkdir -p build/config
if [ ! -f "build/config/.tts-config.json" ]; then
  cat >build/config/.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF
fi

FINAL_PY_VERSION=$("$VENV/bin/python" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')
echo "$p Base TTS environment setup complete with Python $FINAL_PY_VERSION"
echo "$p Done"