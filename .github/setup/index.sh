#!/bin/bash
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOGFILE="setup-${TIMESTAMP}.log"
ERROR_CONTEXT=""

# Redirect all output to log file
exec > >(tee -a "$LOGFILE") 2>&1

cleanup_log() {
  local status=$?
  # Stop logging to prevent circular tail in log
  exec > /dev/tty 2>&1
  
  if [ "$status" -eq 0 ]; then
    rm -f "$LOGFILE"
  else
    echo "ERROR: Script failed (exit code $status). Logs saved in: $LOGFILE"
    if [ -n "$ERROR_CONTEXT" ]; then
      echo "ERROR CONTEXT: $ERROR_CONTEXT"
    fi
    echo "Last 30 lines of log:"
    tail -n 30 "$LOGFILE" 2>/dev/null || echo "Could not read log file"
  fi
  exit $status
}
trap cleanup_log EXIT

# Enhanced error handling
set -euo pipefail
error_handler() {
  local line=$1
  local command="$2"
  echo "ERROR: Command failed at line $line: $command" >&2
  if [ -n "$ERROR_CONTEXT" ]; then
    echo "ERROR CONTEXT: $ERROR_CONTEXT" >&2
  fi
  exit 1
}
trap 'error_handler ${LINENO} "$BASH_COMMAND"' ERR

ts() {
  if command -v gdate &>/dev/null; then
    gdate "+%H:%M:%S.%3N"
  else
    perl -MTime::HiRes=gettimeofday -e '($s,$us)=gettimeofday();@t=localtime($s);printf"%02d:%02d:%02d.%03d\n",$t[2],$t[1],$t[0],$us/1000'
  fi
}
log() { echo "[$(ts)] $*"; }

SETUP_MODE="${1:-base}"
case "$SETUP_MODE" in
  --transcription|--tts|--all|base)
    SETUP_MODE="${SETUP_MODE#--}"
    ;;
  *)
    log "Invalid argument '$1'"
    log "Usage: $0 [--transcription|--tts|--all]"
    exit 1
    ;;
esac

# Detect platform
PLATFORM="unknown"
case "$OSTYPE" in
  darwin*)  PLATFORM="macos" ;;
  linux*)   PLATFORM="linux" ;;
  msys*|cygwin*|mingw*) 
    log "Windows detected. Please use WSL (Windows Subsystem for Linux)."
    log "Install WSL: https://learn.microsoft.com/en-us/windows/wsl/install"
    log "Then run this setup script from within WSL."
    exit 1 
    ;;
  *)
    log "Unsupported platform: $OSTYPE"
    exit 1 
    ;;
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
  
  log "$dep_name: $version (location: $location)"
}

quiet_brew_install() {
  local pkg="$1"
  local cmd="${2:-$pkg}"  # Allow specifying command name if different from package
  if command -v "$cmd" &>/dev/null; then
    return 0
  fi
  log "Installing $pkg via Homebrew..."
  brew install "$pkg" >/dev/null 2>&1
}

# Detect Linux package manager
detect_pkg_manager() {
  if command -v apt-get &>/dev/null; then
    echo "apt"
  elif command -v dnf &>/dev/null; then
    echo "dnf"
  elif command -v yum &>/dev/null; then
    echo "yum"
  elif command -v pacman &>/dev/null; then
    echo "pacman"
  elif command -v apk &>/dev/null; then
    echo "apk"
  elif command -v zypper &>/dev/null; then
    echo "zypper"
  else
    echo "unknown"
  fi
}

# Install package on Linux (best-effort)
install_linux_pkg() {
  local pkg="$1"
  local pkg_manager
  pkg_manager=$(detect_pkg_manager)
  
  case "$pkg_manager" in
    apt)
      sudo apt-get update -qq >/dev/null 2>&1 || true
      sudo apt-get install -y "$pkg" >/dev/null 2>&1
      ;;
    dnf)
      sudo dnf install -y "$pkg" >/dev/null 2>&1
      ;;
    yum)
      sudo yum install -y "$pkg" >/dev/null 2>&1
      ;;
    pacman)
      sudo pacman -S --noconfirm "$pkg" >/dev/null 2>&1
      ;;
    apk)
      sudo apk add "$pkg" >/dev/null 2>&1
      ;;
    zypper)
      sudo zypper install -y "$pkg" >/dev/null 2>&1
      ;;
    *)
      return 1
      ;;
  esac
}

# Install package on Linux with fallback instructions
quiet_linux_install() {
  local pkg="$1"
  
  # Check if already installed
  if command -v "$pkg" &>/dev/null; then
    return 0
  fi
  
  log "Installing $pkg..."
  if install_linux_pkg "$pkg"; then
    return 0
  fi
  
  # Installation failed - provide manual instructions
  local pkg_manager
  pkg_manager=$(detect_pkg_manager)
  
  log "ERROR: Failed to install $pkg automatically"
  log "Please install it manually using your package manager:"
  case "$pkg_manager" in
    apt)     log "  sudo apt-get install $pkg" ;;
    dnf)     log "  sudo dnf install $pkg" ;;
    yum)     log "  sudo yum install $pkg" ;;
    pacman)  log "  sudo pacman -S $pkg" ;;
    apk)     log "  sudo apk add $pkg" ;;
    zypper)  log "  sudo zypper install $pkg" ;;
    *)
      log "  Debian/Ubuntu: sudo apt-get install $pkg"
      log "  Fedora/RHEL:   sudo dnf install $pkg"
      log "  Arch:          sudo pacman -S $pkg"
      log "  Alpine:        sudo apk add $pkg"
      log "  openSUSE:      sudo zypper install $pkg"
      ;;
  esac
  return 1
}

check_and_update_ytdlp() {
  if ! command -v yt-dlp &>/dev/null; then
    log "Installing yt-dlp..."
    if [ "$PLATFORM" = "macos" ]; then
      quiet_brew_install "yt-dlp"
    else
      # Try pip first (most universal), then package manager
      if command -v pip3 &>/dev/null; then
        pip3 install --user yt-dlp >/dev/null 2>&1 || quiet_linux_install "yt-dlp" || {
          log "WARNING: Could not install yt-dlp automatically"
          log "Please install manually: pip3 install yt-dlp"
        }
      else
        quiet_linux_install "yt-dlp" || {
          log "WARNING: Could not install yt-dlp automatically"
          log "Please install manually: pip3 install yt-dlp"
        }
      fi
    fi
    log_dependency_info "yt-dlp"
    return
  fi

  # Version check and update only on macOS (uses brew info)
  if [ "$PLATFORM" = "macos" ]; then
    local current_version latest_version
    current_version=$(yt-dlp --version 2>/dev/null || echo "0")
    # brew info output: "==> yt-dlp: stable 2025.12.8 (bottled), HEAD"
    # Extract the version number (4th field) not "stable" (3rd field)
    latest_version=$(brew info yt-dlp 2>/dev/null | grep -m 1 "yt-dlp:" | awk '{print $4}' || echo "0")
    
    # Normalize version formats: yt-dlp uses 2025.12.08, brew uses 2025.12.8
    # Remove leading zeros from date components for comparison
    normalize_version() {
      echo "$1" | sed 's/\.0\([0-9]\)/.\1/g'
    }
    current_normalized=$(normalize_version "$current_version")
    latest_normalized=$(normalize_version "$latest_version")
    
    if [ "$current_normalized" != "$latest_normalized" ] && [ "$latest_normalized" != "0" ]; then
      log "Updating yt-dlp from $current_version to $latest_version..."
      brew upgrade yt-dlp >/dev/null 2>&1 || quiet_brew_install "yt-dlp"
    fi
  fi
  
  log_dependency_info "yt-dlp"
}

mkdir -p build/config
mkdir -p build/pyenv

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  log "Created .env file from .env.example"
fi

if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

log "Installing Node.js dependencies..."
bun install >/dev/null 2>&1
log "Node.js dependencies installed"

log "Checking system dependencies..."
if [ "$PLATFORM" = "macos" ]; then
  if ! command -v brew &>/dev/null; then
    log "Homebrew not found. Install from https://brew.sh/"
    exit 1
  fi
  log_dependency_info "Homebrew" "brew"
fi
log_dependency_info "Node.js" "node"
log_dependency_info "npm"
check_and_update_ytdlp

SETUP_DIR=".github/setup"

install_deps() {
  for pkg in "$@"; do
    if [ "$PLATFORM" = "macos" ]; then
      quiet_brew_install "$pkg"
    else
      quiet_linux_install "$pkg" || {
        log "WARNING: Could not install $pkg, continuing anyway..."
      }
    fi
    
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
    ;;
    
  tts)
    log "Setting up Text-to-Speech dependencies..."
    install_deps ffmpeg espeak-ng pkg-config
    bash "$SETUP_DIR/tts/tts-env.sh"
    bash "$SETUP_DIR/tts/kitten.sh"
    bash "$SETUP_DIR/tts/coqui.sh"
    bash "$SETUP_DIR/tts/models.sh"
    ;;
    
  all)
    log "Setting up all features (transcription + TTS)..."
    
    # Transcription setup
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
    
    # TTS setup
    log "Setting up Text-to-Speech dependencies..."
    install_deps ffmpeg espeak-ng pkg-config
    bash "$SETUP_DIR/tts/tts-env.sh"
    bash "$SETUP_DIR/tts/kitten.sh"
    bash "$SETUP_DIR/tts/coqui.sh"
    bash "$SETUP_DIR/tts/models.sh"
    ;;
    
  base)
    log "Base setup completed - core dependencies verified"
    ;;
esac

log "Setup completed successfully"
exit 0