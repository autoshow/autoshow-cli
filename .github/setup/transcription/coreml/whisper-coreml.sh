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

# Enhanced error handling
error_handler() {
  local line=$1
  local command="$2"
  echo "[$(ts)] ERROR: Command failed at line $line: $command" >&2
  exit 1
}
trap 'error_handler ${LINENO} "$BASH_COMMAND"' ERR

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

if [ "$IS_MAC" != true ]; then
  log "Skipping CoreML setup (macOS only)"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../python-version.sh"

WHISPER_DIR="whisper-cpp-temp-coreml"
BIN_DIR="build/bin"
MODELS_DIR="build/models"
VENV_DIR="build/pyenv/coreml"
CONVERT_SCRIPT_DIR=".github/setup/transcription/coreml"
COREML_CACHE_DIR="build/cache/coreml"
COREML_TMP_DIR="build/tmp/coreml"
TMP_LOG="/tmp/whisper-coreml-build-$$.log"

mkdir -p "$BIN_DIR" "$MODELS_DIR" "$COREML_CACHE_DIR" "$COREML_TMP_DIR"

log "Checking for Python 3.11..."
if ! ensure_python311 ""; then
  log "ERROR: Cannot install Python 3.11"
  log "Please install Python 3.11 manually: brew install python@3.11"
  exit 1
fi

PY311=$(get_python311_path) || {
  log "ERROR: No valid Python 3.11 installation found"
  log "Available Python versions:"
  ls -la /opt/homebrew/bin/python* 2>/dev/null || log "No Python installations found in /opt/homebrew/bin"
  exit 1
}
log "Using Python: $PY311"

log "Cloning whisper.cpp repository for CoreML..."
rm -rf "$WHISPER_DIR"
if ! git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR" > "$TMP_LOG" 2>&1; then
  log "ERROR: Failed to clone whisper.cpp repository"
  cat "$TMP_LOG"
  rm -f "$TMP_LOG"
  exit 1
fi

log "Configuring build with CMake (CoreML + Metal)..."
if ! cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DGGML_METAL=ON -DWHISPER_COREML=ON -DBUILD_SHARED_LIBS=OFF > "$TMP_LOG" 2>&1; then
  log "ERROR: CMake configuration failed"
  cat "$TMP_LOG"
  rm -f "$TMP_LOG"
  exit 1
fi

log "Building whisper.cpp with CoreML support (this may take a few minutes)..."
if ! cmake --build "$WHISPER_DIR/build" --config Release > "$TMP_LOG" 2>&1; then
  log "ERROR: Build failed"
  cat "$TMP_LOG"
  rm -f "$TMP_LOG"
  exit 1
fi
rm -f "$TMP_LOG"

log "Installing whisper-cli-coreml binary..."

log "Installing whisper-cli-coreml binary..."

if [ -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/bin/whisper-cli" "$BIN_DIR/whisper-cli-coreml"
  chmod +x "$BIN_DIR/whisper-cli-coreml"
  log "Successfully installed whisper-cli-coreml"
elif [ -f "$WHISPER_DIR/build/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/whisper-cli" "$BIN_DIR/whisper-cli-coreml"
  chmod +x "$BIN_DIR/whisper-cli-coreml"
  log "Successfully installed whisper-cli-coreml (legacy path)"
else
  log "ERROR: CoreML whisper-cli not found in expected locations:"
  log "  - $WHISPER_DIR/build/bin/whisper-cli"
  log "  - $WHISPER_DIR/build/whisper-cli"
  ls -la "$WHISPER_DIR/build/" 2>/dev/null || log "Build directory does not exist"
  exit 1
fi

log "Copying CoreML shared libraries..."

for lib_dir in "$WHISPER_DIR/build/src" "$WHISPER_DIR/build/ggml/src" "$WHISPER_DIR/build/ggml/src/ggml-metal"; do
  if [ -d "$lib_dir" ]; then
    cp "$lib_dir"/*.dylib "$BIN_DIR/" 2>/dev/null || true
  fi
done

LIBS=$(otool -L "$BIN_DIR/whisper-cli-coreml" 2>/dev/null | grep -E "(libwhisper|libggml)" | awk '{print $1}' || true)
if [ -n "$LIBS" ]; then
  for lib in $LIBS; do
    libname=$(basename "$lib")
    if [ -f "$BIN_DIR/$libname" ]; then
      install_name_tool -change "$lib" "@executable_path/$libname" "$BIN_DIR/whisper-cli-coreml" || true
    fi
  done
fi

for dylib in "$BIN_DIR"/*.dylib; do
  if [ -f "$dylib" ]; then
    DEPS=$(otool -L "$dylib" 2>/dev/null | grep -E "(libwhisper|libggml)" | awk '{print $1}' || true)
    for dep in $DEPS; do
      depname=$(basename "$dep")
      if [ -f "$BIN_DIR/$depname" ] && [ "$depname" != "$(basename "$dylib")" ]; then
        install_name_tool -change "$dep" "@loader_path/$depname" "$dylib" || true
      fi
    done
  fi
done

log "Cleaning up whisper.cpp temporary files..."
rm -rf "$WHISPER_DIR"

log "Setting up Python virtual environment..."
unset PYTHONPATH
unset PYTHONHOME
export PIP_CACHE_DIR="$(pwd)/$COREML_CACHE_DIR"
export TMPDIR="$(pwd)/$COREML_TMP_DIR"

if ! "$PY311" -m venv "$VENV_DIR" --clear; then
  log "ERROR: Failed to create Python virtual environment"
  exit 1
fi

PYTHON="$VENV_DIR/bin/python"
log "Virtual environment created at: $VENV_DIR"

unset PYTHONPATH
unset PYTHONHOME
export PIP_NO_CACHE_DIR=0
export PIP_CACHE_DIR="$(pwd)/$COREML_CACHE_DIR"
export TMPDIR="$(pwd)/$COREML_TMP_DIR"

log "Installing Python packages (this may take several minutes)..."
"$PYTHON" -m ensurepip --upgrade 2>/dev/null || {
  log "Installing pip..."
  curl -sS https://bootstrap.pypa.io/get-pip.py -o "$COREML_TMP_DIR/get-pip.py"
  "$PYTHON" "$COREML_TMP_DIR/get-pip.py"
  rm "$COREML_TMP_DIR/get-pip.py"
}

log "Upgrading pip, setuptools, wheel..."
"$PYTHON" -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || {
  log "ERROR: Failed to upgrade pip/setuptools/wheel"
  exit 1
}

log "Installing numpy..."
"$PYTHON" -m pip install "numpy<2" >/dev/null 2>&1 || {
  log "ERROR: Failed to install numpy"
  exit 1
}

log "Installing PyTorch (CPU-only, this may take a while)..."
"$PYTHON" -m pip install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || {
  log "ERROR: Failed to install PyTorch"
  exit 1
}

log "Installing coremltools..."
"$PYTHON" -m pip install "coremltools>=7,<8" >/dev/null 2>&1 || {
  log "ERROR: Failed to install coremltools"
  exit 1
}

log "Installing Hugging Face transformers and dependencies..."
"$PYTHON" -m pip install transformers sentencepiece huggingface_hub safetensors ane-transformers >/dev/null 2>&1 || {
  log "ERROR: Failed to install transformers dependencies"
  exit 1
}

log "Installing protobuf and openai-whisper..."
"$PYTHON" -m pip install 'protobuf<4' >/dev/null 2>&1 || true
"$PYTHON" -m pip install "openai-whisper" >/dev/null 2>&1 || true

log "Copying CoreML conversion scripts..."
cp "$CONVERT_SCRIPT_DIR/convert-whisper-to-coreml.py" "$MODELS_DIR/" >/dev/null 2>&1 || true
cp "$CONVERT_SCRIPT_DIR/generate-coreml-model.sh" "$MODELS_DIR/" >/dev/null 2>&1 || true
chmod +x "$MODELS_DIR/generate-coreml-model.sh" 2>/dev/null || true

if [ "${NO_MODELS:-false}" != "true" ]; then
  log "Generating base CoreML model (optional, may fail gracefully)..."
  bash "$MODELS_DIR/generate-coreml-model.sh" base || log "Warning: Base model generation failed (non-fatal)"
fi

log "Creating CoreML environment configuration..."
mkdir -p build/config
cat > build/config/.coreml-env <<EOF
COREML_PYTHON=$PYTHON
COREML_VENV=$VENV_DIR
COREML_CACHE=$COREML_CACHE_DIR
COREML_TMP=$COREML_TMP_DIR
EOF

log "CoreML setup completed successfully"
exit 0