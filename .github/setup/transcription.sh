#!/bin/bash

set -euo pipefail

echo "Setting up whisper.cpp transcription tools..."

WHISPER_TEMP_DIR="whisper-cpp-temp"
BIN_DIR="bin"
MODELS_DIR="models"

echo "Creating directories..."
mkdir -p "$BIN_DIR"
mkdir -p "$MODELS_DIR"
echo "  - Created $BIN_DIR/"
echo "  - Created $MODELS_DIR/"

if [ -d "$WHISPER_TEMP_DIR" ]; then
  echo "Removing existing temporary whisper.cpp directory..."
  rm -rf "$WHISPER_TEMP_DIR"
fi

echo "Cloning whisper.cpp into temporary directory..."
git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_TEMP_DIR" &>/dev/null

echo "Building whisper.cpp with static linking..."
echo "  - Running cmake configuration..."
cmake -B "$WHISPER_TEMP_DIR/build" -S "$WHISPER_TEMP_DIR" -DBUILD_SHARED_LIBS=OFF &>/dev/null
echo "  - Building whisper.cpp..."
cmake --build "$WHISPER_TEMP_DIR/build" --config Release &>/dev/null
echo "  - Build completed successfully"

echo "Extracting whisper-cli binary..."
if [ -f "$WHISPER_TEMP_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_TEMP_DIR/build/bin/whisper-cli" "$BIN_DIR/"
  chmod +x "$BIN_DIR/whisper-cli"
  echo "  - Copied whisper-cli to $BIN_DIR/"
else
  echo "ERROR: whisper-cli binary not found at expected location!"
  exit 1
fi

echo "Checking for required dynamic libraries..."
echo "  - Looking in $WHISPER_TEMP_DIR/build/src/"
if [ -f "$WHISPER_TEMP_DIR/build/src/libwhisper.dylib" ]; then
  echo "  - Found libwhisper.dylib, copying..."
  cp "$WHISPER_TEMP_DIR/build/src/libwhisper."*.dylib "$BIN_DIR/" 2>/dev/null || true
else
  echo "  - No libwhisper.dylib found (may be statically linked)"
fi

echo "  - Looking in $WHISPER_TEMP_DIR/build/ggml/src/"
if [ -f "$WHISPER_TEMP_DIR/build/ggml/src/libggml.dylib" ]; then
  echo "  - Found libggml.dylib, copying..."
  cp "$WHISPER_TEMP_DIR/build/ggml/src/libggml."*.dylib "$BIN_DIR/" 2>/dev/null || true
else
  echo "  - No libggml.dylib found (may be statically linked)"
fi

echo "  - Looking in $WHISPER_TEMP_DIR/build/ggml/src/ggml-metal/"
if [ -f "$WHISPER_TEMP_DIR/build/ggml/src/ggml-metal/libggml-metal.dylib" ]; then
  echo "  - Found libggml-metal.dylib, copying..."
  cp "$WHISPER_TEMP_DIR/build/ggml/src/ggml-metal/libggml-metal."*.dylib "$BIN_DIR/" 2>/dev/null || true
else
  echo "  - No libggml-metal.dylib found (may be statically linked)"
fi

echo "Contents of $BIN_DIR/:"
ls -la "$BIN_DIR/"

echo "Updating library paths for macOS..."

echo "  - Checking dependencies of whisper-cli..."
otool -L "$BIN_DIR/whisper-cli" || true

echo "  - Extracting library dependencies..."
LIBS=$(otool -L "$BIN_DIR/whisper-cli" 2>/dev/null | grep -E "(libwhisper|libggml)" | awk '{print $1}' || true)

if [ -z "$LIBS" ]; then
  echo "  - No dynamic library dependencies found (likely statically linked)"
else
  echo "  - Found library dependencies:"
  echo "$LIBS"
  
  for lib in $LIBS; do
    libname=$(basename "$lib")
    echo "  - Processing dependency: $lib"
    if [ -f "$BIN_DIR/$libname" ]; then
      echo "    - Updating path to @executable_path/$libname"
      install_name_tool -change "$lib" "@executable_path/$libname" "$BIN_DIR/whisper-cli" || {
        echo "    - Warning: Failed to update library path"
      }
    else
      echo "    - Library not found in $BIN_DIR/, skipping"
    fi
  done
fi

echo "  - Checking for inter-library dependencies..."
for dylib in "$BIN_DIR"/*.dylib; do
  if [ -f "$dylib" ]; then
    echo "  - Processing library: $(basename "$dylib")"
    DEPS=$(otool -L "$dylib" 2>/dev/null | grep -E "(libwhisper|libggml)" | awk '{print $1}' || true)
    for dep in $DEPS; do
      depname=$(basename "$dep")
      if [ -f "$BIN_DIR/$depname" ] && [ "$depname" != "$(basename "$dylib")" ]; then
        echo "    - Updating dependency $dep to @loader_path/$depname"
        install_name_tool -change "$dep" "@loader_path/$depname" "$dylib" || {
          echo "    - Warning: Failed to update library dependency"
        }
      fi
    done
  fi
done

echo "Copying model download script..."
cp "$WHISPER_TEMP_DIR/models/download-ggml-model.sh" "$MODELS_DIR/"
chmod +x "$MODELS_DIR/download-ggml-model.sh"
echo "  - Copied download script to $MODELS_DIR/"

echo "Downloading whisper models (tiny, base)..."
cd "$MODELS_DIR"
echo "  - Downloading tiny model..."
bash ./download-ggml-model.sh tiny &>/dev/null
echo "  - Downloading base model..."
bash ./download-ggml-model.sh base &>/dev/null
cd ..
echo "  - Models downloaded successfully"

echo "Cleaning up temporary whisper.cpp directory..."
rm -rf "$WHISPER_TEMP_DIR"

if [ -d "whisper.cpp" ]; then
  echo "Removing old whisper.cpp directory..."
  rm -rf "whisper.cpp"
fi

echo ""
echo "Verifying whisper.cpp installation..."
echo "  - Checking whisper-cli binary..."
if [ -x "$BIN_DIR/whisper-cli" ]; then
  echo "    ✓ whisper-cli is executable"
else
  echo "    ✗ whisper-cli is not executable"
  exit 1
fi

echo "  - Checking models..."
if [ -f "$MODELS_DIR/ggml-tiny.bin" ] && [ -f "$MODELS_DIR/ggml-base.bin" ]; then
  echo "    ✓ Models downloaded successfully"
else
  echo "    ✗ Models not found"
  exit 1
fi

echo "Transcription setup completed successfully!"