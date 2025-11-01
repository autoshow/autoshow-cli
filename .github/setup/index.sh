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
    echo "Last 20 lines of log:"
    tail -n 20 "$LOGFILE"
  fi
  exit $status
}
trap cleanup_log EXIT

set -euo pipefail
p='[setup/index]'

SETUP_MODE=""
case "${1:-}" in
  --transcription)
    SETUP_MODE="transcription"
    ;;
  --whisper)
    SETUP_MODE="whisper"
    ;;
  --whisper-coreml)
    SETUP_MODE="whisper-coreml"
    ;;
  --whisper-diarization)
    SETUP_MODE="whisper-diarization"
    ;;
  --tts)
    SETUP_MODE="tts"
    ;;
  "")
    SETUP_MODE="base"
    ;;
  *)
    echo "$p Invalid argument '$1'"
    echo "$p Usage: $0 [--transcription|--whisper|--whisper-coreml|--whisper-diarization|--tts]"
    exit 1
    ;;
esac

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
  *) echo "$p Only macOS is supported"; exit 1 ;;
esac

quiet_brew_install() {
  local pkg="$1"
  if ! brew list --formula | grep -qx "$pkg"; then
    echo "$p Installing $pkg..."
    brew install "$pkg"
  fi
}

command_exists() {
  command -v "$1" &>/dev/null
}

ensure_homebrew() {
  if ! command_exists brew; then
    echo "$p Homebrew not found. Install from https://brew.sh/"
    exit 1
  fi
}

echo "$p Starting AutoShow CLI setup (mode: $SETUP_MODE)"

mkdir -p build/config
mkdir -p build/pyenv

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
fi

if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

npm install

if [ "$IS_MAC" != true ]; then
  echo "$p This script only supports macOS"
  exit 1
fi

ensure_homebrew

SETUP_DIR=".github/setup"

case "$SETUP_MODE" in
  transcription)
    echo "$p Setting up all transcription environments"
    
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    quiet_brew_install "git"
    
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/coreml/whisper-coreml.sh"
    bash "$SETUP_DIR/transcription/diarization/whisper-diarization.sh"
    bash "$SETUP_DIR/transcription/models.sh"
    
    echo "$p Transcription setup completed"
    ;;
    
  whisper)
    echo "$p Setting up whisper"
    
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    
    echo "$p Whisper setup completed"
    ;;
    
  whisper-coreml)
    echo "$p Setting up whisper CoreML"
    
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/coreml/whisper-coreml.sh"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    bash "$SETUP_DIR/transcription/coreml/generate-coreml-model.sh" base || true
    
    echo "$p Whisper CoreML setup completed"
    ;;
    
  whisper-diarization)
    echo "$p Setting up whisper diarization"
    
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    quiet_brew_install "git"
    
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/diarization/whisper-diarization.sh"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" medium.en "./build/models"
    
    echo "$p Whisper diarization setup completed"
    ;;
    
  tts)
    echo "$p Setting up TTS"
    
    quiet_brew_install "ffmpeg"
    quiet_brew_install "espeak-ng"
    quiet_brew_install "pkg-config"
    
    bash "$SETUP_DIR/tts/tts-env.sh"
    bash "$SETUP_DIR/tts/kitten.sh"
    bash "$SETUP_DIR/tts/coqui.sh"
    bash "$SETUP_DIR/tts/models.sh"
    
    echo "$p TTS setup completed"
    ;;
    
  base)
    echo "$p Base setup completed"
    ;;
esac

echo "$p Setup completed successfully"
exit 0