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
    brew install "$pkg" >/dev/null 2>&1
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

npm install >/dev/null 2>&1

if [ "$IS_MAC" != true ]; then
  echo "$p This script only supports macOS"
  exit 1
fi

ensure_homebrew

SETUP_DIR=".github/setup"

case "$SETUP_MODE" in
  transcription)
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    quiet_brew_install "git"
    
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/coreml/whisper-coreml.sh"
    bash "$SETUP_DIR/transcription/diarization/whisper-diarization.sh"
    bash "$SETUP_DIR/transcription/models.sh"
    ;;
    
  whisper)
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    ;;
    
  whisper-coreml)
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/coreml/whisper-coreml.sh"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    bash "$SETUP_DIR/transcription/coreml/generate-coreml-model.sh" base || true
    ;;
    
  whisper-diarization)
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    quiet_brew_install "git"
    
    bash "$SETUP_DIR/transcription/diarization/whisper-diarization.sh"
    ;;
    
  tts)
    quiet_brew_install "ffmpeg"
    quiet_brew_install "espeak-ng"
    quiet_brew_install "pkg-config"
    
    bash "$SETUP_DIR/tts/tts-env.sh"
    bash "$SETUP_DIR/tts/kitten.sh"
    bash "$SETUP_DIR/tts/coqui.sh"
    bash "$SETUP_DIR/tts/models.sh"
    ;;
    
  base)
    ;;
esac

echo "$p Setup completed successfully"
exit 0