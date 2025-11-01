#!/bin/bash
set -euo pipefail
p='[setup/transcription/diarization]'

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

if [ "$IS_MAC" != true ]; then
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../python-version.sh"

WHISPER_DIAR_DIR="whisper-diarization-temp"
VENV="build/pyenv/whisper-diarization"
BIN_DIR="build/bin"
WRAPPER_SCRIPT_DIR=".github/setup/transcription/diarization"
DIARIZATION_CACHE_DIR="build/cache/whisper-diarization"
DIARIZATION_TMP_DIR="build/tmp/whisper-diarization"

mkdir -p "$BIN_DIR"
mkdir -p "$DIARIZATION_CACHE_DIR"
mkdir -p "$DIARIZATION_TMP_DIR"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "$p ERROR: ffmpeg not found. Install with: brew install ffmpeg"
  exit 1
fi

if ! ensure_python311 "$p"; then
  echo "$p ERROR: Cannot install Python 3.11, diarization features unavailable"
  exit 1
fi

PY311=$(get_python311_path) || {
  echo "$p ERROR: Python 3.11 not found after installation"
  exit 1
}

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

"$PYTHON" -m pip install "numpy<2" >/dev/null 2>&1

if [ "$IS_MAC" = true ]; then
  "$PYTHON" -m pip install "torch==2.2.0" >/dev/null 2>&1
  "$PYTHON" -m pip install "torchaudio==2.2.0" >/dev/null 2>&1
else
  "$PYTHON" -m pip install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
  "$PYTHON" -m pip install "torchaudio==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
fi

"$PYTHON" -m pip install librosa soundfile scipy >/dev/null 2>&1

"$PYTHON" -m pip install "openai-whisper==20231117" >/dev/null 2>&1

if [ "$IS_MAC" = true ]; then
  if ! command -v rustc >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y >/dev/null 2>&1
    source "$HOME/.cargo/env" 2>/dev/null || export PATH="$HOME/.cargo/bin:$PATH"
  fi
fi

export PATH="$HOME/.cargo/bin:$PATH"

"$PYTHON" -m pip install "ctc-forced-aligner" >/dev/null 2>&1 || true

"$PYTHON" -m pip install "demucs" >/dev/null 2>&1 || true

"$PYTHON" -m pip install "pyannote.audio" >/dev/null 2>&1 || true

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

if [ -f "$WRAPPER_SCRIPT_DIR/whisper-diarization-wrapper.py" ]; then
  cp "$WRAPPER_SCRIPT_DIR/whisper-diarization-wrapper.py" "$BIN_DIR/whisper-diarize.py"
else
  echo "$p whisper-diarization-wrapper.py not found"
  exit 1
fi

chmod +x "$BIN_DIR/whisper-diarize.py" 2>/dev/null || true

mkdir -p build/config
cat > build/config/.diarization-env <<EOF
DIARIZATION_PYTHON=$PYTHON
DIARIZATION_VENV=$VENV
DIARIZATION_CACHE=$DIARIZATION_CACHE_DIR
DIARIZATION_TMP=$DIARIZATION_TMP_DIR
EOF

exit 0