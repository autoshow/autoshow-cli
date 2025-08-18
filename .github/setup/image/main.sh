#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/auth.sh"
source "$SCRIPT_DIR/download.sh"
source "$SCRIPT_DIR/validate.sh"
source "$SCRIPT_DIR/models.sh"
source "$SCRIPT_DIR/build.sh"

load_env() {
  local env_file="${1:-.env}"
  local p="[setup/image/main]"
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

main() {
  local p="[setup/image/main]"
  echo "Starting image generation setup..."
  
  load_env
  
  export BIN_DIR="bin"
  export MODELS_DIR="models/sd"
  
  mkdir -p "$BIN_DIR" "$MODELS_DIR"
  
  build_stable_diffusion_cpp
  
  echo ""
  echo "Checking Hugging Face authentication..."
  HAS_HF_AUTH=false
  if check_hf_auth; then
    HAS_HF_AUTH=true
  else
    display_auth_instructions
  fi
  
  download_sd15_models
  
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
    
    export SD3_ACCESS
    export FLUX_ACCESS
    
    download_sd3_models
    download_text_encoders
  else
    display_manual_download_info
  fi
  
  validate_all_models
  cleanup_build_artifacts
  verify_setup_completion
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi