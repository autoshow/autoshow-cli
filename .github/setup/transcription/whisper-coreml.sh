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

WHISPER_DIR="whisper-cpp-temp-coreml"
BIN_DIR="build/bin"
MODELS_DIR="build/models"
VENV_DIR="build/pyenv/coreml"

PY="python3"

mkdir -p "$BIN_DIR" "$MODELS_DIR"

echo "$p Building whisper-cli-coreml binary"
rm -rf "$WHISPER_DIR"
git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR" >/dev/null 2>&1

cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DGGML_METAL=ON -DWHISPER_COREML=ON -DBUILD_SHARED_LIBS=OFF >/dev/null 2>&1
cmake --build "$WHISPER_DIR/build" --config Release >/dev/null 2>&1

if [ -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/bin/whisper-cli" "$BIN_DIR/whisper-cli-coreml"
  chmod +x "$BIN_DIR/whisper-cli-coreml"
  echo "$p whisper-cli-coreml binary created"
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

echo "$p Setting up CoreML Python environment"
if [ ! -d "$VENV_DIR" ]; then
  "$PY" -m venv "$VENV_DIR"
fi

PIP="$VENV_DIR/bin/pip"
"$PIP" install --upgrade pip setuptools wheel >/dev/null
"$PIP" install "numpy<2" >/dev/null || "$PIP" install "numpy<2" -U >/dev/null
"$PIP" install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null || "$PIP" install "torch==2.2.0" >/dev/null
"$PIP" install "coremltools>=7,<8" "transformers" "sentencepiece" "huggingface_hub" "safetensors" "ane-transformers" >/dev/null
"$PIP" install 'protobuf<4' >/dev/null || true
"$PIP" install "openai-whisper" >/dev/null || true

cp ".github/setup/transcription/convert-whisper-to-coreml.py" "$MODELS_DIR/" >/dev/null 2>&1 || true
cp ".github/setup/transcription/generate-coreml-model.sh" "$MODELS_DIR/" >/dev/null 2>&1 || true
chmod +x "$MODELS_DIR/generate-coreml-model.sh" || true

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
print("OK")
PY

if [ "${NO_MODELS:-false}" != "true" ]; then
  bash "$MODELS_DIR/generate-coreml-model.sh" base >/dev/null 2>&1 || true

  if [ ! -d "$MODELS_DIR/ggml-base-encoder.mlmodelc" ] && [ ! -d "$MODELS_DIR/coreml-encoder-base.mlpackage" ]; then
    echo "$p WARNING: CoreML encoder artifact not detected"
  else
    echo "$p CoreML encoder ready"
  fi
fi

if [ ! -x "$BIN_DIR/whisper-cli-coreml" ]; then
  echo "$p ERROR: whisper-cli-coreml binary not executable"
  exit 1
fi

echo "$p Done"