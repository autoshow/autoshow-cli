#!/bin/bash
set -euo pipefail
p='[setup/transcription/whisper-coreml]'

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
      echo "$p CoreML compiler (coremlc) found - full Xcode is installed"
      return 0
    fi
  fi
  
  if xcode-select -p &>/dev/null 2>&1; then
    echo "$p Xcode Command Line Tools are installed but CoreML compiler not found"
    echo "$p Note: CoreML compiler (coremlc) requires the full Xcode app from the App Store"
    echo "$p Without it, CoreML models will use mlpackage format which also works but is less optimized"
    return 1
  fi
  
  echo "$p Xcode Command Line Tools not installed"
  echo "$p Installing Command Line Tools (required for compilation)..."
  xcode-select --install 2>/dev/null || {
    echo "$p Installation may already be in progress or require manual action"
  }
  
  echo "$p Waiting for installation to complete (this may take 5-10 minutes)..."
  local wait_count=0
  while ! xcode-select -p &>/dev/null 2>&1; do
    sleep 10
    wait_count=$((wait_count + 1))
    if [ $wait_count -eq 30 ]; then
      echo "$p Installation taking longer than expected. Please check the installation dialog"
    elif [ $wait_count -eq 60 ]; then
      echo "$p Timeout waiting for Command Line Tools. Please install manually with: xcode-select --install"
      return 1
    fi
  done
  
  echo "$p Command Line Tools installed successfully"
  echo "$p Note: For optimal CoreML performance, install full Xcode from the App Store"
  return 1
}

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

WHISPER_DIR="whisper-cpp-temp-coreml"
BIN_DIR="build/bin"
MODELS_DIR="build/models"
VENV_DIR="build/pyenv/coreml"

mkdir -p "$BIN_DIR" "$MODELS_DIR"

echo "$p Checking Xcode tools availability"
check_xcode_tools || true

echo "$p Building whisper-cli-coreml binary"
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
  echo "$p ERROR: CoreML whisper-cli not found"
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
echo "$p whisper-cli-coreml binary created"

echo "$p Setting up CoreML Python environment with Python 3.11"

if ! ensure_python311; then
  echo "$p ERROR: Cannot install Python 3.11, CoreML features unavailable"
  exit 1
fi

PY311=$(get_python311_path) || {
  echo "$p ERROR: Python 3.11 not found after installation"
  exit 1
}

echo "$p Using Python 3.11 at: $PY311"

if [ -d "$VENV_DIR" ]; then
  echo "$p Removing existing CoreML environment"
  chmod -R u+w "$VENV_DIR" 2>/dev/null || true
  rm -rf "$VENV_DIR" 2>/dev/null || {
    echo "$p WARNING: Could not remove existing environment completely"
    mv "$VENV_DIR" "${VENV_DIR}.backup.$(date +%s)" 2>/dev/null || true
  }
fi

echo "$p Creating CoreML environment with Python 3.11"
"$PY311" -m venv "$VENV_DIR" || {
  echo "$p ERROR: Failed to create virtual environment with Python 3.11"
  exit 1
}

PIP="$VENV_DIR/bin/pip"
PYTHON="$VENV_DIR/bin/python"

echo "$p Upgrading pip and installing core dependencies"
"$PIP" install --upgrade pip setuptools wheel >/dev/null 2>&1

echo "$p Installing numpy and core ML dependencies"
"$PIP" install "numpy<2" >/dev/null 2>&1 || "$PIP" install "numpy<2" -U >/dev/null 2>&1

echo "$p Installing PyTorch for CoreML"
"$PIP" install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || "$PIP" install "torch==2.2.0" >/dev/null 2>&1

echo "$p Installing CoreML and ML dependencies"
"$PIP" install "coremltools>=7,<8" "transformers" "sentencepiece" "huggingface_hub" "safetensors" "ane-transformers" >/dev/null 2>&1

echo "$p Installing protobuf and whisper"
"$PIP" install 'protobuf<4' >/dev/null 2>&1 || true
"$PIP" install "openai-whisper" >/dev/null 2>&1 || true

cp ".github/setup/transcription/convert-whisper-to-coreml.py" "$MODELS_DIR/" >/dev/null 2>&1 || true
cp ".github/setup/transcription/generate-coreml-model.sh" "$MODELS_DIR/" >/dev/null 2>&1 || true
chmod +x "$MODELS_DIR/generate-coreml-model.sh" 2>/dev/null || true

echo "$p Validating CoreML environment dependencies"
"$PYTHON" - <<'PY'
missing=[]
mods=["torch","coremltools","numpy","transformers","sentencepiece","huggingface_hub","ane_transformers","safetensors","whisper"]
for m in mods:
    try:
        __import__(m)
    except Exception as e:
        missing.append(f"{m}:{e}")
if missing:
    raise SystemExit("Missing modules: "+", ".join(missing))
print("CoreML environment validation successful")
PY

if [ "${NO_MODELS:-false}" != "true" ]; then
  echo "$p Generating base CoreML model"
  
  GENERATE_RESULT=0
  bash "$MODELS_DIR/generate-coreml-model.sh" base || GENERATE_RESULT=$?
  
  if [ $GENERATE_RESULT -ne 0 ]; then
    echo "$p WARNING: Model generation returned code $GENERATE_RESULT, checking artifacts"
  fi

  if [ -d "$MODELS_DIR/ggml-base-encoder.mlmodelc" ]; then
    echo "$p CoreML encoder ready (compiled mlmodelc format)"
  elif [ -d "$MODELS_DIR/ggml-base-encoder.mlpackage" ]; then
    echo "$p CoreML encoder ready (mlpackage format - works but less optimized)"
    echo "$p For better performance, install full Xcode from App Store to compile to mlmodelc"
  elif [ -d "$MODELS_DIR/coreml-encoder-base.mlpackage" ]; then
    echo "$p CoreML encoder ready (mlpackage format - works but less optimized)"
    echo "$p For better performance, install full Xcode from App Store to compile to mlmodelc"
  else
    echo "$p WARNING: CoreML encoder artifact not detected after generation"
    ls -la "$MODELS_DIR/" | grep -E "(mlmodelc|mlpackage)" || echo "$p No CoreML artifacts found"
  fi
fi

if [ ! -x "$BIN_DIR/whisper-cli-coreml" ]; then
  echo "$p ERROR: whisper-cli-coreml binary not executable"
  exit 1
fi

FINAL_PY_VERSION=$("$PYTHON" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')
echo "$p CoreML environment setup complete with Python $FINAL_PY_VERSION"
echo "$p Done"
exit 0