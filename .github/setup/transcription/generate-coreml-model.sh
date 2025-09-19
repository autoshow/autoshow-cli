#!/bin/bash
set -euo pipefail

MODEL="${1:-base}"
OUT="build/models/ggml-${MODEL}-encoder.mlmodelc"
FALLBACK_OUT="build/models/ggml-${MODEL}-encoder.mlpackage"
p='[setup/transcription/generate-coreml-model]'

if [ -d "$OUT" ]; then
  echo "$p CoreML encoder already exists: $OUT"
  exit 0
fi

if [ -d "$FALLBACK_OUT" ]; then
  echo "$p CoreML encoder already exists (mlpackage format): $FALLBACK_OUT"
  exit 0
fi

PY="build/pyenv/coreml/bin/python"
if [ ! -x "$PY" ]; then
  PY="python3"
fi

case "$MODEL" in
  tiny|tiny.en|base|base.en|small|small.en|medium|medium.en|large|large-v1|large-v2|large-v3|large-v3-turbo) ;;
  *) echo "$p Unsupported model: $MODEL"; exit 1 ;;
esac

CONV_MODEL="$MODEL"
if [[ "$MODEL" == "large" || "$MODEL" == "large-v1" || "$MODEL" == "large-v2" || "$MODEL" == "large-v3" ]]; then
  CONV_MODEL="large-v3"
fi

check_coreml_compiler() {
  if command -v xcrun &>/dev/null; then
    if xcrun --find coremlc &>/dev/null 2>&1 || xcrun --find coremlcompiler &>/dev/null 2>&1; then
      echo "$p CoreML compiler available"
      return 0
    fi
  fi
  
  if xcode-select -p &>/dev/null 2>&1; then
    echo "$p Xcode Command Line Tools installed but CoreML compiler not found"
    echo "$p Note: CoreML compiler requires full Xcode from the App Store"
    echo "$p Will save as mlpackage format which works with whisper.cpp but is less optimized"
    return 1
  fi
  
  echo "$p No Xcode tools found, will save as mlpackage format"
  return 1
}

TMP_DIR="build/models/tmp-coreml-${MODEL}"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

echo "$p Converting model $CONV_MODEL to CoreML format"

CONV_RESULT=0
$PY .github/setup/transcription/convert-whisper-to-coreml.py --model "$CONV_MODEL" --encoder-only true 2>&1 | tee /tmp/coreml-convert.log || CONV_RESULT=$?

if [ $CONV_RESULT -ne 0 ]; then
  echo "$p Primary conversion failed with code $CONV_RESULT, trying fallback with output-dir"
  $PY .github/setup/transcription/convert-whisper-to-coreml.py --model "$CONV_MODEL" --encoder-only true --output-dir "$TMP_DIR" 2>&1 | tee /tmp/coreml-convert-fallback.log || CONV_RESULT=$?
fi

if [ $CONV_RESULT -ne 0 ]; then
  echo "$p ERROR: Conversion failed with exit code $CONV_RESULT"
  exit 1
fi

echo "$p Conversion completed successfully, looking for artifacts"

MLCAND=""
if [ -d "$TMP_DIR" ]; then
  CANDIDATE_C=$(find "$TMP_DIR" -type d -name "*.mlmodelc" -maxdepth 2 2>/dev/null | head -n 1 || true)
  CANDIDATE_P=$(find "$TMP_DIR" -type d -name "*.mlpackage" -maxdepth 2 2>/dev/null | head -n 1 || true)
  
  echo "$p Found in temp dir - mlmodelc: ${CANDIDATE_C:-none}, mlpackage: ${CANDIDATE_P:-none}"
  
  if [ -n "${CANDIDATE_C:-}" ]; then
    MLCAND="$CANDIDATE_C"
  elif [ -n "${CANDIDATE_P:-}" ]; then
    MLCAND="$CANDIDATE_P"
  fi
fi

if [ -z "$MLCAND" ]; then
  PKG_DEFAULT="build/models/coreml-encoder-${CONV_MODEL}.mlpackage"
  if [ -d "$PKG_DEFAULT" ]; then
    echo "$p Found default package at $PKG_DEFAULT"
    MLCAND="$PKG_DEFAULT"
  fi
fi

if [ -z "$MLCAND" ]; then
  echo "$p ERROR: No CoreML artifact produced for $MODEL"
  ls -la build/models/ 2>/dev/null || true
  ls -la "$TMP_DIR" 2>/dev/null || true
  exit 1
fi

echo "$p Processing artifact: $MLCAND"

if [[ "$MLCAND" == *.mlpackage ]]; then
  if check_coreml_compiler; then
    echo "$p Attempting to compile mlpackage to mlmodelc for better performance"
    
    COMPILED_DIR="$TMP_DIR/compiled"
    mkdir -p "$COMPILED_DIR"
    
    COMPILE_RESULT=0
    xcrun coremlc compile "$MLCAND" "$COMPILED_DIR" 2>&1 | tee /tmp/coreml-compile.log || COMPILE_RESULT=$?
    
    if [ $COMPILE_RESULT -ne 0 ]; then
      echo "$p First compile attempt failed, trying coremlcompiler"
      xcrun coremlcompiler compile "$MLCAND" "$COMPILED_DIR" 2>&1 | tee /tmp/coreml-compile-fallback.log || COMPILE_RESULT=$?
    fi
    
    if [ $COMPILE_RESULT -eq 0 ]; then
      CANDIDATE=$(find "$COMPILED_DIR" -type d -name "*.mlmodelc" -maxdepth 2 2>/dev/null | head -n 1 || true)
      if [ -n "$CANDIDATE" ]; then
        echo "$p Successfully compiled to mlmodelc format"
        rm -rf "$OUT"
        mv "$CANDIDATE" "$OUT"
        rm -rf "$TMP_DIR"
        echo "$p Successfully created $OUT"
        exit 0
      fi
    fi
    
    echo "$p Compilation failed, falling back to mlpackage format"
  fi
  
  echo "$p Saving as mlpackage format (works but less optimized than mlmodelc)"
  rm -rf "$FALLBACK_OUT"
  mv "$MLCAND" "$FALLBACK_OUT"
  rm -rf "$TMP_DIR"
  
  if [ ! -d "$FALLBACK_OUT" ]; then
    echo "$p ERROR: Failed to create output at $FALLBACK_OUT"
    exit 1
  fi
  
  echo "$p Successfully created $FALLBACK_OUT"
  echo "$p Note: For better performance, install full Xcode to enable mlmodelc compilation"
  exit 0
else
  echo "$p Moving compiled model to final location"
  rm -rf "$OUT"
  mv "$MLCAND" "$OUT"
  rm -rf "$TMP_DIR"
  
  if [ ! -d "$OUT" ]; then
    echo "$p ERROR: Failed to create output at $OUT"
    exit 1
  fi
  
  echo "$p Successfully created $OUT"
  exit 0
fi