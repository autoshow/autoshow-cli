#!/bin/bash

# Create a timestamp for the log file
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOGFILE="setup-${TIMESTAMP}.log"
exec > >(tee -a "$LOGFILE") 2>&1

# Set up cleanup function to handle exit
cleanup_log() {
  local status=$?
  if [ "$status" -eq 0 ]; then
    rm -f "$LOGFILE"
  else
    echo ""
    echo "============================================================"
    echo "ERROR: Script failed (exit code $status)."
    echo "Logs have been saved in: $LOGFILE"
    echo "============================================================"
  fi
  exit $status
}
trap cleanup_log EXIT

# Enable strict mode
set -euo pipefail

# Check OS type
IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
  *)
    echo "Unsupported OS: $OSTYPE (only macOS is supported)."
    exit 1
    ;;
esac

# Utility functions
quiet_brew_install() {
  local pkg="$1"
  if ! brew list --formula | grep -qx "$pkg"; then
    echo "Installing $pkg (silent)..."
    brew install "$pkg" &>/dev/null
  else
    echo "$pkg is already installed."
  fi
}

command_exists() { 
  command -v "$1" &>/dev/null
}

ensure_homebrew() {
  if ! command_exists brew; then
    echo "Homebrew not found! Please install from https://brew.sh/ then rerun."
    exit 1
  fi
}

# Setup .env and install npm dependencies
if [ -f ".env" ]; then
  echo ".env file already exists, skipping copy."
else
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "Loading environment variables from .env..."
set -a
source .env
set +a

echo "Installing npm dependencies..."
npm install

# Setup Homebrew packages (macOS only)
if [ "$IS_MAC" != true ]; then
  echo "ERROR: This script only supports macOS."
  exit 1
fi

ensure_homebrew
echo "==> Checking required Homebrew formulae..."
echo "==> Installing required tools via Homebrew..."
quiet_brew_install "cmake"
quiet_brew_install "ffmpeg"
quiet_brew_install "graphicsmagick"
quiet_brew_install "espeak-ng"
quiet_brew_install "git"
quiet_brew_install "pkg-config"
echo ""
echo "======================================================"
echo "All required Homebrew packages have been installed."
echo "======================================================"

# Setup whisper.cpp
WHISPER_TEMP_DIR="whisper-cpp-temp"
BIN_DIR="bin"
MODELS_DIR="models"

# Create directories
echo "Creating directories..."
mkdir -p "$BIN_DIR"
mkdir -p "$MODELS_DIR"
echo "  - Created $BIN_DIR/"
echo "  - Created $MODELS_DIR/"

# Clone and build whisper.cpp in temp directory
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

# Copy required dynamic libraries if they exist
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

# List files in bin directory
echo "Contents of $BIN_DIR/:"
ls -la "$BIN_DIR/"

# Update library paths using install_name_tool
if [ "$IS_MAC" = true ]; then
  echo "Updating library paths for macOS..."
  
  # Check whisper-cli dependencies
  echo "  - Checking dependencies of whisper-cli..."
  otool -L "$BIN_DIR/whisper-cli" || true
  
  # Get the list of libraries whisper-cli depends on
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
  
  # Update inter-library dependencies
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
fi

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

# Clean up old whisper.cpp directory if it exists
if [ -d "whisper.cpp" ]; then
  echo "Removing old whisper.cpp directory..."
  rm -rf "whisper.cpp"
fi

# Final verification for whisper.cpp
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

# Setup Python environment for TTS
echo ""
echo "======================================================"
echo "Setting up Python environment for TTS..."
echo "======================================================"

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

PY=$(find_py) || {
  echo "Need Python 3.9-3.11. Install with: brew install python@3.11"
  echo "Warning: TTS features will not be available without Python setup"
  echo "You can still use whisper.cpp functionality"
  exit 0
}
echo "Using Python: $PY"

VENV="python_env"
if [[ -d $VENV ]]; then
  echo "Removing existing virtual environment"
  rm -rf "$VENV"
fi

echo "Creating virtual environment for TTS..."
"$PY" -m venv "$VENV" || {
  echo "Warning: Failed to create virtual environment"
  echo "TTS features will not be available"
  exit 0
}

pip() {
  "$VENV/bin/pip" "$@"
}

echo "Installing Python packages for TTS..."
pip install --upgrade pip
pip install "numpy<2" soundfile librosa scipy
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu || pip install torch torchaudio
pip install TTS || pip install "TTS==0.22.0" || pip install git+https://github.com/coqui-ai/TTS.git
pip install sentencepiece || pip install --only-binary :all: sentencepiece

echo "Verifying TTS installations..."
"$VENV/bin/python" - <<'PY'
import importlib,sys
for name,mod in {'Coqui':'TTS.api'}.items():
    try: importlib.import_module(mod.split('.')[0]); print(f"✓ {name}")
    except Exception as e: print(f"⚠ {name}: {e}", file=sys.stderr)
PY

echo "Downloading default Coqui model..."
"$VENV/bin/python" - <<'PY' || true
from TTS.api import TTS; TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=True)
PY

echo "Creating TTS configuration file..."
cat >.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"}}
EOF

# Wrap up
echo ""
echo "======================================================"
echo "Setup completed successfully!"
echo "======================================================"
echo "Whisper binaries are in: ./bin/"
echo "Whisper models are in: ./models/"
echo "Python TTS environment is in: ./python_env/"
echo ""
echo "You can now run your CLI commands:"
echo "  npm run as -- text --file \"content/examples/audio.mp3\""
echo "  npm run as -- tts file input/sample.md --coqui"
echo ""