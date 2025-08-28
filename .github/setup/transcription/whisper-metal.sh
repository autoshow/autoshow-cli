#!/bin/bash
set -euo pipefail
p='[setup/transcription/whisper-metal]'
IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac
if [ "$IS_MAC" != true ]; then
  echo "$p Skipping Metal build on non-macOS"
  exit 0
fi
WHISPER_DIR="whisper-cpp-temp-metal"
BIN_DIR="build/bin"
MODELS_DIR="build/models"
mkdir -p "$BIN_DIR" "$MODELS_DIR"
rm -rf "$WHISPER_DIR"
git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR" >/dev/null 2>&1
cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DGGML_METAL=ON -DBUILD_SHARED_LIBS=OFF >/dev/null 2>&1
cmake --build "$WHISPER_DIR/build" --config Release >/dev/null 2>&1
if [ -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/bin/whisper-cli" "$BIN_DIR/whisper-cli-metal"
  chmod +x "$BIN_DIR/whisper-cli-metal"
else
  echo "$p ERROR: Metal whisper-cli not found"
  exit 1
fi
bash ".github/setup/transcription/download-ggml-model.sh" base "$MODELS_DIR" >/dev/null 2>&1 || true
if [ ! -f "$MODELS_DIR/ggml-base.bin" ]; then
  echo "$p ERROR: ggml-base.bin not found"
  exit 1
fi
rm -rf "$WHISPER_DIR"
echo "$p Done"