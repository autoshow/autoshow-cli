#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../../common.sh"

MODEL="${1:-base}"
OUT="build/models/ggml-${MODEL}-encoder.mlmodelc"
FALLBACK_OUT="build/models/ggml-${MODEL}-encoder.mlpackage"

[ -d "$OUT" ] && exit 0
[ -d "$FALLBACK_OUT" ] && exit 0

PY="$PYENV_DIR/coreml/bin/python"
[ -x "$PY" ] || PY="python3"

case "$MODEL" in
  tiny|tiny.en|base|base.en|small|small.en|medium|medium.en|large|large-v1|large-v2|large-v3|large-v3-turbo) ;;
  *) log "Unsupported model: $MODEL"; exit 1 ;;
esac

CONV_MODEL="$MODEL"
case "$MODEL" in
  large|large-v1|large-v2|large-v3) CONV_MODEL="large-v3" ;;
esac

check_coreml_compiler() {
  command -v xcrun &>/dev/null && \
    (xcrun --find coremlc &>/dev/null 2>&1 || xcrun --find coremlcompiler &>/dev/null 2>&1)
}

TMP_DIR="build/models/tmp-coreml-${MODEL}"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

$PY .github/setup/transcription/coreml/convert-whisper-to-coreml.py \
  --model "$CONV_MODEL" --encoder-only true >/dev/null 2>&1 || {
  log "Conversion failed"
  exit 1
}

MLCAND=""
if [ -d "$TMP_DIR" ]; then
  MLCAND=$(find "$TMP_DIR" -type d -name "*.mlmodelc" -maxdepth 2 2>/dev/null | head -n 1 || true)
  [ -z "$MLCAND" ] && MLCAND=$(find "$TMP_DIR" -type d -name "*.mlpackage" -maxdepth 2 2>/dev/null | head -n 1 || true)
fi

[ -z "$MLCAND" ] && [ -d "build/models/coreml-encoder-${CONV_MODEL}.mlpackage" ] && \
  MLCAND="build/models/coreml-encoder-${CONV_MODEL}.mlpackage"

if [ -z "$MLCAND" ]; then
  log "No CoreML artifact produced for $MODEL"
  exit 1
fi

if [[ "$MLCAND" == *.mlpackage ]]; then
  if check_coreml_compiler; then
    COMPILED_DIR="$TMP_DIR/compiled"
    mkdir -p "$COMPILED_DIR"
    
    if xcrun coremlc compile "$MLCAND" "$COMPILED_DIR" >/dev/null 2>&1; then
      CANDIDATE=$(find "$COMPILED_DIR" -type d -name "*.mlmodelc" -maxdepth 2 2>/dev/null | head -n 1 || true)
      if [ -n "$CANDIDATE" ]; then
        rm -rf "$OUT"
        mv "$CANDIDATE" "$OUT"
        rm -rf "$TMP_DIR"
        exit 0
      fi
    fi
  fi
  
  rm -rf "$FALLBACK_OUT"
  mv "$MLCAND" "$FALLBACK_OUT"
  rm -rf "$TMP_DIR"
  [ -d "$FALLBACK_OUT" ] || { log "Failed to create $FALLBACK_OUT"; exit 1; }
else
  rm -rf "$OUT"
  mv "$MLCAND" "$OUT"
  rm -rf "$TMP_DIR"
  [ -d "$OUT" ] || { log "Failed to create $OUT"; exit 1; }
fi
