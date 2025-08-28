#!/bin/bash
set -euo pipefail
p='[setup/video/models]'

MODELS_DIR="build/models/wan"
VENV_DIR="build/pyenv/wan"

if [ ! -x "$VENV_DIR/bin/pip" ]; then
  echo "$p ERROR: Video generation environment not found. Run base setup first."
  exit 1
fi

echo "$p Downloading video generation models"

download_diffusers_model() {
  local model_name="$1"
  local model_id="$2"
  local model_dir="$MODELS_DIR/$model_name"
  
  if [ -d "$model_dir" ]; then
    echo "$p Model $model_name already exists"
    return 0
  fi
  
  echo "$p Downloading $model_name from Hugging Face (Diffusers version)"
  
  if command -v huggingface-cli &>/dev/null; then
    huggingface-cli download "$model_id" --local-dir "$model_dir" --local-dir-use-symlinks False >/dev/null 2>&1 || {
      echo "$p WARNING: Failed to download $model_name"
      return 1
    }
  else
    "$VENV_DIR/bin/huggingface-cli" download "$model_id" --local-dir "$model_dir" --local-dir-use-symlinks False >/dev/null 2>&1 || {
      echo "$p WARNING: Failed to download $model_name"
      return 1
    }
  fi
  
  echo "$p Downloaded $model_name successfully"
  return 0
}

echo "$p Downloading T2V-1.3B model (Diffusers version)"
download_diffusers_model "T2V-1.3B-Diffusers" "Wan-AI/Wan2.1-T2V-1.3B-Diffusers"

echo "$p Video generation models setup complete"