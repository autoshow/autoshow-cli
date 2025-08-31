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

is_base_setup_complete() {
  local check_p="$p[BaseSetupCheck]"
  
  echo "$check_p Checking if base setup is already complete"
  
  if [ ! -d "build" ]; then
    echo "$check_p Missing build directory"
    return 1
  fi

  if [ ! -d "build/bin" ] || [ ! -d "build/config" ] || [ ! -d "build/pyenv" ]; then
    echo "$check_p Missing core build directories"
    return 1
  fi

  if [ ! -f "build/bin/whisper-cli" ] || [ ! -x "build/bin/whisper-cli" ]; then
    echo "$check_p Missing or non-executable whisper-cli binary"
    return 1
  fi

  if [ ! -f "build/bin/sd" ] || [ ! -x "build/bin/sd" ]; then
    echo "$check_p Missing or non-executable sd binary"
    return 1
  fi

  if [ ! -d "build/pyenv/tts" ] || [ ! -x "build/pyenv/tts/bin/python" ]; then
    echo "$check_p Missing or incomplete TTS Python environment"
    return 1
  fi

  if [ ! -d "build/pyenv/hunyuan" ] || [ ! -x "build/pyenv/hunyuan/bin/python" ]; then
    echo "$check_p Missing or incomplete HunyuanVideo Python environment"
    return 1
  fi

  if [ ! -f "build/config/.tts-config.json" ] || [ ! -f "build/config/.music-config.json" ] || [ ! -f "build/config/.hunyuan-config.json" ]; then
    echo "$check_p Missing core configuration files"
    return 1
  fi

  if [ ! -d "node_modules" ]; then
    echo "$check_p Missing node_modules directory"
    return 1
  fi

  echo "$check_p Base setup appears complete"
  return 0
}

SETUP_MODE=""
case "${1:-}" in
  --all)
    SETUP_MODE="all"
    ;;
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
  --video)
    SETUP_MODE="video"
    ;;
  "")
    SETUP_MODE="base"
    ;;
  *)
    echo "$p ERROR: Invalid argument '$1'"
    echo "$p Usage: $0 [--all|--image|--music|--transcription|--tts|--video]"
    echo "$p   (no args): Base setup only (binaries and environments)"
    echo "$p   --all: Complete setup with all models"
    echo "$p   --image: Base setup + image generation models"
    echo "$p   --music: Base setup + music generation models"
    echo "$p   --transcription: Base setup + transcription models"
    echo "$p   --tts: Base setup + TTS models"
    echo "$p   --video: Base setup + video generation models"
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

BASE_SETUP_NEEDED=true
if [ "$SETUP_MODE" != "base" ]; then
  if is_base_setup_complete; then
    echo "$p Base setup already complete, skipping to model downloads"
    BASE_SETUP_NEEDED=false
  else
    echo "$p Base setup incomplete, running full base setup first"
    BASE_SETUP_NEEDED=true
  fi
fi

if [ "$BASE_SETUP_NEEDED" = true ]; then
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

  echo "$p Installing required Homebrew packages"
  quiet_brew_install "cmake"
  quiet_brew_install "ffmpeg"
  quiet_brew_install "graphicsmagick"
  quiet_brew_install "espeak-ng"
  quiet_brew_install "git"
  quiet_brew_install "pkg-config"

  SETUP_DIR=".github/setup"

  export NO_MODELS=true

  echo "$p Running base component setup (binaries and environments)"

  echo "$p Setting up transcription tools"
  bash "$SETUP_DIR/transcription/whisper.sh"
  bash "$SETUP_DIR/transcription/whisper-metal.sh"
  bash "$SETUP_DIR/transcription/whisper-coreml.sh"

  echo "$p Setting up TTS environment and tools"
  bash "$SETUP_DIR/tts/tts-env.sh"
  bash "$SETUP_DIR/tts/kitten.sh"
  bash "$SETUP_DIR/tts/coqui.sh"

  echo "$p Setting up music generation environment"
  bash "$SETUP_DIR/music/audiocraft.sh"
  bash "$SETUP_DIR/music/stable-audio.sh"

  echo "$p Setting up image generation tools"
  bash "$SETUP_DIR/image/sdcpp.sh"

  echo "$p Setting up video generation environment"
  bash "$SETUP_DIR/video/hunyuan.sh"
  bash "$SETUP_DIR/video/wan.sh"

  echo "$p Base setup completed"
else
  echo "$p Skipping base setup (already complete)"
fi

SETUP_DIR=".github/setup"

case "$SETUP_MODE" in
  all)
    echo "$p Downloading all models"
    bash "$SETUP_DIR/image/sd1_5.sh"
    bash "$SETUP_DIR/image/sd3_5.sh"
    bash "$SETUP_DIR/transcription/models.sh"
    bash "$SETUP_DIR/tts/models.sh"
    bash "$SETUP_DIR/music/models.sh"
    bash "$SETUP_DIR/video/models.sh"
    bash "$SETUP_DIR/video/wan.sh"
    echo "$p Complete setup with all models finished"
    ;;
  image)
    echo "$p Downloading image generation models"
    bash "$SETUP_DIR/image/sd1_5.sh"
    bash "$SETUP_DIR/image/sd3_5.sh"
    echo "$p Image generation setup completed"
    ;;
  music)
    echo "$p Downloading music generation models"
    bash "$SETUP_DIR/music/models.sh"
    echo "$p Music generation setup completed"
    ;;
  transcription)
    echo "$p Downloading transcription models"
    bash "$SETUP_DIR/transcription/models.sh"
    echo "$p Transcription setup completed"
    ;;
  tts)
    echo "$p Downloading TTS models"
    bash "$SETUP_DIR/tts/models.sh"
    echo "$p TTS setup completed"
    ;;
  video)
    echo "$p Downloading video generation models"
    bash "$SETUP_DIR/video/models.sh"
    bash "$SETUP_DIR/video/wan.sh"
    echo "$p Video generation setup completed"
    ;;
  base)
    echo "$p Base setup completed (no models downloaded)"
    echo "$p Run with --all, --image, --music, --transcription, --tts, or --video to download specific models"
    ;;
esac

echo "$p Setup completed successfully"