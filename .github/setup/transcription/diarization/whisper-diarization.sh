#!/bin/bash
set -euo pipefail
p='[setup/transcription/diarization]'

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

validate_python() {
  local python_path="$1"
  local test_venv="/tmp/test-venv-diarization-$$"
  
  if [ ! -x "$python_path" ]; then
    return 1
  fi
  
  local version=$("$python_path" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
  if [ "$version" != "3.11" ]; then
    return 1
  fi
  
  "$python_path" -c 'import venv, encodings, sys' 2>/dev/null || return 1
  
  "$python_path" -m venv "$test_venv" --without-pip 2>/dev/null || {
    rm -rf "$test_venv" 2>/dev/null
    return 1
  }
  
  if [ ! -f "$test_venv/bin/python" ]; then
    rm -rf "$test_venv" 2>/dev/null
    return 1
  fi
  
  "$test_venv/bin/python" -c 'import sys' 2>/dev/null || {
    rm -rf "$test_venv" 2>/dev/null
    return 1
  }
  
  rm -rf "$test_venv" 2>/dev/null
  return 0
}

ensure_python311() {
  if command -v brew &>/dev/null; then
    local brew_python="/opt/homebrew/bin/python3.11"
    if [ -x "$brew_python" ] && validate_python "$brew_python"; then
      return 0
    fi
    
    brew install python@3.11 >/dev/null 2>&1 || return 1
    return 0
  else
    echo "$p Homebrew not found"
    return 1
  fi
}

get_python311_path() {
  local candidates=(
    "/opt/homebrew/bin/python3.11"
    "/usr/local/bin/python3.11"
    "python3.11"
  )
  
  for python_path in "${candidates[@]}"; do
    local full_path=""
    
    if [[ "$python_path" = /* ]]; then
      full_path="$python_path"
    else
      full_path=$(command -v "$python_path" 2>/dev/null || echo "")
    fi
    
    if [ -n "$full_path" ] && [ -x "$full_path" ] && validate_python "$full_path"; then
      echo "$full_path"
      return 0
    fi
  done
  
  return 1
}

WHISPER_DIAR_DIR="whisper-diarization-temp"
BIN_DIR="build/bin"
MODELS_DIR="build/models"
SCRIPT_DIR=".github/setup/transcription/diarization"
VENV_DIR="build/pyenv/whisper-diarization"
DIARIZATION_CACHE_DIR="build/cache/whisper-diarization"
DIARIZATION_TMP_DIR="build/tmp/whisper-diarization"

mkdir -p "$BIN_DIR" "$MODELS_DIR" "$DIARIZATION_CACHE_DIR" "$DIARIZATION_TMP_DIR"

echo "$p Setting up whisper-diarization Python environment"

if ! ensure_python311; then
  echo "$p Cannot install Python 3.11"
  exit 1
fi

PY311=$(get_python311_path) || {
  echo "$p No valid Python 3.11 installation found"
  exit 1
}

if [ -d "$VENV_DIR" ]; then
  chmod -R u+w "$VENV_DIR" 2>/dev/null || true
  rm -rf "$VENV_DIR" 2>/dev/null || {
    mv "$VENV_DIR" "${VENV_DIR}.backup.$(date +%s)" 2>/dev/null || true
  }
fi

unset PYTHONPATH
unset PYTHONHOME
export PIP_CACHE_DIR="$(pwd)/$DIARIZATION_CACHE_DIR"
export TMPDIR="$(pwd)/$DIARIZATION_TMP_DIR"

"$PY311" -m venv "$VENV_DIR" --clear || {
  echo "$p Failed to create virtual environment"
  exit 1
}

if [ ! -f "$VENV_DIR/bin/python" ]; then
  echo "$p Failed to create Python virtual environment"
  exit 1
fi

PYTHON="$VENV_DIR/bin/python"

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
"$PYTHON" -m pip install "numpy<2" >/dev/null 2>&1

if command -v ffmpeg >/dev/null 2>&1; then
  true
else
  echo "$p ffmpeg not found, whisper-diarization requires ffmpeg"
  exit 1
fi

"$PYTHON" -m pip install cython >/dev/null 2>&1

if [ "$IS_MAC" = true ]; then
  if ! command -v rustc >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y >/dev/null 2>&1
    source "$HOME/.cargo/env" 2>/dev/null || export PATH="$HOME/.cargo/bin:$PATH"
  fi
fi

if [ "$IS_MAC" = true ]; then
  "$PYTHON" -m pip install "torch==2.2.0" >/dev/null 2>&1
  "$PYTHON" -m pip install "torchaudio==2.2.0" >/dev/null 2>&1
else
  "$PYTHON" -m pip install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
  "$PYTHON" -m pip install "torchaudio==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
fi

"$PYTHON" -m pip install librosa soundfile scipy >/dev/null 2>&1
"$PYTHON" -m pip install "openai-whisper==20231117" >/dev/null 2>&1
"$PYTHON" -m pip install "faster-whisper==0.10.1" >/dev/null 2>&1

export PATH="$HOME/.cargo/bin:$PATH"
"$PYTHON" -m pip install "ctc-forced-aligner==0.1.8" >/dev/null 2>&1 || {
  "$PYTHON" -m pip install "ctc-forced-aligner==0.1.7" >/dev/null 2>&1 || {
    "$PYTHON" -m pip install ctc-forced-aligner >/dev/null 2>&1 || true
  }
}

"$PYTHON" -m pip install "demucs==4.0.0" >/dev/null 2>&1 || "$PYTHON" -m pip install demucs >/dev/null 2>&1 || true
"$PYTHON" -m pip install "pyannote.audio==3.1.1" >/dev/null 2>&1 || "$PYTHON" -m pip install "pyannote.audio" >/dev/null 2>&1 || true
"$PYTHON" -m pip install "nemo-toolkit[asr]==1.22.0" >/dev/null 2>&1 || "$PYTHON" -m pip install "nemo-toolkit[asr]" >/dev/null 2>&1 || "$PYTHON" -m pip install nemo-toolkit >/dev/null 2>&1 || true

rm -rf "$WHISPER_DIAR_DIR"
git clone https://github.com/MahmoudAshraf97/whisper-diarization.git "$WHISPER_DIAR_DIR" >/dev/null 2>&1

cd "$WHISPER_DIAR_DIR"

if [ -f "requirements.txt" ]; then
  "$PYTHON" -m pip install -r requirements.txt >/dev/null 2>&1 || true
fi

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

"$PYTHON" "$SCRIPT_DIR/whisper-diarization-validation.py" || {
  echo "$p Validation failed but continuing"
}

chmod +x "$BIN_DIR/whisper-diarize.py" 2>/dev/null || true

mkdir -p build/config
cat > build/config/.diarization-env <<EOF
DIARIZATION_PYTHON=$PYTHON
DIARIZATION_VENV=$VENV_DIR
DIARIZATION_CACHE=$DIARIZATION_CACHE_DIR
DIARIZATION_TMP=$DIARIZATION_TMP_DIR
EOF

echo "$p Done"
exit 0