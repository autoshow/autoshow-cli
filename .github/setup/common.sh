#!/bin/bash
# Common utility functions for setup scripts

# Timestamp function - uses gdate if available (for milliseconds on macOS)
ts() {
  if command -v gdate &>/dev/null; then
    gdate "+%H:%M:%S.%3N"
  else
    perl -MTime::HiRes=gettimeofday -e '($s,$us)=gettimeofday();@t=localtime($s);printf"%02d:%02d:%02d.%03d\n",$t[2],$t[1],$t[0],$us/1000'
  fi
}

# Logging function with timestamp
log() { echo "[$(ts)] $*"; }
