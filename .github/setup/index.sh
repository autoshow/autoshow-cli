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
p='[setup/index]'
IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
  *) echo "$p ERROR: Only macOS is supported"; exit 1 ;;
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
    echo "$p ERROR: Homebrew not found. Install from https://brew.sh/"
    exit 1
  fi
}
echo "$p Starting AutoShow CLI setup"
mkdir -p config
echo "$p Created config directory"
mkdir -p pyenv
echo "$p Created pyenv directory for Python environments"
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
fi
if [ -f ".env" ]; then
  echo "$p Loading environment from .env"
  set -a
  . ./.env
  set +a
  if [ -n "${HF_TOKEN:-}" ]; then
    echo "$p Detected HF_TOKEN starting with ${HF_TOKEN:0:8}..."
  fi
fi
npm install
if [ "$IS_MAC" != true ]; then
  echo "$p ERROR: This script only supports macOS"
  exit 1
fi
ensure_homebrew
echo "$p Installing required Homebrew packages"
quiet_brew_install "cmake"
quiet_brew_install "ffmpeg"
quiet_brew_install "graphicsmagick"
quiet_brew_install "espeak-ng"
quiet_brew_install "git"
quiet_brew_install "pkg-config"
SETUP_DIR=".github/setup"
echo "$p Running transcription package setup"
bash "$SETUP_DIR/transcription/whisper.sh"
echo "$p Running transcription Metal model setup"
bash "$SETUP_DIR/transcription/whisper-metal.sh"
echo "$p Running transcription CoreML model setup"
bash "$SETUP_DIR/transcription/whisper-coreml.sh"
echo "$p Preparing shared TTS environment"
bash "$SETUP_DIR/tts/tts-env.sh"
echo "$p Installing Kitten TTS into shared environment"
bash "$SETUP_DIR/tts/kitten.sh"
echo "$p Installing Coqui TTS into shared environment"
bash "$SETUP_DIR/tts/coqui.sh"
echo "$p Installing AudioCraft for music generation"
bash "$SETUP_DIR/music/audiocraft.sh"
echo "$p Installing Stable Audio for music generation"
bash "$SETUP_DIR/music/stable-audio.sh"
echo "$p Building stable-diffusion.cpp package"
bash "$SETUP_DIR/image/sdcpp.sh"
echo "$p Downloading SD 1.5 models"
bash "$SETUP_DIR/image/sd1_5.sh"
echo "$p Downloading SD 3.5 models and encoders"
bash "$SETUP_DIR/image/sd3_5.sh"
echo "$p Setting up Wan2.1 video models"
bash "$SETUP_DIR/video/wan.sh"
echo "$p Setup completed successfully"