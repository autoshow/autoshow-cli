#!/bin/bash
set -euo pipefail
p='[setup/video/cogvideo]'

VENV_DIR="build/pyenv/cogvideo"
MODELS_DIR="build/models/cogvideo"
mkdir -p "$MODELS_DIR"

find_py() {
  for pth in python3.{12..9} python3 /usr/local/bin/python3.{12..9} /opt/homebrew/bin/python3.{12..9} python; do
    if command -v "$pth" &>/dev/null; then
      v=$("$pth" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      case "$v" in
        3.9|3.10|3.11|3.12) echo "$pth"; return 0 ;;
      esac
    fi
  done
  return 1
}

PY=$(find_py) || { echo "$p ERROR: Python 3.9-3.12 required"; exit 1; }

if [ ! -d "$VENV_DIR" ]; then
  echo "$p Creating Python virtual environment"
  "$PY" -m venv "$VENV_DIR"
fi

pip() { "$VENV_DIR/bin/pip" "$@"; }

echo "$p Installing CogVideoX dependencies"
pip install --upgrade pip setuptools wheel >/dev/null 2>&1

echo "$p Installing PyTorch (this may take a while)"
pip install torch==2.4.0 --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || {
  echo "$p Retrying PyTorch installation without index URL"
  pip install torch==2.4.0 >/dev/null 2>&1 || {
    echo "$p ERROR: Failed to install PyTorch"
    exit 1
  }
}

echo "$p Installing diffusers and dependencies"
pip install diffusers>=0.31.0 transformers>=4.39.0 accelerate>=0.33.0 >/dev/null 2>&1 || {
  echo "$p ERROR: Failed to install diffusers"
  exit 1
}

pip install imageio imageio-ffmpeg safetensors einops >/dev/null 2>&1
pip install sentencepiece protobuf omegaconf >/dev/null 2>&1
pip install huggingface-hub>=0.23.0 >/dev/null 2>&1

if [ -z "${HF_TOKEN:-}" ] && [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

if [ "${NO_MODELS:-false}" != "true" ]; then
  echo "$p Pre-downloading CogVideoX-2B model info"
  
  "$VENV_DIR/bin/python" -c "
from huggingface_hub import snapshot_download
import os

os.makedirs('$MODELS_DIR', exist_ok=True)

try:
    print('Downloading model config files...')
    snapshot_download(
        'THUDM/CogVideoX-2b',
        cache_dir='$MODELS_DIR',
        allow_patterns=['*.json', '*.txt', 'README.md'],
        ignore_patterns=['*.safetensors', '*.bin', '*.pt']
    )
    print('Config files downloaded. Full model will download on first use.')
except Exception as e:
    print(f'Note: Config pre-download failed: {e}')
    print('Model will download on first use.')
" || echo "$p Model will download on first use"
fi

mkdir -p build/config
cat >build/config/.cogvideo-config.json <<EOF
{
  "python": "$VENV_DIR/bin/python",
  "venv": "$VENV_DIR",
  "models_dir": "$MODELS_DIR",
  "default_model": "cogvideo-2b",
  "available_models": {
    "cogvideo-2b": "THUDM/CogVideoX-2b",
    "cogvideo-5b": "THUDM/CogVideoX-5b",
    "cogvideo-5b-i2v": "THUDM/CogVideoX-5b-I2V"
  }
}
EOF

echo "$p Testing imports"
"$VENV_DIR/bin/python" -c "
import sys
try:
    import torch
    import diffusers
    import transformers
    print('PyTorch version:', torch.__version__)
    print('Diffusers version:', diffusers.__version__)
    print('All imports successful')
except ImportError as e:
    print(f'Import error: {e}', file=sys.stderr)
    sys.exit(1)
" || { echo "$p ERROR: Import test failed"; exit 1; }

echo "$p Done! CogVideoX is ready to use"
echo "$p Run: npm run as -- video generate --prompt 'your prompt' --model cogvideo-2b"
echo "$p Note: First run will download the full model (~10GB for 2B, ~20GB for 5B)"