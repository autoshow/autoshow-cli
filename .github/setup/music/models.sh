#!/bin/bash
set -euo pipefail
p='[setup/music/models]'

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  echo "$p ERROR: Music generation environment not found. Run base setup first."
  exit 1
fi

if [ -z "${HF_TOKEN:-}" ] && [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

hf_auth() {
  if [ -n "${HF_TOKEN:-}" ]; then
    echo "$p Using HF_TOKEN for authentication"
    return 0
  fi
  if [ -n "${HUGGING_FACE_HUB_TOKEN:-}" ]; then
    export HF_TOKEN="$HUGGING_FACE_HUB_TOKEN"
    echo "$p Using HUGGING_FACE_HUB_TOKEN for authentication"
    return 0
  fi
  if [ -f "$HOME/.cache/huggingface/token" ]; then
    export HF_TOKEN="$(cat "$HOME/.cache/huggingface/token")"
    echo "$p Using cached HuggingFace token"
    return 0
  fi
  if command -v huggingface-cli &>/dev/null && huggingface-cli whoami &>/dev/null 2>&1; then
    echo "$p Authenticated via huggingface-cli"
    return 0
  fi
  return 1
}

check_access() {
  local repo="$1"
  if [ -z "${HF_TOKEN:-}" ]; then return 1; fi
  local res
  res=$(curl -s -H "Authorization: Bearer $HF_TOKEN" "https://huggingface.co/api/models/$repo" 2>/dev/null || echo "{}")
  if echo "$res" | grep -q '"gated":true'; then
    if echo "$res" | grep -q '"gate_status":"granted"'; then
      return 0
    else
      return 1
    fi
  fi
  return 0
}

echo "$p Downloading music generation models"

echo "$p Downloading AudioCraft MusicGen model"
build/pyenv/tts/bin/python - <<'PY' || true
try:
    from audiocraft.models import MusicGen
    import os
    os.environ['AUDIOCRAFT_CACHE_DIR'] = 'build/models/audiocraft'
    os.makedirs('build/models/audiocraft', exist_ok=True)
    print("Downloading facebook/musicgen-small...")
    model = MusicGen.get_pretrained('facebook/musicgen-small')
    print("Successfully downloaded MusicGen small model")
except Exception as e:
    print(f"WARNING: Failed to download MusicGen model: {e}")
PY

AUTH=false
STABLE_AUDIO_ACCESS=false

if hf_auth; then 
  AUTH=true
  if check_access "stabilityai/stable-audio-open-1.0"; then 
    STABLE_AUDIO_ACCESS=true
    echo "$p Access granted for Stable Audio Open 1.0"
  else
    echo "$p No access to Stable Audio Open 1.0 (requires approval)"
  fi
else 
  echo "$p No HuggingFace authentication found"
fi

if [ "$STABLE_AUDIO_ACCESS" = true ]; then
  echo "$p Downloading Stable Audio model config"
  build/pyenv/tts/bin/python - <<PY || true
try:
    import os
    import torch
    from huggingface_hub import hf_hub_download
    
    os.makedirs('build/models/stable-audio', exist_ok=True)
    
    token = os.environ.get('HF_TOKEN')
    if not token:
        print("No HF_TOKEN available")
        raise Exception("Authentication required")
    
    print("Downloading stabilityai/stable-audio-open-1.0 config...")
    config_path = hf_hub_download(
        repo_id="stabilityai/stable-audio-open-1.0",
        filename="model_config.json",
        cache_dir="build/models/stable-audio",
        local_dir="build/models/stable-audio",
        token=token
    )
    
    print("Note: Model weights will be downloaded on first use")
    print("Successfully downloaded Stable Audio Open 1.0 config")
except Exception as e:
    print(f"WARNING: Failed to download Stable Audio config: {e}")
PY
else
  echo "$p Skipping Stable Audio model download"
  if [ "$AUTH" = false ]; then
    echo "$p To enable Stable Audio models:"
    echo "$p 1. Set HF_TOKEN in your .env file"
    echo "$p 2. Request access at: https://huggingface.co/stabilityai/stable-audio-open-1.0"
  else
    echo "$p Stable Audio model requires approval. Request access at:"
    echo "$p https://huggingface.co/stabilityai/stable-audio-open-1.0"
  fi
fi

echo "$p Music generation models setup complete"