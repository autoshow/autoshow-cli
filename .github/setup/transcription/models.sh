#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

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
        bash ".github/setup/transcription/coreml/generate-coreml-model.sh" base >/dev/null 2>&1 || {
            log "WARNING: Failed to generate CoreML model"
        }
        
        if [ ! -d "$MODELS_DIR/ggml-base-encoder.mlmodelc" ] && [ ! -d "$MODELS_DIR/coreml-encoder-base.mlpackage" ]; then
            log "WARNING: CoreML encoder artifact not detected"
        fi
    fi
fi