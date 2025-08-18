#!/bin/bash

set -euo pipefail

check_hf_auth() {
  local p="[setup/image/auth]"
  
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
  local p="[setup/image/auth]"
  
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

display_auth_instructions() {
  local p="[setup/image/auth]"
  echo "ℹ No Hugging Face authentication found"
  echo ""
  echo "To enable automatic download of SD3.5 and FLUX models:"
  echo "1. Get a token from: https://huggingface.co/settings/tokens"
  echo "2. Add to .env: HF_TOKEN=your_token_here"
  echo "   OR"
  echo "3. Install and login: pip install huggingface_hub && huggingface-cli login"
  echo ""
}

display_access_instructions() {
  local model_type="$1"
  local repo_url="$2"
  local p="[setup/image/auth]"
  
  echo ""
  echo "ℹ Skipping $model_type models (access not granted yet)"
  echo "  To use $model_type models:"
  echo "  1. Visit $repo_url"
  echo "  2. Click 'Agree and access repository'"
  if [ "$model_type" = "FLUX" ]; then
    echo "  3. Wait for approval (may take 1-2 days)"
  else
    echo "  3. Wait for approval"
  fi
  echo "  4. Run setup again"
}