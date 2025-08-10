#!/bin/bash

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOGFILE="setup-${TIMESTAMP}.log"
exec > >(tee -a "$LOGFILE") 2>&1

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

set -euo pipefail

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
  *)
    echo "Unsupported OS: $OSTYPE (only macOS is supported)."
    exit 1
    ;;
esac

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

echo "==> Starting AutoShow CLI setup process"

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

SETUP_DIR=".github/setup"

echo ""
echo "==> Setting up transcription tools..."
if [ -f "$SETUP_DIR/transcription.sh" ]; then
  bash "$SETUP_DIR/transcription.sh"
else
  echo "ERROR: Transcription setup script not found at $SETUP_DIR/transcription.sh"
  exit 1
fi

echo ""
echo "==> Setting up CoreML-accelerated whisper..."
if [ -f "$SETUP_DIR/coreml.sh" ]; then
  bash "$SETUP_DIR/coreml.sh"
else
  echo "ERROR: CoreML setup script not found at $SETUP_DIR/coreml.sh"
  exit 1
fi

echo ""
echo "==> Setting up text-to-speech tools..."
if [ -f "$SETUP_DIR/tts.sh" ]; then
  bash "$SETUP_DIR/tts.sh"
else
  echo "ERROR: TTS setup script not found at $SETUP_DIR/tts.sh"
  exit 1
fi

echo ""
echo "======================================================"
echo "Setup completed successfully!"
echo "======================================================"
echo "Whisper binaries are in: ./bin/"
echo "Whisper models are in: ./models/"
echo "CoreML Python env is in: ./models/coreml_env/"
echo "Python TTS environment is in: ./python_env/"
echo ""
echo "You can now run your CLI commands:"
echo "  npm run as -- text --file \"content/examples/audio.mp3\""
echo "  npm run as -- tts file input/sample.md --coqui"
echo ""
