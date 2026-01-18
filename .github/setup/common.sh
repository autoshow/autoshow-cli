#!/bin/bash

ts() {
  if command -v gdate &>/dev/null; then
    gdate "+%H:%M:%S.%3N"
  else
    perl -MTime::HiRes=gettimeofday -e '($s,$us)=gettimeofday();@t=localtime($s);printf"%02d:%02d:%02d.%03d\n",$t[2],$t[1],$t[0],$us/1000'
  fi
}

log() { echo "[$(ts)] $*"; }

_log() { log "$@"; }

detect_pkg_manager() {
  if command -v apt-get &>/dev/null; then echo "apt"
  elif command -v dnf &>/dev/null; then echo "dnf"
  elif command -v yum &>/dev/null; then echo "yum"
  elif command -v pacman &>/dev/null; then echo "pacman"
  elif command -v apk &>/dev/null; then echo "apk"
  elif command -v zypper &>/dev/null; then echo "zypper"
  else echo "unknown"
  fi
}

install_linux_pkg() {
  local pkg="$1"
  local pkg_manager
  pkg_manager=$(detect_pkg_manager)
  
  case "$pkg_manager" in
    apt) sudo apt-get update -qq >/dev/null 2>&1 || true; sudo apt-get install -y "$pkg" >/dev/null 2>&1 ;;
    dnf) sudo dnf install -y "$pkg" >/dev/null 2>&1 ;;
    yum) sudo yum install -y "$pkg" >/dev/null 2>&1 ;;
    pacman) sudo pacman -S --noconfirm "$pkg" >/dev/null 2>&1 ;;
    apk) sudo apk add "$pkg" >/dev/null 2>&1 ;;
    zypper) sudo zypper install -y "$pkg" >/dev/null 2>&1 ;;
    *) return 1 ;;
  esac
}

quiet_brew_install() {
  local pkg="$1"
  local cmd="${2:-$pkg}"
  command -v "$cmd" &>/dev/null && return 0
  log "Installing $pkg via Homebrew..."
  brew install "$pkg" >/dev/null 2>&1
}

quiet_linux_install() {
  local pkg="$1"
  command -v "$pkg" &>/dev/null && return 0
  
  log "Installing $pkg..."
  install_linux_pkg "$pkg" && return 0
  
  local pkg_manager
  pkg_manager=$(detect_pkg_manager)
  
  log "ERROR: Failed to install $pkg automatically"
  log "Please install it manually:"
  case "$pkg_manager" in
    apt) log "  sudo apt-get install $pkg" ;;
    dnf) log "  sudo dnf install $pkg" ;;
    yum) log "  sudo yum install $pkg" ;;
    pacman) log "  sudo pacman -S $pkg" ;;
    apk) log "  sudo apk add $pkg" ;;
    zypper) log "  sudo zypper install $pkg" ;;
    *) log "  Check your distribution's package manager" ;;
  esac
  return 1
}

install_pkg() {
  local pkg="$1"
  if is_macos; then
    quiet_brew_install "$pkg"
  else
    quiet_linux_install "$pkg" || log "WARNING: Could not install $pkg, continuing..."
  fi
}

is_macos() {
  [[ "$OSTYPE" == darwin* ]]
}

detect_platform() {
  IS_MAC=false
  is_macos && IS_MAC=true
  export IS_MAC
}

setup_error_trap() {
  trap '_error_handler ${LINENO} "$BASH_COMMAND"' ERR
}

_error_handler() {
  local line=$1
  local command="$2"
  echo "[$(ts)] ERROR: Command failed at line $line: $command" >&2
  exit 1
}

check_marker() {
  local marker="$1"
  [ -f "$marker" ]
}

skip_if_installed() {
  local marker="$1"
  local binary="${2:-}"
  local name="${3:-component}"
  
  if [ -f "$marker" ]; then
    if [ -z "$binary" ] || [ -x "$binary" ]; then
      log "$name: already installed, skipping"
      exit 0
    fi
  fi
}

BIN_DIR="build/bin"
MODELS_DIR="build/models"
CONFIG_DIR="build/config"
PYENV_DIR="build/pyenv"

ensure_build_dirs() {
  mkdir -p "$BIN_DIR" "$MODELS_DIR" "$CONFIG_DIR" "$PYENV_DIR"
}

TTS_VENV="build/pyenv/tts"
TTS_PIP="$TTS_VENV/bin/pip"
TTS_PYTHON="$TTS_VENV/bin/python"

require_tts_env() {
  if [ ! -x "$TTS_PIP" ]; then
    log "ERROR: Shared TTS environment missing at $TTS_PIP"
    log "Run: bun setup:tts to set up the base TTS environment first"
    exit 1
  fi
}

tts_pip() {
  "$TTS_PIP" "$@"
}

tts_python() {
  "$TTS_PYTHON" "$@"
}

tts_can_import() {
  local module="$1"
  "$TTS_PYTHON" -c "import $module" 2>/dev/null
}

source "$(dirname "${BASH_SOURCE[0]}")/python-setup.sh"
