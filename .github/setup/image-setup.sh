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
    
    echo "  Verifying token validity..."
    local whoami_response=$(curl -s -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/api/whoami 2>/dev/null || echo "{}")
    if echo "$whoami_response" | grep -q '"name"'; then
      local username=$(echo "$whoami_response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
      echo "  ✓ Token is valid for user: $username"
    else
      echo "  ⚠ Token may be invalid or expired. Please check your token."
      echo "    Get a new token from: https://huggingface.co/settings/tokens"
    fi
    
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

check_model_access() {
  local repo="$1"
  local model_name="$2"
  local p="[setup/image-setup]"
  
  if [ -z "${HF_TOKEN:-}" ]; then
    return 1
  fi
  
  echo "  Checking access to $model_name..."
  
  local api_url="https://huggingface.co/api/models/$repo"
  local response=$(curl -s -H "Authorization: Bearer $HF_TOKEN" "$api_url" 2>/dev/null || echo "{}")
  
  if echo "$response" | grep -q '"gated"'; then
    if echo "$response" | grep -q '"gated":true'; then
      echo "    ⚠ $model_name is a gated model"
      
      if echo "$response" | grep -q '"gate_status":"granted"'; then
        echo "    ✓ You have been granted access to $model_name"
        return 0
      elif echo "$response" | grep -q '"gate_status":"pending"'; then
        echo "    ⏳ Your access request for $model_name is pending approval"
        return 1
      else
        echo "    ❌ You need to request access to $model_name"
        echo "       Visit: https://huggingface.co/$repo"
        echo "       Click 'Agree and access repository' to accept the license"
        return 1
      fi
    fi
  fi
  
  return 0
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
    local http_code=""
    
    if command -v curl &>/dev/null; then
      if [ -n "$auth_header" ]; then
        http_code=$(curl -w "%{http_code}" -L --progress-bar -H "$auth_header" -o "$temp_file" "$url" 2>/dev/null || echo "000")
      else
        http_code=$(curl -w "%{http_code}" -L --progress-bar -o "$temp_file" "$url" 2>/dev/null || echo "000")
      fi
      
      if [ "$http_code" = "200" ] || [ "$http_code" = "206" ]; then
        success=true
      elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
        rm -f "$temp_file"
        echo "  ⚠ Access denied (HTTP $http_code)."
        return 1
      fi
    elif command -v wget &>/dev/null; then
      if [ -n "$auth_header" ]; then
        wget --quiet --show-progress --header="$auth_header" -O "$temp_file" "$url" && success=true
      else
        wget --quiet --show-progress -O "$temp_file" "$url" && success=true
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
  
  local temp_dir="$MODELS_DIR/.tmp_download"
  mkdir -p "$temp_dir"
  
  if huggingface-cli download "$repo" "$filename" --local-dir "$temp_dir" --local-dir-use-symlinks False 2>&1 | grep -q "401\|403\|Access denied"; then
    echo "  ⚠ Access denied. You need to accept the license agreement."
    echo "    Visit: https://huggingface.co/$repo"
    echo "    Click 'Agree and access repository' to accept the license"
    rm -rf "$temp_dir"
    return 1
  fi
  
  if [ -f "$temp_dir/$filename" ]; then
    mv "$temp_dir/$filename" "$output"
    rm -rf "$temp_dir"
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
  echo "Checking access to gated models..."
  
  SD3_ACCESS=false
  FLUX_ACCESS=false
  
  if check_model_access "stabilityai/stable-diffusion-3-medium" "SD3 Medium"; then
    SD3_ACCESS=true
  fi
  
  if check_model_access "black-forest-labs/FLUX.1-dev" "FLUX.1-dev"; then
    FLUX_ACCESS=true
  fi
  
  if [ "$SD3_ACCESS" = true ]; then
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
  else
    echo ""
    echo "ℹ Skipping SD3.5 models (access not granted yet)"
    echo "  To use SD3.5 models:"
    echo "  1. Visit https://huggingface.co/stabilityai/stable-diffusion-3-medium"
    echo "  2. Click 'Agree and access repository'"
    echo "  3. Run setup again"
  fi
  
  echo ""
  echo "Downloading text encoders..."
  
  download_with_auth \
    "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" \
    "$MODELS_DIR/clip_l.safetensors" \
    "CLIP-L" \
    false \
    $((230 * 1048576)) || {
      echo "Trying alternative CLIP-L source..."
      download_with_auth \
        "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/clip_l.safetensors" \
        "$MODELS_DIR/clip_l.safetensors" \
        "CLIP-L" \
        false \
        $((230 * 1048576)) || echo "Warning: CLIP-L download failed"
    }
  
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
    $((9000 * 1048576)) || {
      echo "Trying alternative T5XXL source..."
      download_with_auth \
        "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors" \
        "$MODELS_DIR/t5xxl_fp16.safetensors" \
        "T5XXL" \
        false \
        $((9000 * 1048576)) || echo "Warning: T5XXL download failed"
    }
  
  if [ "$FLUX_ACCESS" = true ]; then
    echo ""
    echo "Downloading FLUX VAE..."
    
    VAE_SUCCESS=false
    if command -v huggingface-cli &>/dev/null; then
      download_with_hf_cli \
        "black-forest-labs/FLUX.1-dev" \
        "ae.safetensors" \
        "$MODELS_DIR/ae.safetensors" \
        "FLUX VAE" \
        $((100 * 1048576)) && VAE_SUCCESS=true
    fi
    
    if [ "$VAE_SUCCESS" = false ]; then
      download_with_auth \
        "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors" \
        "$MODELS_DIR/ae.safetensors" \
        "FLUX VAE" \
        true \
        $((100 * 1048576))
    fi
  else
    echo ""
    echo "ℹ Skipping FLUX VAE (access not granted yet)"
    echo "  To use FLUX models:"
    echo "  1. Visit https://huggingface.co/black-forest-labs/FLUX.1-dev"
    echo "  2. Click 'Agree and access repository'"
    echo "  3. Wait for approval (may take 1-2 days)"
    echo "  4. Run setup again"
    echo ""
    echo "  Alternative (no auth required): FLUX.1-schnell VAE"
    echo "  Download manually from: https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors"
  fi
  
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
check_model "clip_l.safetensors" "CLIP-L" 230
check_model "t5xxl_fp16.safetensors" "T5XXL" 9000

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
    if [ -f "$MODELS_DIR/ae.safetensors" ] && [ -f "$MODELS_DIR/clip_l.safetensors" ]; then
      echo "✓ FLUX Kontext model ready"
    else
      echo "⚠ FLUX Kontext model found but missing dependencies (VAE/CLIP)"
    fi
  fi
  
  echo ""
  echo "Next steps if models are missing:"
  echo "1. Visit the model pages and click 'Agree and access repository'"
  echo "2. Wait for approval (instant for SD3, 1-2 days for FLUX)"
  echo "3. Run setup again: npm run setup"
else
  echo "ERROR: Setup verification failed"
  exit 1
fi