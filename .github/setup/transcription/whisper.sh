#!/bin/bash
set -euo pipefail
p='[setup/transcription/whisper]'
WHISPER_DIR="whisper-cpp-temp"
BIN_DIR="build/bin"
mkdir -p "$BIN_DIR"
rm -rf "$WHISPER_DIR"
git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR" >/dev/null 2>&1
cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DBUILD_SHARED_LIBS=OFF >/dev/null 2>&1
cmake --build "$WHISPER_DIR/build" --config Release >/dev/null 2>&1
if [ -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/bin/whisper-cli" "$BIN_DIR/"
  chmod +x "$BIN_DIR/whisper-cli"
else
  echo "$p ERROR: whisper-cli binary not found"
  exit 1
fi
for lib_dir in "$WHISPER_DIR/build/src" "$WHISPER_DIR/build/ggml/src" "$WHISPER_DIR/build/ggml/src/ggml-metal"; do
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
rm -rf "$WHISPER_DIR"
echo "$p Done"