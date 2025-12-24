#!/bin/bash
set -euo pipefail
p='[setup/transcription/whisper]'

# Enhanced error handling
error_handler() {
  local line=$1
  local command="$2"
  echo "$p ERROR: Command failed at line $line: $command" >&2
  exit 1
}
trap 'error_handler ${LINENO} "$BASH_COMMAND"' ERR

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

WHISPER_DIR="whisper-cpp-temp"
BIN_DIR="build/bin"
MODELS_DIR="build/models"
TMP_LOG="/tmp/whisper-build-$$.log"

mkdir -p "$BIN_DIR" "$MODELS_DIR"

rm -rf "$WHISPER_DIR"
echo "$p Cloning whisper.cpp repository..."
if ! git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR" > "$TMP_LOG" 2>&1; then
  echo "$p ERROR: Failed to clone whisper.cpp repository"
  cat "$TMP_LOG"
  rm -f "$TMP_LOG"
  exit 1
fi

echo "$p Configuring build with CMake..."
if [ "$IS_MAC" = true ]; then
  if ! cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DGGML_METAL=ON -DBUILD_SHARED_LIBS=OFF > "$TMP_LOG" 2>&1; then
    echo "$p ERROR: CMake configuration failed"
    cat "$TMP_LOG"
    rm -f "$TMP_LOG"
    exit 1
  fi
else
  if ! cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DBUILD_SHARED_LIBS=OFF > "$TMP_LOG" 2>&1; then
    echo "$p ERROR: CMake configuration failed"
    cat "$TMP_LOG"
    rm -f "$TMP_LOG"
    exit 1
  fi
fi

echo "$p Building whisper.cpp (this may take a few minutes)..."
if ! cmake --build "$WHISPER_DIR/build" --config Release > "$TMP_LOG" 2>&1; then
  echo "$p ERROR: Build failed"
  cat "$TMP_LOG"
  rm -f "$TMP_LOG"
  exit 1
fi
rm -f "$TMP_LOG"

echo "$p Installing whisper-cli binary..."

echo "$p Installing whisper-cli binary..."

if [ -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/bin/whisper-cli" "$BIN_DIR/"
  chmod +x "$BIN_DIR/whisper-cli"
  echo "$p Successfully installed whisper-cli"
elif [ -f "$WHISPER_DIR/build/whisper-cli" ]; then
  cp "$WHISPER_DIR/build/whisper-cli" "$BIN_DIR/"
  chmod +x "$BIN_DIR/whisper-cli"
  echo "$p Successfully installed whisper-cli (legacy path)"
else
  echo "$p ERROR: whisper-cli binary not found in expected locations:"
  echo "$p   - $WHISPER_DIR/build/bin/whisper-cli"
  echo "$p   - $WHISPER_DIR/build/whisper-cli"
  ls -la "$WHISPER_DIR/build/" 2>/dev/null || echo "$p Build directory does not exist"
  exit 1
fi

echo "$p Copying shared libraries..."

for lib_dir in "$WHISPER_DIR/build/src" "$WHISPER_DIR/build/ggml/src" "$WHISPER_DIR/build/ggml/src/ggml-metal"; do
  if [ -d "$lib_dir" ]; then
    cp "$lib_dir"/*.dylib "$BIN_DIR/" 2>/dev/null || true
  fi
done

if [ "$IS_MAC" = true ]; then
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
fi

echo "$p Cleaning up temporary files..."
rm -rf "$WHISPER_DIR"
echo "$p Whisper.cpp setup completed successfully"