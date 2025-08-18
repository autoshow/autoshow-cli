#!/bin/bash
set -euo pipefail
p='[setup/image/sd1_5]'
MODELS_DIR="models/sd"
mkdir -p "$MODELS_DIR"
validate_file() {
  local f="$1"
  local min_bytes="$2"
  if [ ! -f "$f" ]; then return 1; fi
  local size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo "0")
  [ "$size" -ge "$min_bytes" ]
}
download_file() {
  local url="$1"
  local out="$2"
  local name="$3"
  local min_bytes="$4"
  local tries=3
  local n=0
  while [ $n -lt $tries ]; do
    if validate_file "$out" "$min_bytes"; then
      local size=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out" 2>/dev/null || echo "0")
      echo "$p ✓ $name exists $((size/1048576))MB"
      return 0
    fi
    echo "$p Downloading $name attempt $((n+1))/$tries"
    local tmp="${out}.tmp"
    if command -v curl &>/dev/null; then
      curl -L --progress-bar -o "$tmp" "$url" >/dev/null 2>&1 || true
    else
      wget --quiet --show-progress -O "$tmp" "$url" >/dev/null 2>&1 || true
    fi
    if validate_file "$tmp" "$min_bytes"; then
      mv "$tmp" "$out"
      echo "$p ✓ Downloaded $name"
      return 0
    fi
    rm -f "$tmp"
    n=$((n+1))
    sleep 2
  done
  echo "$p ERROR: Failed to download $name"
  return 1
}
download_file "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors" "$MODELS_DIR/v1-5-pruned-emaonly.safetensors" "SD 1.5" $((1600*1048576))
download_file "https://huggingface.co/latent-consistency/lcm-lora-sdv1-5/resolve/main/pytorch_lora_weights.safetensors" "$MODELS_DIR/lcm-lora-sdv1-5.safetensors" "LCM-LoRA" $((60*1048576))
echo "$p Done"