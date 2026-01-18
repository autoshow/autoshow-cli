#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../../common.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../whisper-build-common.sh"

setup_error_trap
detect_platform

if [ "$IS_MAC" != true ]; then
  log "Skipping CoreML setup (macOS only)"
  exit 0
fi

ensure_build_dirs

VENV_DIR="$PYENV_DIR/coreml"
CONVERT_SCRIPT_DIR=".github/setup/transcription/coreml"
COREML_CACHE_DIR="build/cache/coreml"
COREML_TMP_DIR="build/tmp/coreml"
BINARY_MARKER="$CONFIG_DIR/.whisper-coreml-installed"
VENV_MARKER="$CONFIG_DIR/.coreml-env"

mkdir -p "$COREML_CACHE_DIR" "$COREML_TMP_DIR"

if [ -f "$BINARY_MARKER" ] && [ -x "$BIN_DIR/whisper-cli-coreml" ] && [ -f "$VENV_MARKER" ]; then
  log "whisper-cli-coreml: already installed, skipping"
  log "CoreML Python environment: already configured, skipping"
  exit 0
fi

SKIP_BINARY=false
if [ -f "$BINARY_MARKER" ] && [ -x "$BIN_DIR/whisper-cli-coreml" ]; then
  log "whisper-cli-coreml: already installed, skipping build"
  SKIP_BINARY=true
fi

if [ "$SKIP_BINARY" = false ]; then
  build_whisper_full "whisper-cpp-temp-coreml" "$BIN_DIR" "whisper-cli-coreml" \
    -DGGML_METAL=ON -DWHISPER_COREML=ON
  touch "$BINARY_MARKER"
fi

if [ -f "$VENV_MARKER" ]; then
  log "CoreML Python environment: already configured, skipping"
  exit 0
fi

log "Setting up CoreML Python environment..."

log "Checking for Python 3.11..."
if ! ensure_python311; then
  log "ERROR: Cannot install Python 3.11"
  log "Please install Python 3.11 manually: brew install python@3.11"
  exit 1
fi

PY311=$(get_python311_path) || {
  log "ERROR: No valid Python 3.11 installation found"
  exit 1
}
log "Using Python: $PY311"

unset PYTHONPATH PYTHONHOME
export PIP_CACHE_DIR="$(pwd)/$COREML_CACHE_DIR"
export TMPDIR="$(pwd)/$COREML_TMP_DIR"

if ! "$PY311" -m venv "$VENV_DIR" --clear; then
  log "ERROR: Failed to create Python virtual environment"
  exit 1
fi

PYTHON="$VENV_DIR/bin/python"

export PIP_NO_CACHE_DIR=0

"$PYTHON" -m ensurepip --upgrade >/dev/null 2>&1 || {
  curl -sS https://bootstrap.pypa.io/get-pip.py -o "$COREML_TMP_DIR/get-pip.py"
  "$PYTHON" "$COREML_TMP_DIR/get-pip.py" >/dev/null 2>&1
  rm "$COREML_TMP_DIR/get-pip.py"
}

log "Installing Python packages (numpy, PyTorch, coremltools, transformers)..."
"$PYTHON" -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || {
  log "ERROR: Failed to upgrade pip/setuptools/wheel"; exit 1
}
"$PYTHON" -m pip install "numpy<2" >/dev/null 2>&1 || {
  log "ERROR: Failed to install numpy"; exit 1
}
"$PYTHON" -m pip install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || {
  log "ERROR: Failed to install PyTorch"; exit 1
}
"$PYTHON" -m pip install "coremltools>=7,<8" >/dev/null 2>&1 || {
  log "ERROR: Failed to install coremltools"; exit 1
}
"$PYTHON" -m pip install transformers sentencepiece huggingface_hub safetensors ane-transformers >/dev/null 2>&1 || {
  log "ERROR: Failed to install transformers dependencies"; exit 1
}
"$PYTHON" -m pip install 'protobuf<4' >/dev/null 2>&1 || true
"$PYTHON" -m pip install "openai-whisper" >/dev/null 2>&1 || true

cp "$CONVERT_SCRIPT_DIR/convert-whisper-to-coreml.py" "$MODELS_DIR/" >/dev/null 2>&1 || true
cp "$CONVERT_SCRIPT_DIR/generate-coreml-model.sh" "$MODELS_DIR/" >/dev/null 2>&1 || true
chmod +x "$MODELS_DIR/generate-coreml-model.sh" 2>/dev/null || true

if [ "${NO_MODELS:-false}" != "true" ]; then
  bash "$MODELS_DIR/generate-coreml-model.sh" base >/dev/null 2>&1 || true
fi

cat > "$VENV_MARKER" <<EOF
COREML_PYTHON=$PYTHON
COREML_VENV=$VENV_DIR
COREML_CACHE=$COREML_CACHE_DIR
COREML_TMP=$COREML_TMP_DIR
EOF

log "CoreML setup completed"
