#!/bin/bash
set -euo pipefail
p='[setup/image/sd3_5]'
MODELS_DIR="build/models/sd"
mkdir -p "$MODELS_DIR"
if [ -z "${HF_TOKEN:-}" ] && [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi
hf_auth() {
  if [ -n "${HF_TOKEN:-}" ]; then
    echo "$p Using HF_TOKEN"
    return 0
  fi
  if [ -n "${HUGGING_FACE_HUB_TOKEN:-}" ]; then
    export HF_TOKEN="$HUGGING_FACE_HUB_TOKEN"
    echo "$p Using HUGGING_FACE_HUB_TOKEN"
    return 0
  fi
  if [ -f "$HOME/.cache/huggingface/token" ]; then
    export HF_TOKEN="$(cat "$HOME/.cache/huggingface/token")"
    echo "$p Using cached token"
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
validate_file() {
  local f="$1"
  local min_bytes="$2"
  if [ ! -f "$f" ]; then return 1; fi
  local size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo "0")
  [ "$size" -ge "$min_bytes" ]
}
dl_auth() {
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
    if [ -n "${HF_TOKEN:-}" ]; then
      curl -L --progress-bar -H "Authorization: Bearer $HF_TOKEN" -o "$tmp" "$url" >/dev/null 2>&1 || true
    else
      curl -L --progress-bar -o "$tmp" "$url" >/dev/null 2>&1 || true
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
  echo "$p Skipped $name (not accessible yet)"
  return 1
}
AUTH=false
if hf_auth; then AUTH=true; else echo "$p No Hugging Face auth found, SD3.5 models may be skipped"; fi
SD3_ACCESS=false
SD35_ACCESS=false
if [ "$AUTH" = true ]; then
  if check_access "stabilityai/stable-diffusion-3-medium"; then SD3_ACCESS=true; fi
  if check_access "stabilityai/stable-diffusion-3.5-large"; then SD35_ACCESS=true; fi
fi
ANY_MODEL=false
if [ -f "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" ] || [ -f "$MODELS_DIR/sd3.5_large.safetensors" ]; then
  ANY_MODEL=true
fi
if [ "$SD3_ACCESS" = true ] && [ ! -f "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" ]; then
  if command -v huggingface-cli &>/dev/null; then
    echo "$p Downloading SD3 Medium via huggingface-cli"
    tmp="$MODELS_DIR/.tmp_sd3"
    mkdir -p "$tmp"
    huggingface-cli download stabilityai/stable-diffusion-3-medium sd3_medium_incl_clips_t5xxlfp16.safetensors --local-dir "$tmp" --local-dir-use-symlinks False >/dev/null 2>&1 || true
    if [ -f "$tmp/sd3_medium_incl_clips_t5xxlfp16.safetensors" ]; then mv "$tmp/sd3_medium_incl_clips_t5xxlfp16.safetensors" "$MODELS_DIR/"; ANY_MODEL=true; fi
    rm -rf "$tmp"
  else
    if dl_auth "https://huggingface.co/stabilityai/stable-diffusion-3-medium/resolve/main/sd3_medium_incl_clips_t5xxlfp16.safetensors" "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" "SD3 Medium" $((5400*1048576)); then ANY_MODEL=true; fi
  fi
fi
if [ "$SD35_ACCESS" = true ] && [ "$ANY_MODEL" = false ] && [ ! -f "$MODELS_DIR/sd3.5_large.safetensors" ]; then
  if command -v huggingface-cli &>/dev/null; then
    echo "$p Downloading SD3.5 Large via huggingface-cli"
    tmp="$MODELS_DIR/.tmp_sd35"
    mkdir -p "$tmp"
    huggingface-cli download stabilityai/stable-diffusion-3.5-large sd3.5_large.safetensors --local-dir "$tmp" --local-dir-use-symlinks False >/dev/null 2>&1 || true
    if [ -f "$tmp/sd3.5_large.safetensors" ]; then mv "$tmp/sd3.5_large.safetensors" "$MODELS_DIR/"; ANY_MODEL=true; fi
    rm -rf "$tmp"
  else
    if dl_auth "https://huggingface.co/stabilityai/stable-diffusion-3.5-large/resolve/main/sd3.5_large.safetensors" "$MODELS_DIR/sd3.5_large.safetensors" "SD3.5 Large" $((6500*1048576)); then ANY_MODEL=true; fi
  fi
fi
NEED_ENCODERS=false
if [ -f "$MODELS_DIR/sd3.5_large.safetensors" ]; then
  NEED_ENCODERS=true
fi
if [ "$NEED_ENCODERS" = true ]; then
  dl_auth "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" "$MODELS_DIR/clip_l.safetensors" "CLIP-L" $((230*1048576)) || dl_auth "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/clip_l.safetensors" "$MODELS_DIR/clip_l.safetensors" "CLIP-L" $((230*1048576)) || true
  dl_auth "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/clip_g.safetensors" "$MODELS_DIR/clip_g.safetensors" "CLIP-G" $((690*1048576)) || true
  dl_auth "https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/text_encoders/t5xxl_fp16.safetensors" "$MODELS_DIR/t5xxl_fp16.safetensors" "T5XXL" $((9000*1048576)) || dl_auth "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors" "$MODELS_DIR/t5xxl_fp16.safetensors" "T5XXL" $((9000*1048576)) || true
fi
REQUIRED_FOR_SD3=false
if [ -f "$MODELS_DIR/sd3_medium_incl_clips_t5xxlfp16.safetensors" ] || [ -f "$MODELS_DIR/sd3.5_large.safetensors" ]; then
  REQUIRED_FOR_SD3=true
fi
if [ "$REQUIRED_FOR_SD3" = false ]; then
  if [ "$AUTH" = false ]; then
    echo "$p ERROR: No HuggingFace authentication found. SD3 models require authentication."
    echo "$p To enable SD3 models:"
    echo "$p 1. Set HF_TOKEN in your .env file"
    echo "$p 2. Request access at:"
    echo "$p    https://huggingface.co/stabilityai/stable-diffusion-3-medium"
    echo "$p    https://huggingface.co/stabilityai/stable-diffusion-3.5-large"
    echo "$p 3. Wait for approval then run setup again"
  elif [ "$SD3_ACCESS" = false ] && [ "$SD35_ACCESS" = false ]; then
    echo "$p ERROR: Access not granted to SD3 models. You need to:"
    echo "$p 1. Request access at:"
    echo "$p    https://huggingface.co/stabilityai/stable-diffusion-3-medium"
    echo "$p    https://huggingface.co/stabilityai/stable-diffusion-3.5-large"
    echo "$p 2. Wait for approval (usually instant after accepting license)"
    echo "$p 3. Run setup again"
  else
    echo "$p ERROR: Failed to download SD3 models despite having access."
    echo "$p Please check your internet connection and try again."
  fi
  echo "$p Failed"
  exit 1
fi
echo "$p Done"
exit 0