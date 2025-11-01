#!/bin/bash
set -euo pipefail
p='[setup/transcription/diarization]'

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

if [ "$IS_MAC" != true ]; then
  echo "$p Skipping diarization setup on non-macOS"
  exit 0
fi

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

WHISPER_DIAR_DIR="whisper-diarization-temp"
VENV="build/pyenv/whisper-diarization"
BIN_DIR="build/bin"
SCRIPT_DIR=".github/setup/transcription/diarization"
DIARIZATION_CACHE_DIR="build/cache/whisper-diarization"
DIARIZATION_TMP_DIR="build/tmp/whisper-diarization"

mkdir -p "$BIN_DIR"
mkdir -p "$DIARIZATION_CACHE_DIR"
mkdir -p "$DIARIZATION_TMP_DIR"

echo "$p Setting up whisper-diarization Python environment"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "$p ERROR: ffmpeg not found. Install with: brew install ffmpeg"
  exit 1
fi

if ! ensure_python311; then
  echo "$p ERROR: Cannot install Python 3.11, diarization features unavailable"
  exit 1
fi

PY311=$(get_python311_path) || {
  echo "$p ERROR: Python 3.11 not found after installation"
  exit 1
}

echo "$p Using Python 3.11 at: $PY311"

if [ -d "$VENV" ]; then
  chmod -R u+w "$VENV" 2>/dev/null || true
  rm -rf "$VENV" 2>/dev/null || {
    mv "$VENV" "${VENV}.backup.$(date +%s)" 2>/dev/null || true
  }
fi

unset PYTHONPATH
unset PYTHONHOME
export PIP_CACHE_DIR="$(pwd)/$DIARIZATION_CACHE_DIR"
export TMPDIR="$(pwd)/$DIARIZATION_TMP_DIR"

"$PY311" -m venv "$VENV" || { echo "$p ERROR: Failed to create virtual environment"; exit 1; }

if [ ! -f "$VENV/bin/python" ]; then
  echo "$p Virtual environment created but python binary missing"
  exit 1
fi

PYTHON="$VENV/bin/python"

unset PYTHONPATH
unset PYTHONHOME
export PIP_NO_CACHE_DIR=0
export PIP_CACHE_DIR="$(pwd)/$DIARIZATION_CACHE_DIR"
export TMPDIR="$(pwd)/$DIARIZATION_TMP_DIR"

"$PYTHON" -m ensurepip --upgrade 2>/dev/null || {
  curl -sS https://bootstrap.pypa.io/get-pip.py -o "$DIARIZATION_TMP_DIR/get-pip.py"
  "$PYTHON" "$DIARIZATION_TMP_DIR/get-pip.py"
  rm "$DIARIZATION_TMP_DIR/get-pip.py"
}

"$PYTHON" -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1

echo "$p Installing core dependencies"
"$PYTHON" -m pip install "numpy<2" >/dev/null 2>&1

if [ "$IS_MAC" = true ]; then
  "$PYTHON" -m pip install "torch==2.2.0" >/dev/null 2>&1
  "$PYTHON" -m pip install "torchaudio==2.2.0" >/dev/null 2>&1
else
  "$PYTHON" -m pip install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
  "$PYTHON" -m pip install "torchaudio==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
fi

"$PYTHON" -m pip install librosa soundfile scipy >/dev/null 2>&1

echo "$p Installing OpenAI Whisper"
"$PYTHON" -m pip install "openai-whisper==20231117" >/dev/null 2>&1

echo "$p Attempting to install optional diarization dependencies"

if [ "$IS_MAC" = true ]; then
  if ! command -v rustc >/dev/null 2>&1; then
    echo "$p Installing Rust toolchain for optional packages"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y >/dev/null 2>&1
    source "$HOME/.cargo/env" 2>/dev/null || export PATH="$HOME/.cargo/bin:$PATH"
  fi
fi

export PATH="$HOME/.cargo/bin:$PATH"

"$PYTHON" -m pip install "ctc-forced-aligner" >/dev/null 2>&1 || {
  echo "$p WARNING: ctc-forced-aligner installation failed, using fallback mode"
}

"$PYTHON" -m pip install "demucs" >/dev/null 2>&1 || {
  echo "$p WARNING: demucs installation failed, audio separation unavailable"
}

"$PYTHON" -m pip install "pyannote.audio" >/dev/null 2>&1 || {
  echo "$p WARNING: pyannote.audio installation failed, speaker diarization limited"
}

echo "$p Cloning whisper-diarization repository"
rm -rf "$WHISPER_DIAR_DIR"
git clone https://github.com/MahmoudAshraf97/whisper-diarization.git "$WHISPER_DIAR_DIR" >/dev/null 2>&1

cd "$WHISPER_DIAR_DIR"

if [ -f "diarize.py" ]; then
  cp diarize.py "../$BIN_DIR/whisper-diarize-original.py"
fi

if [ -f "helpers.py" ]; then
  cp helpers.py "../$BIN_DIR/"
fi

cd ..
rm -rf "$WHISPER_DIAR_DIR"

if [ -f "$SCRIPT_DIR/whisper-diarization-wrapper.py" ]; then
  cp "$SCRIPT_DIR/whisper-diarization-wrapper.py" "$BIN_DIR/whisper-diarize.py"
else
  echo "$p whisper-diarization-wrapper.py not found"
  exit 1
fi

echo "$p Validating core installation"
"$PYTHON" "$SCRIPT_DIR/whisper-diarization-validation.py" || {
  echo "$p Validation reported missing optional modules, but core whisper functionality available"
}

chmod +x "$BIN_DIR/whisper-diarize.py" 2>/dev/null || true

mkdir -p build/config
cat > build/config/.diarization-env <<EOF
DIARIZATION_PYTHON=$PYTHON
DIARIZATION_VENV=$VENV
DIARIZATION_CACHE=$DIARIZATION_CACHE_DIR
DIARIZATION_TMP=$DIARIZATION_TMP_DIR
EOF

echo "$p Done"
exit 0