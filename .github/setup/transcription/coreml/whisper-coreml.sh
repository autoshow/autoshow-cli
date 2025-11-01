#!/bin/bash
set -euo pipefail
p='[setup/transcription/coreml]'

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

if [ "$IS_MAC" != true ]; then
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

mkdir -p "$BIN_DIR" "$MODELS_DIR" "$COREML_CACHE_DIR" "$COREML_TMP_DIR"

if ! ensure_python311 "$p"; then
  echo "$p Cannot install Python 3.11"
  exit 1
fi

PY311=$(get_python311_path) || {
  echo "$p No valid Python 3.11 installation found"
  exit 1
}

rm -rf "$WHISPER_DIR"
git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR" >/dev/null 2>&1

cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DGGML_METAL=ON -DWHISPER_COREML=ON -DBUILD_SHARED_LIBS=OFF >/dev/null 2>&1
cmake --build "$WHISPER_DIR/build" --config Release >/dev/null 2>&1

if [ -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/bin/whisper-cli" "$BIN_DIR/whisper-cli-coreml"
  chmod +x "$BIN_DIR/whisper-cli-coreml"
elif [ -f "$WHISPER_DIR/build/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/whisper-cli" "$BIN_DIR/whisper-cli-coreml"
  chmod +x "$BIN_DIR/whisper-cli-coreml"
else
  echo "$p CoreML whisper-cli not found"
  exit 1
fi

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

rm -rf "$WHISPER_DIR"

unset PYTHONPATH
unset PYTHONHOME
export PIP_CACHE_DIR="$(pwd)/$COREML_CACHE_DIR"
export TMPDIR="$(pwd)/$COREML_TMP_DIR"

"$PY311" -m venv "$VENV_DIR" --clear

PYTHON="$VENV_DIR/bin/python"

unset PYTHONPATH
unset PYTHONHOME
export PIP_NO_CACHE_DIR=0
export PIP_CACHE_DIR="$(pwd)/$COREML_CACHE_DIR"
export TMPDIR="$(pwd)/$COREML_TMP_DIR"

"$PYTHON" -m ensurepip --upgrade 2>/dev/null || {
  curl -sS https://bootstrap.pypa.io/get-pip.py -o "$COREML_TMP_DIR/get-pip.py"
  "$PYTHON" "$COREML_TMP_DIR/get-pip.py"
  rm "$COREML_TMP_DIR/get-pip.py"
}

"$PYTHON" -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1
"$PYTHON" -m pip install "numpy<2" >/dev/null 2>&1
"$PYTHON" -m pip install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
"$PYTHON" -m pip install "coremltools>=7,<8" >/dev/null 2>&1
"$PYTHON" -m pip install transformers sentencepiece huggingface_hub safetensors ane-transformers >/dev/null 2>&1
"$PYTHON" -m pip install 'protobuf<4' >/dev/null 2>&1 || true
"$PYTHON" -m pip install "openai-whisper" >/dev/null 2>&1 || true

cp "$CONVERT_SCRIPT_DIR/convert-whisper-to-coreml.py" "$MODELS_DIR/" >/dev/null 2>&1 || true
cp "$CONVERT_SCRIPT_DIR/generate-coreml-model.sh" "$MODELS_DIR/" >/dev/null 2>&1 || true
chmod +x "$MODELS_DIR/generate-coreml-model.sh" 2>/dev/null || true

if [ "${NO_MODELS:-false}" != "true" ]; then
  bash "$MODELS_DIR/generate-coreml-model.sh" base || true
fi

mkdir -p build/config
cat > build/config/.coreml-env <<EOF
COREML_PYTHON=$PYTHON
COREML_VENV=$VENV_DIR
COREML_CACHE=$COREML_CACHE_DIR
COREML_TMP=$COREML_TMP_DIR
EOF

exit 0