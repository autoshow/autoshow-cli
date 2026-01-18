#!/bin/bash
ts() {
  if command -v gdate &>/dev/null; then
    gdate "+%H:%M:%S.%3N"
  else
    perl -MTime::HiRes=gettimeofday -e '($s,$us)=gettimeofday();@t=localtime($s);printf"%02d:%02d:%02d.%03d\n",$t[2],$t[1],$t[0],$us/1000'
  fi
}
_log() { echo "[$(ts)] $*"; }

ensure_python311() {
  local _unused="${1:-}"
  
  if command -v python3.11 &>/dev/null; then
    _log "Python 3.11 already available"
    return 0
  fi
  
  if command -v brew &>/dev/null; then
    _log "Installing Python 3.11 via Homebrew"
    brew install python@3.11 >/dev/null 2>&1 || {
      _log "WARNING: Failed to install Python 3.11 via Homebrew"
      return 1
    }
    _log "Python 3.11 installed successfully"
    return 0
  else
    _log "ERROR: Homebrew not found, cannot install Python 3.11"
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