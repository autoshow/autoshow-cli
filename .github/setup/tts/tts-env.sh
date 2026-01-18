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

ensure_python311() {
  if command -v python3.11 &>/dev/null; then
    return 0
  fi
  
  if command -v brew &>/dev/null; then
    brew install python@3.11 >/dev/null 2>&1 || {
      return 1
    }
    return 0
  else
    log "ERROR: Homebrew not found, cannot install Python 3.11"
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

if ! ensure_python311; then
  log "ERROR: Cannot install Python 3.11, TTS features unavailable"
  exit 1
fi

PY311=$(get_python311_path) || {
  log "ERROR: Python 3.11 not found after installation"
  exit 1
}

if [ -d "$VENV" ] && [ -x "$VENV/bin/python" ]; then
  VENV_PY_VERSION=$("$VENV/bin/python" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
  
  if [ "$VENV_PY_VERSION" = "3.11" ]; then
    if [ "${NO_MODELS:-false}" != "true" ]; then
      if "$VENV/bin/python" -c "import torch, numpy, soundfile, librosa, scipy" 2>/dev/null && \
         "$VENV/bin/python" -c "import TTS" 2>/dev/null && \
         "$VENV/bin/python" -c "import kittentts" 2>/dev/null; then
        mkdir -p build/config
        if [ ! -f "build/config/.tts-config.json" ]; then
          cat >build/config/.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF
        fi
        exit 0
      fi
    else
      if "$VENV/bin/python" -c "import torch, numpy, soundfile, librosa, scipy" 2>/dev/null; then
        mkdir -p build/config
        if [ ! -f "build/config/.tts-config.json" ]; then
          cat >build/config/.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF
        fi
        exit 0
      fi
    fi
  fi
fi

if [ -d "$VENV" ]; then
  chmod -R u+w "$VENV" 2>/dev/null || true
  rm -rf "$VENV" 2>/dev/null || {
    mv "$VENV" "${VENV}.backup.$(date +%s)" 2>/dev/null || true
  }
fi

"$PY311" -m venv "$VENV" || { log "ERROR: Failed to create virtual environment with Python 3.11"; exit 1; }
pip() { "$VENV/bin/pip" "$@"; }

pip install --upgrade pip >/dev/null 2>&1

pip install "numpy<2" soundfile librosa scipy >/dev/null 2>&1 || { log "ERROR: Failed to install audio libraries"; exit 1; }

pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || pip install torch torchaudio >/dev/null 2>&1 || { log "ERROR: Failed to install PyTorch"; exit 1; }

mkdir -p build/config
if [ ! -f "build/config/.tts-config.json" ]; then
  cat >build/config/.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF
fi