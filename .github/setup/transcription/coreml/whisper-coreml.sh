#!/bin/bash
set -euo pipefail
p='[setup/transcription/coreml]'

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

if [ "$IS_MAC" != true ]; then
  echo "$p Skipping CoreML setup on non-macOS"
  exit 0
fi

check_xcode_tools() {
  if command -v xcrun &>/dev/null; then
    if xcrun --find coremlc &>/dev/null 2>&1 || xcrun --find coremlcompiler &>/dev/null 2>&1; then
      return 0
    fi
  fi
  
  if xcode-select -p &>/dev/null 2>&1; then
    echo "$p Xcode CLI Tools installed but CoreML compiler not found"
    return 1
  fi
  
  echo "$p Installing Xcode Command Line Tools..."
  xcode-select --install 2>/dev/null || true
  
  local wait_count=0
  while ! xcode-select -p &>/dev/null 2>&1; do
    sleep 10
    wait_count=$((wait_count + 1))
    if [ $wait_count -eq 60 ]; then
      echo "$p Timeout waiting for Command Line Tools"
      return 1
    fi
  done
  
  return 1
}

validate_python() {
  local python_path="$1"
  local test_venv="/tmp/test-venv-coreml-$$"
  
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

WHISPER_DIR="whisper-cpp-temp-coreml"
BIN_DIR="build/bin"
MODELS_DIR="build/models"
VENV_DIR="build/pyenv/coreml"
SCRIPT_DIR=".github/setup/transcription/coreml"
COREML_CACHE_DIR="build/cache/coreml"
COREML_TMP_DIR="build/tmp/coreml"

mkdir -p "$BIN_DIR" "$MODELS_DIR" "$COREML_CACHE_DIR" "$COREML_TMP_DIR"

check_xcode_tools || true

echo "$p Building whisper-cli-coreml"
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

echo "$p Setting up CoreML Python environment"

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
export PIP_CACHE_DIR="$(pwd)/$COREML_CACHE_DIR"
export TMPDIR="$(pwd)/$COREML_TMP_DIR"

"$PY311" -m venv "$VENV_DIR" --clear || {
  echo "$p Failed to create virtual environment"
  exit 1
}

if [ ! -f "$VENV_DIR/bin/python" ]; then
  echo "$p Virtual environment created but python binary missing"
  exit 1
fi

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
"$PYTHON" -m pip install "coremltools>=7,<8" "transformers" "sentencepiece" "huggingface_hub" "safetensors" "ane-transformers" >/dev/null 2>&1
"$PYTHON" -m pip install 'protobuf<4' >/dev/null 2>&1 || true
"$PYTHON" -m pip install "openai-whisper" >/dev/null 2>&1 || true

cp "$SCRIPT_DIR/convert-whisper-to-coreml.py" "$MODELS_DIR/" >/dev/null 2>&1 || true
cp "$SCRIPT_DIR/generate-coreml-model.sh" "$MODELS_DIR/" >/dev/null 2>&1 || true
chmod +x "$MODELS_DIR/generate-coreml-model.sh" 2>/dev/null || true

"$PYTHON" "$SCRIPT_DIR/whisper-coreml-validation.py"

if [ "${NO_MODELS:-false}" != "true" ]; then
  bash "$MODELS_DIR/generate-coreml-model.sh" base || true
  
  if [ -d "$MODELS_DIR/ggml-base-encoder.mlmodelc" ]; then
    echo "$p CoreML encoder ready (mlmodelc)"
  elif [ -d "$MODELS_DIR/ggml-base-encoder.mlpackage" ]; then
    echo "$p CoreML encoder ready (mlpackage)"
  elif [ -d "$MODELS_DIR/coreml-encoder-base.mlpackage" ]; then
    echo "$p CoreML encoder ready (mlpackage)"
  fi
fi

if [ ! -x "$BIN_DIR/whisper-cli-coreml" ]; then
  echo "$p whisper-cli-coreml binary not executable"
  exit 1
fi

mkdir -p build/config
cat > build/config/.coreml-env <<EOF
COREML_PYTHON=$PYTHON
COREML_VENV=$VENV_DIR
COREML_CACHE=$COREML_CACHE_DIR
COREML_TMP=$COREML_TMP_DIR
EOF

echo "$p Done"
exit 0