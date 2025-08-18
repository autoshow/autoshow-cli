#!/bin/bash

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOGFILE="setup-${TIMESTAMP}.log"
exec > >(tee -a "$LOGFILE") 2>&1

cleanup_log() {
  local status=$?
  if [ "$status" -eq 0 ]; then
    rm -f "$LOGFILE"
  else
    echo "ERROR: Script failed (exit code $status). Logs saved in: $LOGFILE"
  fi
  exit $status
}
trap cleanup_log EXIT

set -euo pipefail

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
  *)
    echo "ERROR: Only macOS is supported"
    exit 1
    ;;
esac

quiet_brew_install() {
  local pkg="$1"
  if ! brew list --formula | grep -qx "$pkg"; then
    brew install "$pkg" &>/dev/null
  fi
}

command_exists() {
  command -v "$1" &>/dev/null
}

ensure_homebrew() {
  if ! command_exists brew; then
    echo "ERROR: Homebrew not found. Install from https://brew.sh/"
    exit 1
  fi
}

echo "Starting AutoShow CLI setup..."

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

source .env
npm install

if [ "$IS_MAC" != true ]; then
  echo "ERROR: This script only supports macOS"
  exit 1
fi

ensure_homebrew
echo "Installing required Homebrew packages..."
quiet_brew_install "cmake"
quiet_brew_install "ffmpeg"
quiet_brew_install "graphicsmagick"
quiet_brew_install "espeak-ng"
quiet_brew_install "git"
quiet_brew_install "pkg-config"

SETUP_DIR=".github/setup"

if [ -f "$SETUP_DIR/transcription-setup.sh" ]; then
  bash "$SETUP_DIR/transcription-setup.sh"
else
  echo "ERROR: Transcription setup script not found"
  exit 1
fi

if [ -f "$SETUP_DIR/tts-setup.sh" ]; then
  bash "$SETUP_DIR/tts-setup.sh"
else
  echo "ERROR: TTS setup script not found"
  exit 1
fi

if [ -d "$SETUP_DIR/image" ] && [ -f "$SETUP_DIR/image/main.sh" ]; then
  bash "$SETUP_DIR/image/main.sh"
elif [ -f "$SETUP_DIR/image-setup.sh" ]; then
  bash "$SETUP_DIR/image-setup.sh"
else
  echo "ERROR: Image setup script not found"
  exit 1
fi

echo "Setup completed successfully!"