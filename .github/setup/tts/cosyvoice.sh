#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="$CONFIG_DIR/.cosyvoice-installed"
COSYVOICE_DIR="build/cosyvoice"
MODEL_NAME="Fun-CosyVoice3-0.5B"

check_marker "$MARKER_FILE" && exit 0

# Check if Docker is available and prefer it
if command -v docker &>/dev/null; then
  log "Docker available, checking for CosyVoice container..."
  
  # Check if container already exists and is running
  if docker ps --format '{{.Names}}' | grep -q "cosyvoice-api"; then
    log "CosyVoice Docker container already running"
    touch "$MARKER_FILE"
    exit 0
  fi
  
  # Check if image exists
  if docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "cosyvoice"; then
    log "CosyVoice Docker image found, starting container..."
    docker run -d --name cosyvoice-api -p 50000:50000 cosyvoice:latest >/dev/null 2>&1 || \
      docker start cosyvoice-api >/dev/null 2>&1 || true
    touch "$MARKER_FILE"
    log "CosyVoice Docker container started"
    exit 0
  fi
  
  log "Docker available but CosyVoice image not found, falling back to local installation"
fi

# Local installation
require_tts_env

# Check if already installed locally
if [ -d "$COSYVOICE_DIR" ] && [ -d "$COSYVOICE_DIR/pretrained_models/$MODEL_NAME" ]; then
  if tts_python -c "
import sys
sys.path.insert(0, '$COSYVOICE_DIR')
sys.path.insert(0, '$COSYVOICE_DIR/third_party/Matcha-TTS')
from cosyvoice.cli.cosyvoice import AutoModel
print('ok')
" 2>/dev/null | grep -q "ok"; then
    touch "$MARKER_FILE"
    log "CosyVoice already installed"
    exit 0
  fi
fi

# Clone CosyVoice repository
if [ ! -d "$COSYVOICE_DIR" ]; then
  log "Cloning CosyVoice repository..."
  git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git "$COSYVOICE_DIR" >/dev/null 2>&1 || {
    log "ERROR: Failed to clone CosyVoice repository"
    exit 1
  }
fi

# Update submodules if needed
cd "$COSYVOICE_DIR"
git submodule update --init --recursive >/dev/null 2>&1 || true
cd - >/dev/null

# Install dependencies (CPU-only PyTorch is already in the TTS env)
# Note: WeTextProcessing requires pynini which needs OpenFST - skip it as it's optional
log "Installing CosyVoice dependencies..."

# Core dependencies required for CosyVoice
tts_pip install diffusers gdown modelscope omegaconf soundfile transformers hyperpyyaml openai-whisper \
  hydra-core lightning wget x_transformers pyarrow pyworld rich pydantic conformer onnxruntime inflect \
  >/dev/null 2>&1 || {
    log "ERROR: Failed to install core CosyVoice dependencies"
    exit 1
  }

# Download the model
log "Downloading $MODEL_NAME model (this may take a while)..."
mkdir -p "$COSYVOICE_DIR/pretrained_models"

tts_python -c "
from modelscope import snapshot_download
import os
model_dir = os.path.join('$COSYVOICE_DIR', 'pretrained_models', '$MODEL_NAME')
snapshot_download('FunAudioLLM/Fun-CosyVoice3-0.5B-2512', local_dir=model_dir)
print('Model downloaded successfully')
" 2>/dev/null || {
  log "ModelScope download failed, trying HuggingFace..."
  tts_pip install huggingface_hub >/dev/null 2>&1 || true
  tts_python -c "
from huggingface_hub import snapshot_download
import os
model_dir = os.path.join('$COSYVOICE_DIR', 'pretrained_models', '$MODEL_NAME')
snapshot_download('FunAudioLLM/Fun-CosyVoice3-0.5B-2512', local_dir=model_dir)
print('Model downloaded successfully')
" || {
    log "ERROR: Failed to download model"
    exit 1
  }
}

# Verify installation
if tts_python -c "
import sys
sys.path.insert(0, '$COSYVOICE_DIR')
sys.path.insert(0, '$COSYVOICE_DIR/third_party/Matcha-TTS')
from cosyvoice.cli.cosyvoice import AutoModel
print('ok')
" 2>/dev/null | grep -q "ok"; then
  touch "$MARKER_FILE"
  log "CosyVoice installed successfully"
else
  log "WARNING: CosyVoice installation verification failed"
  log "You may need to run setup manually"
fi
