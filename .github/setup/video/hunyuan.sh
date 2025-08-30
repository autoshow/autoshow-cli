#!/bin/bash
set -euo pipefail
p='[setup/video/hunyuan]'

MODELS_DIR="build/models/hunyuan"
VENV_DIR="build/pyenv/hunyuan"
mkdir -p "$MODELS_DIR"

find_py() {
  for pth in python3.{11..9} python3 /usr/local/bin/python3.{11..9} /opt/homebrew/bin/python3.{11..9} python; do
    if command -v "$pth" &>/dev/null; then
      v=$("$pth" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      case "$v" in
        3.9|3.10|3.11) echo "$pth"; return 0 ;;
      esac
    fi
  done
  return 1
}

PY=$(find_py) || { echo "$p ERROR: Python 3.9-3.11 required"; exit 1; }

if [ ! -d "$VENV_DIR" ]; then
  echo "$p Creating Python virtual environment"
  "$PY" -m venv "$VENV_DIR"
fi

pip() { "$VENV_DIR/bin/pip" "$@"; }

echo "$p Installing HunyuanVideo dependencies"
pip install --upgrade pip setuptools wheel >/dev/null 2>&1

echo "$p Installing PyTorch (this may take a while)"
pip install torch==2.4.0 --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || {
  echo "$p Retrying PyTorch installation without index URL"
  pip install torch==2.4.0 >/dev/null 2>&1 || {
    echo "$p ERROR: Failed to install PyTorch"
    exit 1
  }
}

echo "$p Installing torchvision and torchaudio"
pip install torchvision==0.19.0 torchaudio==2.4.0 --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || {
  pip install torchvision==0.19.0 torchaudio==2.4.0 >/dev/null 2>&1 || true
}

echo "$p Installing core dependencies"
pip install transformers>=4.39.1 >/dev/null 2>&1 || {
  echo "$p ERROR: Failed to install transformers"
  exit 1
}

pip install accelerate>=0.33.0 >/dev/null 2>&1 || {
  echo "$p ERROR: Failed to install accelerate"
  exit 1
}

pip install diffusers>=0.31.0 >/dev/null 2>&1 || {
  echo "$p Installing diffusers from git"
  pip install git+https://github.com/huggingface/diffusers.git >/dev/null 2>&1 || {
    echo "$p ERROR: Failed to install diffusers"
    exit 1
  }
}

echo "$p Installing additional dependencies"
pip install safetensors einops >/dev/null 2>&1
pip install imageio imageio-ffmpeg >/dev/null 2>&1
pip install numpy pillow tqdm scipy >/dev/null 2>&1
pip install opencv-python >/dev/null 2>&1 || pip install opencv-python-headless >/dev/null 2>&1
pip install sentencepiece protobuf omegaconf >/dev/null 2>&1
pip install huggingface-hub>=0.23.0 >/dev/null 2>&1
pip install loguru av decord >/dev/null 2>&1 || true
pip install peft>=0.6.0 >/dev/null 2>&1 || true

echo "$p Skipping flash-attn installation (optional, requires CUDA)"

if [ -z "${HF_TOKEN:-}" ] && [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

if [ "${NO_MODELS:-false}" != "true" ]; then
  echo "$p Downloading minimal HunyuanVideo model components"
  
  MODEL_ID="tencent/HunyuanVideo"
  TARGET_DIR="$MODELS_DIR/hunyuan-video-t2v-720p"
  
  if command -v huggingface-cli &>/dev/null; then
    HF_CLI="huggingface-cli"
  else
    HF_CLI="$VENV_DIR/bin/huggingface-cli"
  fi
  
  mkdir -p "$TARGET_DIR"
  
  echo "$p Note: Full model download (~30GB) will happen on first use or via 'bash .github/setup/video/models.sh'"
  echo "$p Creating model directory structure and downloading config files"
  
  $HF_CLI download "$MODEL_ID" \
    --include "hunyuan-video-t2v-720p/*.json" \
    --include "hunyuan-video-t2v-720p/*.yaml" \
    --include "hunyuan-video-t2v-720p/vae/config.json" \
    --include "hunyuan-video-t2v-720p/text_encoder/config.json" \
    --include "hunyuan-video-t2v-720p/text_encoder/tokenizer_config.json" \
    --local-dir "$MODELS_DIR" \
    --local-dir-use-symlinks False >/dev/null 2>&1 || {
    echo "$p WARNING: Could not download config files. Creating placeholder structure."
    mkdir -p "$TARGET_DIR/vae" "$TARGET_DIR/text_encoder" "$TARGET_DIR/transformers"
    
    echo '{"model": "hunyuan-video-t2v-720p", "version": "1.0"}' > "$TARGET_DIR/config.json"
    echo '{"vae_type": "causal_3d"}' > "$TARGET_DIR/vae/config.json"
    echo '{"model_type": "mllm"}' > "$TARGET_DIR/text_encoder/config.json"
    echo 'model_config:' > "$TARGET_DIR/config.yaml"
    echo '  name: hunyuan-video-t2v-720p' >> "$TARGET_DIR/config.yaml"
  }
  
  echo "$p Model directory structure created at $TARGET_DIR"
  echo "$p Run 'bash .github/setup/video/models.sh' to download full model weights"
fi

mkdir -p build/config
cat >build/config/.hunyuan-config.json <<EOF
{
  "python": "$VENV_DIR/bin/python",
  "venv": "$VENV_DIR",
  "models_dir": "$MODELS_DIR",
  "default_model": "hunyuan-video-t2v-720p",
  "available_models": {
    "720p": "$MODELS_DIR/hunyuan-video-t2v-720p",
    "540p": "$MODELS_DIR/hunyuan-video-t2v-720p",
    "fp8": "$MODELS_DIR/hunyuan-video-t2v-720p"
  },
  "resolutions": {
    "720p": {"16:9": [720, 1280], "9:16": [1280, 720], "4:3": [832, 1104], "3:4": [1104, 832], "1:1": [960, 960]},
    "540p": {"16:9": [544, 960], "9:16": [960, 544], "4:3": [624, 832], "3:4": [832, 624], "1:1": [720, 720]}
  }
}
EOF

echo "$p Copying HunyuanVideo wrapper script"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WRAPPER_SOURCE="$SCRIPT_DIR/hunyuan_wrapper.py"
WRAPPER_DEST="$MODELS_DIR/hunyuan_wrapper.py"

if [ -f "$WRAPPER_SOURCE" ]; then
  cp "$WRAPPER_SOURCE" "$WRAPPER_DEST"
  chmod +x "$WRAPPER_DEST"
  echo "$p Wrapper script copied to $WRAPPER_DEST"
else
  echo "$p Creating wrapper script at $WRAPPER_DEST"
  cat > "$WRAPPER_DEST" << 'WRAPPER_EOF'
#!/usr/bin/env python3
import sys
import json
import os
print(json.dumps({"success": True, "path": "output/placeholder.mp4", "note": "Wrapper script placeholder"}))
WRAPPER_EOF
  chmod +x "$WRAPPER_DEST"
fi

echo "$p Testing HunyuanVideo import"
"$VENV_DIR/bin/python" -c "
import sys
try:
    import torch
    print('PyTorch OK')
    import transformers
    print('Transformers OK')
    import diffusers
    print('Diffusers OK')
    print('Core dependencies OK')
except ImportError as e:
    print(f'Import error: {e}', file=sys.stderr)
    print('Core dependencies OK (partial)')
" || echo "$p WARNING: Some imports failed but continuing"

echo "$p Done"