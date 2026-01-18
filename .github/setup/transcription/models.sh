#!/bin/bash
set -euo pipefail
ts() {
  if command -v gdate &>/dev/null; then
    gdate "+%H:%M:%S.%3N"
  else
    perl -MTime::HiRes=gettimeofday -e '($s,$us)=gettimeofday();@t=localtime($s);printf"%02d:%02d:%02d.%03d\n",$t[2],$t[1],$t[0],$us/1000'
  fi
}
log() { echo "[$(ts)] $*"; }

MODELS_DIR="build/models"
mkdir -p "$MODELS_DIR"

bash ".github/setup/transcription/download-ggml-model.sh" base "$MODELS_DIR" >/dev/null 2>&1 || {
    log "WARNING: Failed to download ggml-base.bin"
}

if [ ! -f "$MODELS_DIR/ggml-base.bin" ]; then
    log "ERROR: ggml-base.bin not found after download"
fi

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

if [ "$IS_MAC" = true ]; then
    if [ -x "build/pyenv/coreml/bin/python" ]; then
        bash ".github/setup/transcription/generate-coreml-model.sh" base >/dev/null 2>&1 || {
            log "WARNING: Failed to generate CoreML model"
        }
        
        if [ ! -d "$MODELS_DIR/ggml-base-encoder.mlmodelc" ] && [ ! -d "$MODELS_DIR/coreml-encoder-base.mlpackage" ]; then
            log "WARNING: CoreML encoder artifact not detected"
        fi
    fi
fi