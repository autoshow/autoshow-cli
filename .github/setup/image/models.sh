#!/bin/bash

set -euo pipefail

source "$(dirname "$0")/download.sh"
source "$(dirname "$0")/auth.sh"

download_sd15_models() {
  local p="[setup/image/models]"
  echo ""
  echo "Downloading SD 1.5 base model..."
  download_with_auth \
    "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors" \
    "$MODELS_DIR/v1-5-pruned-emaonly.safetensors" \
    "SD 1.5" \
    false \
    $((1600 * 1048576)) || echo "Warning: SD 1.5 download failed"
  
  echo ""
  echo "Downloading LCM-LoRA..."
  download_with_auth \
    "https://huggingface.co/latent-consistency/lcm-lora-sdv1-5/resolve/main/pytorch_lora_weights.safetensors" \
    "$MODELS_DIR/lcm-lora-sdv1-5.safetensors" \
    "LCM-LoRA" \
    false \
    $((60 * 1048576)) || echo "Warning: LCM-LoRA download failed"
}

download_sd3_models() {
  local p="[setup/image/models]"
  
  if [ "$SD3_ACCESS" != "true" ]; then
    display_access_instructions "SD3.5" "https://huggingface.co/stabilityai/stable-diffusion-3-medium"
    return
  fi
  
  echo ""
  echo "Attempting to download SD3.5 models..."
  
  SD3_SUCCESS=false
  if command -v huggingface-cli &>/dev/null; then
    download_with_hf_cli \
      "stabilityai/stable-diffusion-3-medium" \
      "sd3_medium_incl_clips_t5xxlfp16.safetensors" \
      "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" \
      "SD3 Medium" \
      $((5400 * 1048576)) && SD3_SUCCESS=true
  else
    download_with_auth \
      "https://huggingface.co/stabilityai/stable-diffusion-3-medium/resolve/main/sd3_medium_incl_clips_t5xxlfp16.safetensors" \
      "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" \
      "SD3 Medium" \
      true \
      $((5400 * 1048576)) && SD3_SUCCESS=true
  fi
  
  if [ "$SD3_SUCCESS" = false ]; then
    echo ""
    echo "Trying alternative SD3.5 Large..."
    
    if command -v huggingface-cli &>/dev/null; then
      download_with_hf_cli \
        "stabilityai/stable-diffusion-3.5-large" \
        "sd3.5_large.safetensors" \
        "$MODELS_DIR/sd3.5_large.safetensors" \
        "SD3.5 Large" \
        $((6500 * 1048576))
    else
      download_with_auth \
        "https://huggingface.co/stabilityai/stable-diffusion-3.5-large/resolve/main/sd3.5_large.safetensors" \
        "$MODELS_DIR/sd3.5_large.safetensors" \
        "SD3.5 Large" \
        true \
        $((6500 * 1048576))
    fi
  fi
}

download_text_encoders() {
  local p="[setup/image/models]"
  echo ""
  echo "Downloading text encoders..."
  
  try_alternative_download \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" \
    "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/clip_l.safetensors" \
    "$MODELS_DIR/clip_l.safetensors" \
    "CLIP-L" \
    $((230 * 1048576))
  
  download_with_auth \
    "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/clip_g.safetensors" \
    "$MODELS_DIR/clip_g.safetensors" \
    "CLIP-G" \
    false \
    $((690 * 1048576)) || echo "Warning: CLIP-G download failed"
  
  try_alternative_download \
    "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/t5xxl_fp16.safetensors" \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors" \
    "$MODELS_DIR/t5xxl_fp16.safetensors" \
    "T5XXL" \
    $((9000 * 1048576))
}

display_manual_download_info() {
  local p="[setup/image/models]"
  echo ""
  echo "Skipping SD3.5 downloads (authentication required)"
  echo ""
  echo "SD3.5 models can be manually downloaded from:"
  echo "  https://huggingface.co/stabilityai/stable-diffusion-3.5-large"
  echo "  https://huggingface.co/stabilityai/stable-diffusion-3-medium"
  echo ""
  echo "Required files for SD3.5:"
  echo "  - sd3_medium_incl_clips_t5xxlfp16.safetensors (recommended, all-in-one)"
  echo "  OR"
  echo "  - sd3.5_large.safetensors + clip_l.safetensors + clip_g.safetensors + t5xxl_fp16.safetensors"
}