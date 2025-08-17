#!/bin/bash

set -euo pipefail

echo "Setting up whisper.cpp transcription tools..."

WHISPER_TEMP_DIR="whisper-cpp-temp"
BIN_DIR="bin"
MODELS_DIR="models"
VENV_DIR="$MODELS_DIR/coreml_env"

mkdir -p "$BIN_DIR" "$MODELS_DIR"

if [ -d "$WHISPER_TEMP_DIR" ]; then
  rm -rf "$WHISPER_TEMP_DIR"
fi

echo "Cloning whisper.cpp..."
git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_TEMP_DIR" &>/dev/null

echo "Building whisper.cpp..."
cmake -B "$WHISPER_TEMP_DIR/build" -S "$WHISPER_TEMP_DIR" -DBUILD_SHARED_LIBS=OFF &>/dev/null
cmake --build "$WHISPER_TEMP_DIR/build" --config Release &>/dev/null

if [ -f "$WHISPER_TEMP_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_TEMP_DIR/build/bin/whisper-cli" "$BIN_DIR/"
  chmod +x "$BIN_DIR/whisper-cli"
else
  echo "ERROR: whisper-cli binary not found"
  exit 1
fi

for lib_dir in "$WHISPER_TEMP_DIR/build/src" "$WHISPER_TEMP_DIR/build/ggml/src" "$WHISPER_TEMP_DIR/build/ggml/src/ggml-metal"; do
  if [ -d "$lib_dir" ]; then
    cp "$lib_dir"/*.dylib "$BIN_DIR/" 2>/dev/null || true
  fi
done

LIBS=$(otool -L "$BIN_DIR/whisper-cli" 2>/dev/null | grep -E "(libwhisper|libggml)" | awk '{print $1}' || true)

if [ -n "$LIBS" ]; then
  for lib in $LIBS; do
    libname=$(basename "$lib")
    if [ -f "$BIN_DIR/$libname" ]; then
      install_name_tool -change "$lib" "@executable_path/$libname" "$BIN_DIR/whisper-cli" || true
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

cp ".github/setup/download-ggml-model.sh" "$MODELS_DIR/"
chmod +x "$MODELS_DIR/download-ggml-model.sh"

echo "Downloading whisper models..."
cd "$MODELS_DIR"
bash ./download-ggml-model.sh tiny &>/dev/null
bash ./download-ggml-model.sh base &>/dev/null
cd ..

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

if [ "$IS_MAC" = true ]; then
  echo "Setting up CoreML build..."
  
  find_py() {
    for p in python3.{11..9} python3 /usr/local/bin/python3.{11..9} /opt/homebrew/bin/python3.{11..9} python; do
      if command -v "$p" &>/dev/null; then
        v=$("$p" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
        if [[ $v =~ 3\.(9|10|11) ]]; then
          echo "$p"
          return 0
        fi
      fi
    done
    return 1
  }
  
  cmake -B "$WHISPER_TEMP_DIR/build" -S "$WHISPER_TEMP_DIR" -DGGML_METAL=ON -DWHISPER_COREML=ON -DBUILD_SHARED_LIBS=OFF &>/dev/null
  cmake --build "$WHISPER_TEMP_DIR/build" --config Release &>/dev/null
  
  if [ -f "$WHISPER_TEMP_DIR/build/bin/whisper-cli" ]; then
    cp "$WHISPER_TEMP_DIR/build/bin/whisper-cli" "$BIN_DIR/whisper-cli-coreml"
    chmod +x "$BIN_DIR/whisper-cli-coreml"
  else
    echo "ERROR: CoreML whisper-cli binary not found"
    exit 1
  fi
  
  PY=$(find_py) || {
    echo "ERROR: Python 3.9-3.11 required for CoreML"
    exit 1
  }
  
  if [ ! -d "$VENV_DIR" ]; then
    "$PY" -m venv "$VENV_DIR"
  fi
  
  PIP="$VENV_DIR/bin/pip"
  
  echo "Installing CoreML dependencies..."
  "$PIP" install --upgrade pip setuptools wheel >/dev/null
  "$PIP" install "numpy<2" >/dev/null || "$PIP" install "numpy<2" -U >/dev/null
  "$PIP" install "torch==2.5.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null || "$PIP" install "torch==2.5.0" >/dev/null
  "$PIP" install "coremltools>=7,<8" "transformers" "sentencepiece" "huggingface_hub" "safetensors" "ane-transformers" >/dev/null
  "$PIP" install 'protobuf<4' >/dev/null || true
  "$PIP" install "openai-whisper" >/dev/null || true
  
  cp ".github/setup/convert-whisper-to-coreml.py" "$MODELS_DIR/"
  cp ".github/setup/generate-coreml-model.sh" "$MODELS_DIR/"
  chmod +x "$MODELS_DIR/generate-coreml-model.sh"
  
  echo "Testing CoreML conversion environment..."
  "$VENV_DIR/bin/python" - <<'PY'
missing=[]
mods=["torch","coremltools","numpy","transformers","sentencepiece","huggingface_hub","ane_transformers","safetensors","whisper"]
for m in mods:
    try:
        __import__(m)
    except Exception as e:
        missing.append(f"{m}:{e}")
if missing:
    raise SystemExit("Missing modules: "+", ".join(missing))
print("✓ CoreML conversion Python deps OK")
PY
fi

rm -rf "$WHISPER_TEMP_DIR"

if [ -d "whisper.cpp" ]; then
  rm -rf "whisper.cpp"
fi

if [ -x "$BIN_DIR/whisper-cli" ] && [ -f "$MODELS_DIR/ggml-tiny.bin" ] && [ -f "$MODELS_DIR/ggml-base.bin" ]; then
  echo "Transcription setup completed successfully!"
else
  echo "ERROR: Setup verification failed"
  exit 1
fi