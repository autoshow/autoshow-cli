#!/bin/bash

set -euo pipefail

check_model() {
  local file="$1"
  local name="$2"
  local min_mb="$3"
  local p="[setup/image/validate]"
  
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

validate_all_models() {
  local p="[setup/image/validate]"
  echo ""
  echo "Validating downloaded models..."
  ISSUES=""
  
  check_model "v1-5-pruned-emaonly.safetensors" "SD 1.5" 1600
  check_model "sd3_medium_incl_clips_t5xxlfp16.safetensors" "SD3 Medium" 5400
  check_model "clip_l.safetensors" "CLIP-L" 230
  check_model "t5xxl_fp16.safetensors" "T5XXL" 9000
  
  if [ -n "$ISSUES" ]; then
    echo ""
    echo "⚠ Some models have issues:"
    echo -e "$ISSUES"
  fi
}

verify_setup_completion() {
  local p="[setup/image/validate]"
  
  if [ -x "$BIN_DIR/sd" ] && [ -f "$MODELS_DIR/v1-5-pruned-emaonly.safetensors" ]; then
    echo ""
    echo "stable-diffusion.cpp setup completed!"
    echo "✓ SD 1.5 model ready"
    
    if [ -f "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" ] || [ -f "$MODELS_DIR/sd3.5_large.safetensors" ]; then
      echo "✓ SD3.5 model ready"
    fi
    
    echo ""
    echo "Next steps if models are missing:"
    echo "1. Visit the model pages and click 'Agree and access repository'"
    echo "2. Wait for approval (instant for SD3)"
    echo "3. Run setup again: npm run setup"
  else
    echo "ERROR: Setup verification failed"
    exit 1
  fi
}