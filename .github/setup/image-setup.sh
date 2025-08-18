#!/bin/bash

set -euo pipefail

echo "Setting up stable-diffusion.cpp for image generation..."

load_env() {
  local env_file="${1:-.env}"
  if [ -f "$env_file" ]; then
    echo "Loading environment from $env_file..."
    set -a
    while IFS='=' read -r key value; do
      if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]]; then
        value="${value%\"}"
        value="${value#\"}"
        export "$key=$value"
      fi
    done < <(grep -v '^#' "$env_file" | grep -v '^$')
    set +a
  fi
}

load_env

SD_CPP_DIR="stable-diffusion-cpp"
BIN_DIR="bin"
MODELS_DIR="models/sd"

mkdir -p "$BIN_DIR" "$MODELS_DIR"

if [ -d "$SD_CPP_DIR" ]; then
  echo "Updating stable-diffusion.cpp..."
  cd "$SD_CPP_DIR"
  git pull origin master
  git submodule update --init --recursive
  cd ..
else
  echo "Cloning stable-diffusion.cpp..."
  git clone --recursive https://github.com/leejet/stable-diffusion.cpp.git "$SD_CPP_DIR"
fi

echo "Building stable-diffusion.cpp..."
mkdir -p "$SD_CPP_DIR/build"
cd "$SD_CPP_DIR/build"

IS_MAC=false
HAS_CUDA=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
  *)
    if command -v nvcc &>/dev/null; then
      HAS_CUDA=true
    fi
    ;;
esac

if [ "$IS_MAC" = true ]; then
  echo "Building with Metal support for macOS..."
  cmake .. -DSD_METAL=ON -DCMAKE_BUILD_TYPE=Release &>/dev/null
elif [ "$HAS_CUDA" = true ]; then
  echo "Building with CUDA support..."
  cmake .. -DSD_CUDA=ON -DCMAKE_BUILD_TYPE=Release &>/dev/null
else
  echo "Building with CPU support..."
  cmake .. -DCMAKE_BUILD_TYPE=Release &>/dev/null
fi

cmake --build . --config Release &>/dev/null

if [ -f "./bin/sd" ]; then
  cp "./bin/sd" "../../$BIN_DIR/sd"
  chmod +x "../../$BIN_DIR/sd"
elif [ -f "./sd" ]; then
  cp "./sd" "../../$BIN_DIR/sd"
  chmod +x "../../$BIN_DIR/sd"
else
  echo "ERROR: sd binary not found"
  exit 1
fi

cd ../..

check_hf_auth() {
  local p="[setup/image-setup]"
  
  if [ -n "${HF_TOKEN:-}" ]; then
    echo "✓ Hugging Face token found in HF_TOKEN"
    echo "  Token starts with: ${HF_TOKEN:0:8}..."
    return 0
  elif [ -n "${HUGGING_FACE_HUB_TOKEN:-}" ]; then
    export HF_TOKEN="$HUGGING_FACE_HUB_TOKEN"
    echo "✓ Hugging Face token found in HUGGING_FACE_HUB_TOKEN"
    return 0
  elif [ -f "$HOME/.cache/huggingface/token" ]; then
    export HF_TOKEN=$(cat "$HOME/.cache/huggingface/token")
    echo "✓ Hugging Face token found in cache"
    return 0
  elif command -v huggingface-cli &>/dev/null && huggingface-cli whoami &>/dev/null 2>&1; then
    echo "✓ Authenticated via huggingface-cli"
    return 0
  else
    return 1
  fi
}

validate_file() {
  local file="$1"
  local min_size="$2"
  local expected_size="$3"
  
  if [ ! -f "$file" ]; then
    return 1
  fi
  
  local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
  
  if [ "$size" -eq 0 ]; then
    echo "  ⚠ File is empty (0 bytes), removing..."
    rm -f "$file"
    return 1
  fi
  
  if [ "$size" -lt "$min_size" ]; then
    local size_mb=$(($size / 1048576))
    local min_mb=$(($min_size / 1048576))
    echo "  ⚠ File too small (${size_mb}MB < ${min_mb}MB expected), removing..."
    rm -f "$file"
    return 1
  fi
  
  return 0
}

download_with_auth() {
  local url="$1"
  local output="$2"
  local name="$3"
  local requires_auth="${4:-false}"
  local min_size="${5:-1048576}"
  local max_retries=3
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    if [ -f "$output" ]; then
      if validate_file "$output" "$min_size" "$min_size"; then
        local size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null || echo "0")
        echo "✓ $name already exists ($(($size / 1048576)) MB)"
        return 0
      fi
    fi
    
    echo "Downloading $name (attempt $((retry + 1))/$max_retries)..."
    local temp_file="${output}.tmp"
    
    local auth_header=""
    if [ "$requires_auth" = "true" ] && [ -n "${HF_TOKEN:-}" ]; then
      auth_header="Authorization: Bearer $HF_TOKEN"
    fi
    
    local success=false
    if command -v wget &>/dev/null; then
      if [ -n "$auth_header" ]; then
        wget --quiet --show-progress --header="$auth_header" -O "$temp_file" "$url" && success=true
      else
        wget --quiet --show-progress -O "$temp_file" "$url" && success=true
      fi
    elif command -v curl &>/dev/null; then
      if [ -n "$auth_header" ]; then
        curl -L --progress-bar -H "$auth_header" -o "$temp_file" "$url" && success=true
      else
        curl -L --progress-bar -o "$temp_file" "$url" && success=true
      fi
    else
      echo "ERROR: wget or curl required"
      exit 1
    fi
    
    if [ "$success" = true ] && validate_file "$temp_file" "$min_size" "$min_size"; then
      mv "$temp_file" "$output"
      echo "✓ Downloaded $name successfully"
      return 0
    else
      rm -f "$temp_file"
      retry=$((retry + 1))
      if [ $retry -lt $max_retries ]; then
        echo "  Retrying download..."
        sleep 2
      fi
    fi
  done
  
  echo "ERROR: Failed to download $name after $max_retries attempts"
  return 1
}

download_with_hf_cli() {
  local repo="$1"
  local filename="$2"
  local output="$3"
  local name="$4"
  local min_size="${5:-1048576}"
  
  if [ -f "$output" ]; then
    if validate_file "$output" "$min_size" "$min_size"; then
      local size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null || echo "0")
      echo "✓ $name already exists ($(($size / 1048576)) MB)"
      return 0
    fi
  fi
  
  echo "Downloading $name using huggingface-cli..."
  huggingface-cli download "$repo" "$filename" --local-dir "$MODELS_DIR" --local-dir-use-symlinks False || {
    echo "ERROR: Failed to download $name"
    return 1
  }
  
  if [ -f "$MODELS_DIR/$filename" ] && [ "$MODELS_DIR/$filename" != "$output" ]; then
    mv "$MODELS_DIR/$filename" "$output"
  fi
  
  if validate_file "$output" "$min_size" "$min_size"; then
    echo "✓ Downloaded $name successfully"
    return 0
  else
    echo "ERROR: Downloaded file failed validation"
    return 1
  fi
}

echo ""
echo "Checking Hugging Face authentication..."
HAS_HF_AUTH=false
if check_hf_auth; then
  HAS_HF_AUTH=true
else
  echo "ℹ No Hugging Face authentication found"
  echo ""
  echo "To enable automatic download of SD3.5 and FLUX models:"
  echo "1. Get a token from: https://huggingface.co/settings/tokens"
  echo "2. Add to .env: HF_TOKEN=your_token_here"
  echo "   OR"
  echo "3. Install and login: pip install huggingface_hub && huggingface-cli login"
  echo ""
fi

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

if [ "$HAS_HF_AUTH" = true ]; then
  echo ""
  echo "Attempting to download SD3.5 models..."
  
  if command -v huggingface-cli &>/dev/null; then
    download_with_hf_cli \
      "stabilityai/stable-diffusion-3-medium" \
      "sd3_medium_incl_clips_t5xxlfp16.safetensors" \
      "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" \
      "SD3 Medium" \
      $((5400 * 1048576)) || {
        echo "Trying individual SD3.5 components..."
        download_with_auth \
          "https://huggingface.co/stabilityai/stable-diffusion-3.5-large/resolve/main/sd3.5_large.safetensors" \
          "$MODELS_DIR/sd3.5_large.safetensors" \
          "SD3.5 Large" \
          true \
          $((6500 * 1048576)) || echo "Warning: SD3.5 download requires repository access"
      }
  else
    download_with_auth \
      "https://huggingface.co/stabilityai/stable-diffusion-3-medium/resolve/main/sd3_medium_incl_clips_t5xxlfp16.safetensors" \
      "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" \
      "SD3 Medium" \
      true \
      $((5400 * 1048576)) || echo "Warning: SD3 download requires authentication and repository access"
  fi
  
  echo ""
  echo "Downloading text encoders..."
  download_with_auth \
    "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/clip_l.safetensors" \
    "$MODELS_DIR/clip_l.safetensors" \
    "CLIP-L" \
    false \
    $((240 * 1048576)) || echo "Warning: CLIP-L download failed"
  
  download_with_auth \
    "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/clip_g.safetensors" \
    "$MODELS_DIR/clip_g.safetensors" \
    "CLIP-G" \
    false \
    $((690 * 1048576)) || echo "Warning: CLIP-G download failed"
  
  download_with_auth \
    "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/t5xxl_fp16.safetensors" \
    "$MODELS_DIR/t5xxl_fp16.safetensors" \
    "T5XXL" \
    false \
    $((9000 * 1048576)) || echo "Warning: T5XXL download failed"
  
  echo ""
  echo "Downloading FLUX VAE..."
  download_with_auth \
    "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors" \
    "$MODELS_DIR/ae.safetensors" \
    "FLUX VAE" \
    true \
    $((100 * 1048576)) || echo "Warning: FLUX VAE download failed - authentication may be required"
  
  echo ""
  echo "Downloading FLUX Kontext (quantized)..."
  download_with_auth \
    "https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF/resolve/main/flux1-kontext-dev-Q8_0.gguf" \
    "$MODELS_DIR/flux1-kontext-dev-q8_0.gguf" \
    "FLUX Kontext Q8" \
    false \
    $((12000 * 1048576)) || echo "Warning: FLUX Kontext download failed"
else
  echo ""
  echo "Skipping SD3.5 and FLUX downloads (authentication required)"
  echo ""
  echo "SD3.5 models can be manually downloaded from:"
  echo "  https://huggingface.co/stabilityai/stable-diffusion-3.5-large"
  echo "  https://huggingface.co/stabilityai/stable-diffusion-3-medium"
  echo ""
  echo "Required files for SD3.5:"
  echo "  - sd3_medium_incl_clips_t5xxlfp16.safetensors (recommended, all-in-one)"
  echo "  OR"
  echo "  - sd3.5_large.safetensors + clip_l.safetensors + clip_g.safetensors + t5xxl_fp16.safetensors"
  echo ""
  echo "FLUX models from:"
  echo "  https://huggingface.co/black-forest-labs/FLUX.1-dev"
  echo "  https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF"
fi

echo ""
echo "Validating downloaded models..."
ISSUES=""

check_model() {
  local file="$1"
  local name="$2"
  local min_mb="$3"
  
  if [ -f "$MODELS_DIR/$file" ]; then
    local size=$(stat -f%z "$MODELS_DIR/$file" 2>/dev/null || stat -c%s "$MODELS_DIR/$file" 2>/dev/null || echo "0")
    local size_mb=$(($size / 1048576))
    if [ "$size" -eq 0 ]; then
      ISSUES="${ISSUES}\n  ⚠ $name is empty (0 bytes) - delete and re-download"
    elif [ "$size_mb" -lt "$min_mb" ]; then
      ISSUES="${ISSUES}\n  ⚠ $name seems corrupted (${size_mb}MB < ${min_mb}MB expected) - delete and re-download"
    else
      echo "  ✓ $name (${size_mb} MB)"
    fi
  fi
}

check_model "v1-5-pruned-emaonly.safetensors" "SD 1.5" 1600
check_model "sd3_medium_incl_clips_t5xxlfp16.safetensors" "SD3 Medium" 5400
check_model "flux1-kontext-dev-q8_0.gguf" "FLUX Kontext" 12000
check_model "ae.safetensors" "FLUX VAE" 100

if [ -n "$ISSUES" ]; then
  echo ""
  echo "⚠ Some models have issues:"
  echo -e "$ISSUES"
fi

rm -rf "$SD_CPP_DIR"

if [ -x "$BIN_DIR/sd" ] && [ -f "$MODELS_DIR/v1-5-pruned-emaonly.safetensors" ]; then
  echo ""
  echo "stable-diffusion.cpp setup completed!"
  echo "✓ SD 1.5 model ready"
  
  if [ -f "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" ] || [ -f "$MODELS_DIR/sd3.5_large.safetensors" ]; then
    echo "✓ SD3.5 model ready"
  fi
  
  if [ -f "$MODELS_DIR/flux1-kontext-dev-q8_0.gguf" ]; then
    echo "✓ FLUX Kontext model ready"
  fi
else
  echo "ERROR: Setup verification failed"
  exit 1
fi