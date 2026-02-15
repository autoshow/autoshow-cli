#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="$CONFIG_DIR/.cosyvoice-installed"
COSYVOICE_DIR="build/cosyvoice"
MODEL_NAME="${COSYVOICE_MODEL:-CosyVoice-300M-Instruct}"

# Map short model names to full model names
case "$MODEL_NAME" in
  "Fun-CosyVoice3-0.5B")
    MODELSCOPE_REPO="FunAudioLLM/Fun-CosyVoice3-0.5B-2512"
    HUGGINGFACE_REPO="FunAudioLLM/Fun-CosyVoice3-0.5B-2512"
    MODEL_DIR="Fun-CosyVoice3-0.5B"
    ;;
  "CosyVoice2-0.5B")
    MODELSCOPE_REPO="iic/CosyVoice2-0.5B"
    HUGGINGFACE_REPO="FunAudioLLM/CosyVoice2-0.5B"
    MODEL_DIR="CosyVoice2-0.5B"
    ;;
  "CosyVoice-300M")
    MODELSCOPE_REPO="iic/CosyVoice-300M"
    HUGGINGFACE_REPO="FunAudioLLM/CosyVoice-300M"
    MODEL_DIR="CosyVoice-300M"
    ;;
  "CosyVoice-300M-SFT")
    MODELSCOPE_REPO="iic/CosyVoice-300M-SFT"
    HUGGINGFACE_REPO="FunAudioLLM/CosyVoice-300M-SFT"
    MODEL_DIR="CosyVoice-300M-SFT"
    ;;
  "CosyVoice-300M-Instruct")
    MODELSCOPE_REPO="iic/CosyVoice-300M-Instruct"
    HUGGINGFACE_REPO="FunAudioLLM/CosyVoice-300M-Instruct"
    MODEL_DIR="CosyVoice-300M-Instruct"
    ;;
  "CosyVoice-ttsfrd")
    MODELSCOPE_REPO="iic/CosyVoice-ttsfrd"
    HUGGINGFACE_REPO="FunAudioLLM/CosyVoice-ttsfrd"
    MODEL_DIR="CosyVoice-ttsfrd"
    ;;
  *)
    log "ERROR: Invalid model name: $MODEL_NAME"
    log "Valid models: Fun-CosyVoice3-0.5B, CosyVoice2-0.5B, CosyVoice-300M, CosyVoice-300M-SFT, CosyVoice-300M-Instruct, CosyVoice-ttsfrd"
    exit 1
    ;;
esac

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
if [ -d "$COSYVOICE_DIR" ] && [ -d "$COSYVOICE_DIR/pretrained_models/$MODEL_DIR" ]; then
  if tts_python -c "
import sys
sys.path.insert(0, '$COSYVOICE_DIR')
sys.path.insert(0, '$COSYVOICE_DIR/third_party/Matcha-TTS')
from cosyvoice.cli.cosyvoice import CosyVoice
print('ok')
" 2>/dev/null | grep -q "ok"; then
    touch "$MARKER_FILE"
    log "CosyVoice ($MODEL_NAME) already installed"
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
  matplotlib torchcodec \
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
model_dir = os.path.join('$COSYVOICE_DIR', 'pretrained_models', '$MODEL_DIR')
snapshot_download('$MODELSCOPE_REPO', local_dir=model_dir)
print('Model downloaded successfully')
" 2>/dev/null || {
  log "ModelScope download failed, trying HuggingFace..."
  tts_pip install huggingface_hub >/dev/null 2>&1 || true
  tts_python -c "
from huggingface_hub import snapshot_download
import os
model_dir = os.path.join('$COSYVOICE_DIR', 'pretrained_models', '$MODEL_DIR')
snapshot_download('$HUGGINGFACE_REPO', local_dir=model_dir)
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
from cosyvoice.cli.cosyvoice import CosyVoice
print('ok')
" 2>/dev/null | grep -q "ok"; then
  touch "$MARKER_FILE"
  log "CosyVoice ($MODEL_NAME) installed successfully"
else
  log "WARNING: CosyVoice ($MODEL_NAME) installation verification failed"
  log "You may need to run setup manually"
fi
