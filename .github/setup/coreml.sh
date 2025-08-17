# .github/setup/coreml.sh
#!/bin/bash
set -euo pipefail
echo "Setting up whisper.cpp CoreML build..."
IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac
if [ "$IS_MAC" != true ]; then
  echo "CoreML setup is only supported on macOS"
  exit 1
fi
find_py() {
  for p in python3.{11..9} python3 /usr/local/bin/python3.{11..9} /opt/homebrew/bin/python3.{11..9} python; do
    if command -v "$p" &>/dev/null; then
      v=$("$p" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      if [[ $v =~ 3\.(9|10|11) ]]; then
        echo "$p"
        return 0
      fi
    fi
  done
  return 1
}
WHISPER_TEMP_DIR="whisper-coreml-temp"
BIN_DIR="bin"
MODELS_DIR="models"
VENV_DIR="$MODELS_DIR/coreml_env"
mkdir -p "$BIN_DIR"
mkdir -p "$MODELS_DIR"
if [ -d "$WHISPER_TEMP_DIR" ]; then
  rm -rf "$WHISPER_TEMP_DIR"
fi
echo "Cloning whisper.cpp..."
git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_TEMP_DIR" &>/dev/null
echo "Building whisper.cpp with CoreML..."
cmake -B "$WHISPER_TEMP_DIR/build" -S "$WHISPER_TEMP_DIR" -DGGML_METAL=ON -DWHISPER_COREML=ON -DBUILD_SHARED_LIBS=OFF &>/dev/null
cmake --build "$WHISPER_TEMP_DIR/build" --config Release &>/dev/null
if [ -f "$WHISPER_TEMP_DIR/build/bin/whisper-cli" ]; then
  cp "$WHISPER_TEMP_DIR/build/bin/whisper-cli" "$BIN_DIR/whisper-cli-coreml"
  chmod +x "$BIN_DIR/whisper-cli-coreml"
  echo "Created bin/whisper-cli-coreml"
else
  echo "ERROR: CoreML whisper-cli binary not found"
  exit 1
fi
echo "Verifying CoreML binary..."
if [ -x "$BIN_DIR/whisper-cli-coreml" ]; then
  echo "✓ whisper-cli-coreml is executable"
else
  echo "ERROR: whisper-cli-coreml is not executable"
  exit 1
fi
PY=$(find_py) || {
  echo "Need Python 3.9-3.11 to prepare CoreML conversion environment"
  exit 1
}
echo "Using Python: $PY"
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating CoreML conversion virtual environment..."
  "$PY" -m venv "$VENV_DIR"
fi
PIP="$VENV_DIR/bin/pip"
PYBIN="$VENV_DIR/bin/python"
"$PIP" install --upgrade pip setuptools wheel >/dev/null
"$PIP" install "numpy<2" >/dev/null || "$PIP" install "numpy<2" -U >/dev/null
"$PIP" install "torch==2.5.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null || "$PIP" install "torch==2.5.0" >/dev/null
"$PIP" install "coremltools>=7,<8" "transformers" "sentencepiece" "huggingface_hub" "safetensors" "ane-transformers" >/dev/null
"$PIP" install 'protobuf<4' >/dev/null || true
"$PIP" install "openai-whisper" >/dev/null || true
if [ -f "$WHISPER_TEMP_DIR/models/convert-whisper-to-coreml.py" ]; then
  cp "$WHISPER_TEMP_DIR/models/convert-whisper-to-coreml.py" "$MODELS_DIR/convert-whisper-to-coreml.py"
else
  echo "ERROR: convert-whisper-to-coreml.py not found in whisper.cpp"
  exit 1
fi
GEN_SCRIPT="$MODELS_DIR/generate-coreml-model.sh"
cat >"$GEN_SCRIPT" <<'EOS'
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
$PY models/convert-whisper-to-coreml.py --model "$CONV_MODEL" --encoder-only true
RC=$?
if [ $RC -ne 0 ]; then
  $PY models/convert-whisper-to-coreml.py --model "$CONV_MODEL" --encoder-only true --output-dir "$TMP_DIR"
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
EOS
chmod +x "$GEN_SCRIPT"
echo "Testing CoreML conversion environment..."
"$PYBIN" - <<'PY'
missing=[]
mods=["torch","coremltools","numpy","transformers","sentencepiece","huggingface_hub","ane_transformers","safetensors","whisper"]
for m in mods:
    try:
        __import__(m)
    except Exception as e:
        missing.append(f"{m}:{e}")
if missing:
    raise SystemExit("Missing modules: "+", ".join(missing))
print("✓ CoreML conversion Python deps OK")
PY
rm -rf "$WHISPER_TEMP_DIR"
echo "CoreML setup completed."
