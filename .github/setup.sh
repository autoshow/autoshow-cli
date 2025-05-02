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
echo ""
echo "======================================================"
echo "All required Homebrew packages have been installed."
echo "The application is now set up to run in CLI mode."
echo "======================================================"

# Setup whisper.cpp
if [ -d "whisper.cpp" ]; then
  echo "whisper.cpp already exists, skipping."
else
  echo "Cloning whisper.cpp..."
  git clone https://github.com/ggerganov/whisper.cpp.git &>/dev/null
  echo "Downloading whisper models (tiny, base, large-v3-turbo)..."
  bash ./whisper.cpp/models/download-ggml-model.sh tiny &>/dev/null
  bash ./whisper.cpp/models/download-ggml-model.sh base &>/dev/null
  bash ./whisper.cpp/models/download-ggml-model.sh large-v3-turbo &>/dev/null
  echo "Compiling whisper.cpp..."
  cmake -B whisper.cpp/build -S whisper.cpp &>/dev/null
  cmake --build whisper.cpp/build --config Release &>/dev/null
  rm -rf whisper.cpp/.git
fi

# Wrap up
echo ""
echo "Setup completed successfully!"
echo "You can now run your CLI commands:"
echo "  npm run as -- --file \"content/examples/audio.mp3\""
echo ""