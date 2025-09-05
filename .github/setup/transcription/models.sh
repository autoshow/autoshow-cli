#!/bin/bash
set -euo pipefail
p='[setup/transcription/models]'

MODELS_DIR="build/models"
mkdir -p "$MODELS_DIR"

echo "$p Downloading transcription models"

echo "$p Downloading Whisper GGML models"
bash ".github/setup/transcription/download-ggml-model.sh" base "$MODELS_DIR" >/dev/null 2>&1 || {
    echo "$p WARNING: Failed to download ggml-base.bin"
}

if [ -f "$MODELS_DIR/ggml-base.bin" ]; then
    echo "$p Successfully downloaded ggml-base.bin"
else
    echo "$p ERROR: ggml-base.bin not found after download"
fi

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

if [ "$IS_MAC" = true ]; then
    echo "$p Generating CoreML models"
    
    if [ -x "build/pyenv/coreml/bin/python" ]; then
        bash ".github/setup/transcription/generate-coreml-model.sh" base >/dev/null 2>&1 || {
            echo "$p WARNING: Failed to generate CoreML model"
        }
        
        if [ ! -d "$MODELS_DIR/ggml-base-encoder.mlmodelc" ] && [ ! -d "$MODELS_DIR/coreml-encoder-base.mlpackage" ]; then
            echo "$p WARNING: CoreML encoder artifact not detected"
        else
            echo "$p CoreML encoder ready"
        fi
    else
        echo "$p WARNING: CoreML Python environment not found, skipping CoreML model generation"
    fi
else
    echo "$p Skipping CoreML model generation on non-macOS"
fi

echo "$p Transcription models setup complete"