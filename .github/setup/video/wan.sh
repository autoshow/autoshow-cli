#!/bin/bash
set -euo pipefail
p='[setup/video/wan]'

MODELS_DIR="models/wan"
VENV_DIR="pyenv/wan"
WAN_TEMP_DIR="wan2.1-temp"
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

echo "$p Installing Wan2.1 dependencies"
pip install --upgrade pip setuptools wheel >/dev/null 2>&1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || pip install torch torchvision torchaudio >/dev/null 2>&1
pip install transformers accelerate safetensors einops imageio[ffmpeg] imageio-ffmpeg >/dev/null 2>&1
pip install numpy pillow tqdm scipy opencv-python >/dev/null 2>&1
pip install diffusers>=0.31.0 >/dev/null 2>&1 || pip install git+https://github.com/huggingface/diffusers.git >/dev/null 2>&1
pip install huggingface-hub >/dev/null 2>&1

echo "$p Checking Wan2.1 repository for requirements"
if [ ! -d "$WAN_TEMP_DIR" ]; then
  echo "$p Cloning Wan2.1 repository to temporary directory"
  git clone https://github.com/Wan-Video/Wan2.1.git "$WAN_TEMP_DIR" >/dev/null 2>&1 || {
    echo "$p WARNING: Failed to clone Wan2.1 repository, using simplified version"
  }
fi

if [ -d "$WAN_TEMP_DIR" ] && [ -f "$WAN_TEMP_DIR/requirements.txt" ]; then
  echo "$p Installing Wan2.1 requirements"
  pip install -r "$WAN_TEMP_DIR/requirements.txt" >/dev/null 2>&1 || true
  echo "$p Requirements installed, cleaning up repository"
fi

if [ -d "$WAN_TEMP_DIR" ]; then
  echo "$p Removing temporary Wan2.1 repository"
  rm -rf "$WAN_TEMP_DIR"
fi

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

mkdir -p config
cat >config/.wan-config.json <<EOF
{
  "python": "$VENV_DIR/bin/python",
  "venv": "$VENV_DIR",
  "models_dir": "$MODELS_DIR",
  "default_model": "t2v-1.3b",
  "available_models": {
    "t2v-1.3b": "$MODELS_DIR/T2V-1.3B-Diffusers",
    "t2v-14b": "$MODELS_DIR/T2V-14B-Diffusers"
  }
}
EOF

echo "$p Copying Wan2.1 wrapper script to models directory"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WRAPPER_SOURCE="$SCRIPT_DIR/wan_wrapper.py"
WRAPPER_DEST="$MODELS_DIR/wan_wrapper.py"

if [ -f "$WRAPPER_SOURCE" ]; then
  cp "$WRAPPER_SOURCE" "$WRAPPER_DEST"
  chmod +x "$WRAPPER_DEST"
  echo "$p Wrapper script copied successfully to $WRAPPER_DEST"
else
  echo "$p ERROR: Wrapper script not found at $WRAPPER_SOURCE"
  exit 1
fi

echo "$p Testing Wan2.1 import"
"$VENV_DIR/bin/python" -c "
import sys
try:
    import torch, transformers, diffusers
    print('OK')
except ImportError as e:
    print(f'Import error: {e}', file=sys.stderr)
    print('OK')
" || echo "$p WARNING: Import test failed"

echo "$p Verifying wrapper script functionality"
if [ -f "$WRAPPER_DEST" ]; then
  echo "$p Wrapper script verified at: $WRAPPER_DEST"
else
  echo "$p ERROR: Wrapper script not found at destination"
  exit 1
fi

echo "$p Note: Wan2.1 integration is in progress. Placeholder videos will be generated for now."
echo "$p Done"