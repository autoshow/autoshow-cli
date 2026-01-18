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

MODEL="${1:-base}"
OUT="build/models/ggml-${MODEL}-encoder.mlmodelc"
FALLBACK_OUT="build/models/ggml-${MODEL}-encoder.mlpackage"

if [ -d "$OUT" ]; then
  exit 0
fi

if [ -d "$FALLBACK_OUT" ]; then
  exit 0
fi

PY="build/pyenv/coreml/bin/python"
if [ ! -x "$PY" ]; then
  PY="python3"
fi

case "$MODEL" in
  tiny|tiny.en|base|base.en|small|small.en|medium|medium.en|large|large-v1|large-v2|large-v3|large-v3-turbo) ;;
  *) log "Unsupported model: $MODEL"; exit 1 ;;
esac

CONV_MODEL="$MODEL"
if [[ "$MODEL" == "large" || "$MODEL" == "large-v1" || "$MODEL" == "large-v2" || "$MODEL" == "large-v3" ]]; then
  CONV_MODEL="large-v3"
fi

check_coreml_compiler() {
  if command -v xcrun &>/dev/null; then
    if xcrun --find coremlc &>/dev/null 2>&1 || xcrun --find coremlcompiler &>/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

TMP_DIR="build/models/tmp-coreml-${MODEL}"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

$PY .github/setup/transcription/coreml/convert-whisper-to-coreml.py --model "$CONV_MODEL" --encoder-only true >/dev/null 2>&1 || {
  log "Conversion failed"
  exit 1
}

MLCAND=""
if [ -d "$TMP_DIR" ]; then
  CANDIDATE_C=$(find "$TMP_DIR" -type d -name "*.mlmodelc" -maxdepth 2 2>/dev/null | head -n 1 || true)
  CANDIDATE_P=$(find "$TMP_DIR" -type d -name "*.mlpackage" -maxdepth 2 2>/dev/null | head -n 1 || true)
  
  if [ -n "${CANDIDATE_C:-}" ]; then
    MLCAND="$CANDIDATE_C"
  elif [ -n "${CANDIDATE_P:-}" ]; then
    MLCAND="$CANDIDATE_P"
  fi
fi

if [ -z "$MLCAND" ]; then
  PKG_DEFAULT="build/models/coreml-encoder-${CONV_MODEL}.mlpackage"
  if [ -d "$PKG_DEFAULT" ]; then
    MLCAND="$PKG_DEFAULT"
  fi
fi

if [ -z "$MLCAND" ]; then
  log "No CoreML artifact produced for $MODEL"
  exit 1
fi

if [[ "$MLCAND" == *.mlpackage ]]; then
  if check_coreml_compiler; then
    COMPILED_DIR="$TMP_DIR/compiled"
    mkdir -p "$COMPILED_DIR"
    
    xcrun coremlc compile "$MLCAND" "$COMPILED_DIR" >/dev/null 2>&1 && {
      CANDIDATE=$(find "$COMPILED_DIR" -type d -name "*.mlmodelc" -maxdepth 2 2>/dev/null | head -n 1 || true)
      if [ -n "$CANDIDATE" ]; then
        rm -rf "$OUT"
        mv "$CANDIDATE" "$OUT"
        rm -rf "$TMP_DIR"
        exit 0
      fi
    }
  fi
  
  rm -rf "$FALLBACK_OUT"
  mv "$MLCAND" "$FALLBACK_OUT"
  rm -rf "$TMP_DIR"
  
  if [ ! -d "$FALLBACK_OUT" ]; then
    log "Failed to create $FALLBACK_OUT"
    exit 1
  fi
  
  exit 0
else
  rm -rf "$OUT"
  mv "$MLCAND" "$OUT"
  rm -rf "$TMP_DIR"
  
  if [ ! -d "$OUT" ]; then
    log "Failed to create $OUT"
    exit 1
  fi
  
  exit 0
fi