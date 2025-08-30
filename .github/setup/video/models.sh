#!/bin/bash
set -euo pipefail
p='[setup/video/models]'

MODELS_DIR="build/models/hunyuan"
VENV_DIR="build/pyenv/hunyuan"

if [ ! -x "$VENV_DIR/bin/pip" ]; then
  echo "$p ERROR: Video generation environment not found. Run base setup first."
  exit 1
fi

echo "$p Checking for HunyuanVideo models"

TARGET_DIR="$MODELS_DIR/hunyuan-video-t2v-720p"
mkdir -p "$TARGET_DIR/transformers"

TRANSFORMER_FILE="$TARGET_DIR/transformers/mp_rank_00_model_states.pt"

if [ -f "$TRANSFORMER_FILE" ]; then
  FILE_SIZE=$(du -h "$TRANSFORMER_FILE" | cut -f1)
  echo "$p HunyuanVideo transformer model already exists ($FILE_SIZE)"
  echo "$p Setup complete"
  exit 0
fi

if command -v huggingface-cli &>/dev/null; then
  HF_CLI="huggingface-cli"
elif [ -x "$VENV_DIR/bin/huggingface-cli" ]; then
  HF_CLI="$VENV_DIR/bin/huggingface-cli"
else
  echo "$p ERROR: huggingface-cli not found"
  exit 1
fi

echo "$p Downloading HunyuanVideo models (30GB+, this will take time)"
echo "$p Using: $HF_CLI"

echo "$p Downloading transformer model (largest component ~30GB)"
$HF_CLI download tencent/HunyuanVideo \
  hunyuan-video-t2v-720p/transformers/mp_rank_00_model_states.pt \
  --local-dir "$MODELS_DIR" \
  --local-dir-use-symlinks False

echo "$p Downloading VAE model"
$HF_CLI download tencent/HunyuanVideo \
  --include "hunyuan-video-t2v-720p/vae/*" \
  --local-dir "$MODELS_DIR" \
  --local-dir-use-symlinks False

echo "$p Downloading text encoder"
$HF_CLI download tencent/HunyuanVideo \
  --include "hunyuan-video-t2v-720p/text_encoder/*" \
  --include "hunyuan-video-t2v-720p/text_encoder_2/*" \
  --local-dir "$MODELS_DIR" \
  --local-dir-use-symlinks False

echo "$p Downloading config files"
$HF_CLI download tencent/HunyuanVideo \
  --include "hunyuan-video-t2v-720p/*.json" \
  --include "hunyuan-video-t2v-720p/*.yaml" \
  --local-dir "$MODELS_DIR" \
  --local-dir-use-symlinks False

if [ -f "$TRANSFORMER_FILE" ]; then
  FILE_SIZE=$(du -h "$TRANSFORMER_FILE" | cut -f1)
  echo "$p Successfully downloaded transformer model ($FILE_SIZE)"
else
  echo "$p ERROR: Transformer model failed to download"
  exit 1
fi

if [ -d "$TARGET_DIR/vae" ] && [ -d "$TARGET_DIR/text_encoder" ]; then
  echo "$p All components downloaded successfully"
  TOTAL_SIZE=$(du -sh "$TARGET_DIR" | cut -f1)
  echo "$p Total model size: $TOTAL_SIZE"
else
  echo "$p WARNING: Some components may be missing"
fi

echo "$p HunyuanVideo models ready for use"