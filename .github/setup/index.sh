#!/bin/bash
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOGFILE="setup-${TIMESTAMP}.log"
ERROR_CONTEXT=""

exec > >(tee -a "$LOGFILE") 2>&1

cleanup_log() {
  local status=$?
  exec > /dev/tty 2>&1
  
  if [ "$status" -eq 0 ]; then
    rm -f "$LOGFILE"
  else
    echo "ERROR: Script failed (exit code $status). Logs saved in: $LOGFILE"
    [ -n "$ERROR_CONTEXT" ] && echo "ERROR CONTEXT: $ERROR_CONTEXT"
    echo "Last 30 lines of log:"
    tail -n 30 "$LOGFILE" 2>/dev/null || echo "Could not read log file"
  fi
  exit $status
}
trap cleanup_log EXIT

set -euo pipefail
trap '_index_error_handler ${LINENO} "$BASH_COMMAND"' ERR
_index_error_handler() {
  echo "ERROR: Command failed at line $1: $2" >&2
  [ -n "$ERROR_CONTEXT" ] && echo "ERROR CONTEXT: $ERROR_CONTEXT" >&2
  exit 1
}

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

SETUP_MODE="${1:-base}"
case "$SETUP_MODE" in
  --transcription|--tts|--all|base) SETUP_MODE="${SETUP_MODE#--}" ;;
  *) log "Invalid argument '$1'"; log "Usage: $0 [--transcription|--tts|--all]"; exit 1 ;;
esac

PLATFORM="unknown"
case "$OSTYPE" in
  darwin*) PLATFORM="macos" ;;
  linux*) PLATFORM="linux" ;;
  msys*|cygwin*|mingw*) 
    log "Windows detected. Please use WSL."
    log "Install WSL: https://learn.microsoft.com/en-us/windows/wsl/install"
    exit 1 
    ;;
  *) log "Unsupported platform: $OSTYPE"; exit 1 ;;
esac
log "Detected platform: $PLATFORM"

log_dependency_info() {
  local dep_name="$1"
  local dep_command="${2:-$1}"
  
  if ! command -v "$dep_command" &>/dev/null; then
    log "$dep_name: not installed"
    return
  fi
  
  local location version
  location=$(which "$dep_command" 2>/dev/null || echo "unknown")
  
  case "$dep_command" in
    node) version=$(node --version 2>/dev/null || echo "unknown") ;;
    npm) version=$(npm --version 2>/dev/null || echo "unknown") ;;
    ffmpeg) version=$(ffmpeg -version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "unknown") ;;
    cmake) version=$(cmake --version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "unknown") ;;
    git) version=$(git --version 2>/dev/null | awk '{print $3}' || echo "unknown") ;;
    yt-dlp) version=$(yt-dlp --version 2>/dev/null || echo "unknown") ;;
    python3.11) version=$(python3.11 --version 2>/dev/null | awk '{print $2}' || echo "unknown") ;;
    brew) version=$(brew --version 2>/dev/null | head -n 1 | awk '{print $2}' || echo "unknown") ;;
    *) version=$("$dep_command" --version 2>/dev/null | head -n 1 | awk '{print $NF}' || echo "unknown") ;;
  esac
  
  log "$dep_name: $version (location: $location)"
}

check_and_update_ytdlp() {
  if ! command -v yt-dlp &>/dev/null; then
    log "Installing yt-dlp..."
    if [ "$PLATFORM" = "macos" ]; then
      quiet_brew_install "yt-dlp"
    elif command -v pip3 &>/dev/null; then
      pip3 install --user yt-dlp >/dev/null 2>&1 || quiet_linux_install "yt-dlp" || \
        log "WARNING: Could not install yt-dlp. Please install manually: pip3 install yt-dlp"
    else
      quiet_linux_install "yt-dlp" || \
        log "WARNING: Could not install yt-dlp. Please install manually: pip3 install yt-dlp"
    fi
    log_dependency_info "yt-dlp"
    return
  fi

  if [ "$PLATFORM" = "macos" ]; then
    local current latest
    current=$(yt-dlp --version 2>/dev/null | sed 's/\.0\([0-9]\)/.\1/g' || echo "0")
    latest=$(brew info yt-dlp 2>/dev/null | grep -m 1 "yt-dlp:" | awk '{print $4}' | sed 's/\.0\([0-9]\)/.\1/g' || echo "0")
    
    if [ "$current" != "$latest" ] && [ "$latest" != "0" ]; then
      log "Updating yt-dlp..."
      brew upgrade yt-dlp >/dev/null 2>&1 || quiet_brew_install "yt-dlp"
    fi
  fi
  log_dependency_info "yt-dlp"
}

install_deps() {
  for pkg in "$@"; do
    install_pkg "$pkg"
    local display_name
    case "$pkg" in
      cmake) display_name="CMake" ;;
      ffmpeg) display_name="FFmpeg" ;;
      pkg-config) display_name="pkg-config" ;;
      git) display_name="Git" ;;
      espeak-ng) display_name="eSpeak NG" ;;
      *) display_name="$pkg" ;;
    esac
    log_dependency_info "$display_name" "$pkg"
  done
}

setup_transcription() {
  log "Setting up transcription dependencies..."
  install_deps cmake ffmpeg pkg-config git
  
  if [ "$PLATFORM" = "macos" ]; then
    log "Building Whisper.cpp with CoreML acceleration..."
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/coreml/whisper-coreml.sh"
    bash "$SETUP_DIR/transcription/models.sh"
  else
    log "Building Whisper.cpp..."
    bash "$SETUP_DIR/transcription/whisper.sh"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
  fi
}

setup_tts() {
  log "Setting up Text-to-Speech dependencies..."
  install_deps ffmpeg espeak-ng pkg-config
  bash "$SETUP_DIR/tts/tts-env.sh"
  bash "$SETUP_DIR/tts/kitten.sh"
  bash "$SETUP_DIR/tts/coqui.sh"
  bash "$SETUP_DIR/tts/qwen3.sh"
  bash "$SETUP_DIR/tts/models.sh"
}

ensure_build_dirs

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  log "Created .env file from .env.example"
fi

[ -f ".env" ] && { set -a; . ./.env; set +a; }

log "Installing Node.js dependencies..."
bun install >/dev/null 2>&1
log "Node.js dependencies installed"

log "Checking system dependencies..."
if [ "$PLATFORM" = "macos" ]; then
  command -v brew &>/dev/null || { log "Homebrew not found. Install from https://brew.sh/"; exit 1; }
  log_dependency_info "Homebrew" "brew"
fi
log_dependency_info "Node.js" "node"
log_dependency_info "npm"
check_and_update_ytdlp

SETUP_DIR=".github/setup"

case "$SETUP_MODE" in
  transcription) setup_transcription ;;
  tts) setup_tts ;;
  all)
    log "Setting up all features (transcription + TTS)..."
    setup_transcription
    setup_tts
    ;;
  base) log "Base setup completed - core dependencies verified" ;;
esac

log "Setup completed successfully"
