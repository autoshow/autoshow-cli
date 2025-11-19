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

SETUP_MODE="${1:-base}"
case "$SETUP_MODE" in
  --transcription|--whisper|--whisper-coreml|--tts|base)
    SETUP_MODE="${SETUP_MODE#--}"
    ;;
  *)
    echo "$p Invalid argument '$1'"
    echo "$p Usage: $0 [--transcription|--whisper|--whisper-coreml|--tts]"
    exit 1
    ;;
esac

case "$OSTYPE" in
  darwin*) ;;
  *) echo "$p Only macOS is supported"; exit 1 ;;
esac

log_dependency_info() {
  local dep_name="$1"
  local dep_command="${2:-$1}"
  
  if ! command -v "$dep_command" &>/dev/null; then
    echo "$p $dep_name: not installed"
    return
  fi
  
  local location version
  location=$(which "$dep_command" 2>/dev/null || echo "unknown")
  
  case "$dep_command" in
    node)
      version=$(node --version 2>/dev/null || echo "unknown")
      ;;
    npm)
      version=$(npm --version 2>/dev/null || echo "unknown")
      ;;
    ffmpeg)
      version=$(ffmpeg -version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "unknown")
      ;;
    cmake)
      version=$(cmake --version 2>/dev/null | head -n 1 | awk '{print $3}' || echo "unknown")
      ;;
    git)
      version=$(git --version 2>/dev/null | awk '{print $3}' || echo "unknown")
      ;;
    yt-dlp)
      version=$(yt-dlp --version 2>/dev/null || echo "unknown")
      ;;
    python3.11)
      version=$(python3.11 --version 2>/dev/null | awk '{print $2}' || echo "unknown")
      ;;
    brew)
      version=$(brew --version 2>/dev/null | head -n 1 | awk '{print $2}' || echo "unknown")
      ;;
    *)
      version=$("$dep_command" --version 2>/dev/null | head -n 1 | awk '{print $NF}' || echo "unknown")
      ;;
  esac
  
  echo "$p $dep_name: $version (location: $location)"
}

quiet_brew_install() {
  local pkg="$1"
  if brew list --formula | grep -qx "$pkg"; then
    echo "$p $pkg already installed"
    return
  fi
  echo "$p Installing $pkg via Homebrew..."
  brew install "$pkg" >/dev/null 2>&1
  echo "$p $pkg installed successfully"
}

check_and_update_ytdlp() {
  if ! command -v yt-dlp &>/dev/null; then
    echo "$p Installing yt-dlp..."
    quiet_brew_install "yt-dlp"
    log_dependency_info "yt-dlp"
    return
  fi

  local current_version latest_version
  current_version=$(yt-dlp --version 2>/dev/null || echo "0")
  latest_version=$(brew info yt-dlp 2>/dev/null | grep -m 1 "yt-dlp:" | awk '{print $3}' || echo "0")
  
  if [ "$current_version" != "$latest_version" ] && [ "$latest_version" != "0" ]; then
    echo "$p Updating yt-dlp from $current_version to $latest_version..."
    brew upgrade yt-dlp >/dev/null 2>&1 || quiet_brew_install "yt-dlp"
    echo "$p yt-dlp updated successfully"
  else
    echo "$p yt-dlp already at latest version"
  fi
  
  log_dependency_info "yt-dlp"
}

mkdir -p build/config
mkdir -p build/pyenv

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "$p Created .env file from .env.example"
fi

if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

echo "$p Installing Node.js dependencies..."
npm install >/dev/null 2>&1
echo "$p Node.js dependencies installed"

echo "$p Checking system dependencies..."
if ! command -v brew &>/dev/null; then
  echo "$p Homebrew not found. Install from https://brew.sh/"
  exit 1
fi
log_dependency_info "Homebrew" "brew"
log_dependency_info "Node.js" "node"
log_dependency_info "npm"
check_and_update_ytdlp

SETUP_DIR=".github/setup"

install_brew_deps() {
  for pkg in "$@"; do
    quiet_brew_install "$pkg"
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

case "$SETUP_MODE" in
  transcription)
    echo "$p Setting up transcription dependencies..."
    install_brew_deps cmake ffmpeg pkg-config git
    echo "$p Building Whisper.cpp..."
    bash "$SETUP_DIR/transcription/whisper.sh"
    echo "$p Building Whisper CoreML..."
    bash "$SETUP_DIR/transcription/coreml/whisper-coreml.sh"
    echo "$p Downloading transcription models..."
    bash "$SETUP_DIR/transcription/models.sh"
    ;;
    
  whisper)
    echo "$p Setting up Whisper transcription..."
    install_brew_deps cmake ffmpeg pkg-config
    echo "$p Building Whisper.cpp..."
    bash "$SETUP_DIR/transcription/whisper.sh"
    echo "$p Downloading base model..."
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    ;;
    
  whisper-coreml)
    echo "$p Setting up Whisper CoreML transcription..."
    install_brew_deps cmake ffmpeg pkg-config
    echo "$p Building Whisper.cpp..."
    bash "$SETUP_DIR/transcription/whisper.sh"
    echo "$p Building Whisper CoreML..."
    bash "$SETUP_DIR/transcription/coreml/whisper-coreml.sh"
    echo "$p Downloading base model..."
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    echo "$p Generating CoreML model..."
    bash "$SETUP_DIR/transcription/coreml/generate-coreml-model.sh" base || true
    ;;
    
  tts)
    echo "$p Setting up Text-to-Speech dependencies..."
    install_brew_deps ffmpeg espeak-ng pkg-config
    echo "$p Setting up TTS Python environment..."
    bash "$SETUP_DIR/tts/tts-env.sh"
    echo "$p Installing Kitten TTS..."
    bash "$SETUP_DIR/tts/kitten.sh"
    echo "$p Installing Coqui TTS..."
    bash "$SETUP_DIR/tts/coqui.sh"
    echo "$p Downloading TTS models..."
    bash "$SETUP_DIR/tts/models.sh"
    ;;
    
  base)
    echo "$p Base setup completed - core dependencies verified"
    ;;
esac

echo "$p Setup completed successfully"
exit 0