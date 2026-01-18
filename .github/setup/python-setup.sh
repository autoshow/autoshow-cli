#!/bin/bash

ensure_python311() {
  if command -v python3.11 &>/dev/null; then
    return 0
  fi
  
  if is_macos; then
    if command -v brew &>/dev/null; then
      log "Installing Python 3.11 via Homebrew..."
      brew install python@3.11 >/dev/null 2>&1 || {
        log "WARNING: Failed to install Python 3.11 via Homebrew"
        return 1
      }
      return 0
    fi
  fi
  
  if command -v apt-get &>/dev/null; then
    log "Installing Python 3.11 via apt..."
    sudo apt-get update -qq >/dev/null 2>&1 || true
    sudo apt-get install -y python3.11 python3.11-venv >/dev/null 2>&1 && return 0
  elif command -v dnf &>/dev/null; then
    log "Installing Python 3.11 via dnf..."
    sudo dnf install -y python3.11 >/dev/null 2>&1 && return 0
  elif command -v yum &>/dev/null; then
    log "Installing Python 3.11 via yum..."
    sudo yum install -y python3.11 >/dev/null 2>&1 && return 0
  elif command -v pacman &>/dev/null; then
    log "Installing Python via pacman..."
    sudo pacman -S --noconfirm python >/dev/null 2>&1 && return 0
  elif command -v apk &>/dev/null; then
    log "Installing Python via apk..."
    sudo apk add python3 py3-pip >/dev/null 2>&1 && return 0
  elif command -v zypper &>/dev/null; then
    log "Installing Python 3.11 via zypper..."
    sudo zypper install -y python311 >/dev/null 2>&1 && return 0
  fi
  
  log "ERROR: Could not install Python 3.11 automatically"
  log "Please install Python 3.11 manually:"
  log "  Debian/Ubuntu: sudo apt-get install python3.11 python3.11-venv"
  log "  Fedora:        sudo dnf install python3.11"
  log "  Arch:          sudo pacman -S python"
  log "  Alpine:        sudo apk add python3 py3-pip"
  log "  openSUSE:      sudo zypper install python311"
  log "  macOS:         brew install python@3.11"
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

create_py311_venv() {
  local venv_path="$1"
  
  if ! ensure_python311; then
    log "ERROR: Cannot create venv - Python 3.11 not available"
    return 1
  fi
  
  local py311
  py311=$(get_python311_path) || {
    log "ERROR: Python 3.11 not found after installation"
    return 1
  }
  
  if [ -d "$venv_path" ]; then
    chmod -R u+w "$venv_path" 2>/dev/null || true
    rm -rf "$venv_path" 2>/dev/null || {
      mv "$venv_path" "${venv_path}.backup.$(date +%s)" 2>/dev/null || true
    }
  fi
  
  "$py311" -m venv "$venv_path" || {
    log "ERROR: Failed to create virtual environment with Python 3.11"
    return 1
  }
  
  "$venv_path/bin/pip" install --upgrade pip >/dev/null 2>&1
  
  echo "$venv_path"
}
