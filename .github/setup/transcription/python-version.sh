#!/bin/bash
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

# Alias for backwards compatibility (some scripts may use _log)
_log() { log "$@"; }

ensure_python311() {
  if command -v python3.11 &>/dev/null; then
    return 0
  fi
  
  # macOS: use Homebrew
  if [[ "$OSTYPE" == darwin* ]]; then
    if command -v brew &>/dev/null; then
      _log "Installing Python 3.11 via Homebrew..."
      brew install python@3.11 >/dev/null 2>&1 || {
        _log "WARNING: Failed to install Python 3.11 via Homebrew"
        return 1
      }
      return 0
    fi
  fi
  
  # Linux: try common package managers
  if command -v apt-get &>/dev/null; then
    _log "Installing Python 3.11 via apt..."
    sudo apt-get update -qq >/dev/null 2>&1 || true
    sudo apt-get install -y python3.11 python3.11-venv >/dev/null 2>&1 && return 0
  elif command -v dnf &>/dev/null; then
    _log "Installing Python 3.11 via dnf..."
    sudo dnf install -y python3.11 >/dev/null 2>&1 && return 0
  elif command -v yum &>/dev/null; then
    _log "Installing Python 3.11 via yum..."
    sudo yum install -y python3.11 >/dev/null 2>&1 && return 0
  elif command -v pacman &>/dev/null; then
    _log "Installing Python via pacman..."
    sudo pacman -S --noconfirm python >/dev/null 2>&1 && return 0
  elif command -v apk &>/dev/null; then
    _log "Installing Python via apk..."
    sudo apk add python3 py3-pip >/dev/null 2>&1 && return 0
  elif command -v zypper &>/dev/null; then
    _log "Installing Python 3.11 via zypper..."
    sudo zypper install -y python311 >/dev/null 2>&1 && return 0
  fi
  
  _log "ERROR: Could not install Python 3.11 automatically"
  _log "Please install Python 3.11 manually:"
  _log "  Debian/Ubuntu: sudo apt-get install python3.11 python3.11-venv"
  _log "  Fedora:        sudo dnf install python3.11"
  _log "  Arch:          sudo pacman -S python"
  _log "  Alpine:        sudo apk add python3 py3-pip"
  _log "  openSUSE:      sudo zypper install python311"
  _log "  macOS:         brew install python@3.11"
  return 1
}

get_python311_path() {
  for pth in python3.11 /usr/local/bin/python3.11 /opt/homebrew/bin/python3.11 /usr/bin/python3.11; do
    if command -v "$pth" &>/dev/null; then
      v=$("$pth" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      if [ "$v" = "3.11" ]; then
        echo "$pth"
        return 0
      fi
    fi
  done
  return 1
}