#!/bin/bash

ensure_python311() {
  local p="${1:-[setup/transcription/python-version]}"
  
  if command -v python3.11 &>/dev/null; then
    echo "$p Python 3.11 already available"
    return 0
  fi
  
  if command -v brew &>/dev/null; then
    echo "$p Installing Python 3.11 via Homebrew"
    brew install python@3.11 >/dev/null 2>&1 || {
      echo "$p WARNING: Failed to install Python 3.11 via Homebrew"
      return 1
    }
    echo "$p Python 3.11 installed successfully"
    return 0
  else
    echo "$p ERROR: Homebrew not found, cannot install Python 3.11"
    return 1
  fi
}

get_python311_path() {
  for pth in python3.11 /usr/local/bin/python3.11 /opt/homebrew/bin/python3.11; do
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