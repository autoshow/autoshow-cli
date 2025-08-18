#!/bin/bash
set -euo pipefail
MODEL="${1:-base}"
OUT="models/ggml-${MODEL}-encoder.mlmodelc"
if [ -d "$OUT" ]; then
  echo "CoreML encoder already exists: $OUT"
  exit 0
fi
PY="models/coreml_env/bin/python"
if [ ! -x "$PY" ]; then
  PY="python3"
fi
case "$MODEL" in
  tiny|tiny.en|base|base.en|small|small.en|medium|medium.en|large|large-v1|large-v2|large-v3|large-v3-turbo) ;;
  *) echo "Unsupported model: $MODEL"; exit 1 ;;
esac
CONV_MODEL="$MODEL"
if [[ "$MODEL" == "large" || "$MODEL" == "large-v1" || "$MODEL" == "large-v2" || "$MODEL" == "large-v3" ]]; then
  CONV_MODEL="large-v3"
fi
TMP_DIR="models/tmp-coreml-${MODEL}"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
set +e
$PY .github/setup/transcription/convert-whisper-to-coreml.py --model "$CONV_MODEL" --encoder-only true
RC=$?
if [ $RC -ne 0 ]; then
  $PY .github/setup/transcription/convert-whisper-to-coreml.py --model "$CONV_MODEL" --encoder-only true --output-dir "$TMP_DIR"
  RC=$?
fi
set -e
MLCAND=""
if [ -d "$TMP_DIR" ]; then
  CANDIDATE_C=$(find "$TMP_DIR" -type d -name "*.mlmodelc" -maxdepth 2 | head -n 1)
  CANDIDATE_P=$(find "$TMP_DIR" -type d -name "*.mlpackage" -maxdepth 2 | head -n 1)
  if [ -n "${CANDIDATE_C:-}" ]; then
    MLCAND="$CANDIDATE_C"
  elif [ -n "${CANDIDATE_P:-}" ]; then
    MLCAND="$CANDIDATE_P"
  fi
fi
if [ -z "$MLCAND" ]; then
  PKG_DEFAULT="models/coreml-encoder-${CONV_MODEL}.mlpackage"
  if [ -d "$PKG_DEFAULT" ]; then
    MLCAND="$PKG_DEFAULT"
  fi
fi
if [ -z "$MLCAND" ]; then
  echo "No CoreML artifact produced for $MODEL"
  exit 1
fi
if [[ "$MLCAND" == *.mlpackage ]]; then
  COMPILED_DIR="$TMP_DIR/compiled"
  mkdir -p "$COMPILED_DIR"
  if command -v xcrun &>/dev/null; then
    xcrun coremlc compile "$MLCAND" "$COMPILED_DIR" >/dev/null 2>&1 || xcrun coremlcompiler compile "$MLCAND" "$COMPILED_DIR" >/dev/null 2>&1
  else
    echo "xcrun not found. Install Command Line Tools: xcode-select --install"
    exit 1
  fi
  CANDIDATE=$(find "$COMPILED_DIR" -type d -name "*.mlmodelc" -maxdepth 2 | head -n 1)
else
  CANDIDATE="$MLCAND"
fi
if [ -z "$CANDIDATE" ]; then
  echo "No .mlmodelc produced"
  exit 1
fi
rm -rf "$OUT"
mv "$CANDIDATE" "$OUT"
rm -rf "$TMP_DIR"
echo "Created $OUT"