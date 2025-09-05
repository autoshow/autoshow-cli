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

SETUP_MODE=""
case "${1:-}" in
  --image)
    SETUP_MODE="image"
    ;;
  --music)
    SETUP_MODE="music"
    ;;
  --transcription)
    SETUP_MODE="transcription"
    ;;
  --tts)
    SETUP_MODE="tts"
    ;;
  "")
    SETUP_MODE="base"
    ;;
  *)
    echo "$p ERROR: Invalid argument '$1'"
    echo "$p Usage: $0 [--image|--music|--transcription|--tts]"
    echo "$p   (no args): Base setup only (npm dependencies and directories)"
    echo "$p   --image: Setup image generation environment and download models"
    echo "$p   --music: Setup music generation environment and download models"
    echo "$p   --transcription: Setup transcription environment and download models"
    echo "$p   --tts: Setup TTS environment and download models"
    exit 1
    ;;
esac

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

echo "$p Starting AutoShow CLI setup (mode: $SETUP_MODE)"

echo "$p Running base setup (npm dependencies and directories)"
mkdir -p build/config
echo "$p Created build/config directory"
mkdir -p build/pyenv
echo "$p Created build/pyenv directory for Python environments"

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

SETUP_DIR=".github/setup"

case "$SETUP_MODE" in
  image)
    echo "$p Setting up image generation environment and downloading models"
    
    echo "$p Installing required Homebrew packages for image generation"
    quiet_brew_install "cmake"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up stable-diffusion.cpp"
    bash "$SETUP_DIR/image/sdcpp.sh"
    
    echo "$p Downloading image generation models"
    bash "$SETUP_DIR/image/sd1_5.sh"
    bash "$SETUP_DIR/image/sd3_5.sh"
    
    echo "$p Image generation setup completed"
    ;;
    
  music)
    echo "$p Setting up music generation environment and downloading models"
    
    echo "$p Installing required Homebrew packages for music generation"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up shared TTS environment for music generation"
    bash "$SETUP_DIR/tts/tts-env.sh"
    
    echo "$p Setting up AudioCraft"
    bash "$SETUP_DIR/music/audiocraft.sh"
    
    echo "$p Setting up Stable Audio"
    bash "$SETUP_DIR/music/stable-audio.sh"
    
    echo "$p Downloading music generation models"
    bash "$SETUP_DIR/music/models.sh"
    
    echo "$p Music generation setup completed"
    ;;
    
  transcription)
    echo "$p Setting up transcription environment and downloading models"
    
    echo "$p Installing required Homebrew packages for transcription"
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    quiet_brew_install "git"
    
    echo "$p Setting up Whisper CPU"
    bash "$SETUP_DIR/transcription/whisper.sh"
    
    echo "$p Setting up Whisper Metal"
    bash "$SETUP_DIR/transcription/whisper-metal.sh"
    
    echo "$p Setting up Whisper CoreML"
    bash "$SETUP_DIR/transcription/whisper-coreml.sh"
    
    echo "$p Setting up Whisper Diarization"
    bash "$SETUP_DIR/transcription/whisper-diarization.sh"
    
    echo "$p Downloading transcription models"
    bash "$SETUP_DIR/transcription/models.sh"
    
    echo "$p Transcription setup completed"
    ;;
    
  tts)
    echo "$p Setting up TTS environment and downloading models"
    
    echo "$p Installing required Homebrew packages for TTS"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "espeak-ng"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up shared TTS environment"
    bash "$SETUP_DIR/tts/tts-env.sh"
    
    echo "$p Setting up Kitten TTS"
    bash "$SETUP_DIR/tts/kitten.sh"
    
    echo "$p Setting up Coqui TTS"
    bash "$SETUP_DIR/tts/coqui.sh"
    
    echo "$p Downloading TTS models"
    bash "$SETUP_DIR/tts/models.sh"
    
    echo "$p TTS setup completed"
    ;;
    
  base)
    echo "$p Base setup completed (npm dependencies and directories only)"
    echo "$p Run with --image, --music, --transcription, or --tts to set up specific features"
    ;;
esac

echo "$p Setup completed successfully"