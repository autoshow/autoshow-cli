#!/bin/bash

set -euo pipefail

validate_file() {
  local file="$1"
  local min_size="$2"
  local expected_size="$3"
  local p="[setup/image/download]"
  
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
  local p="[setup/image/download]"
  
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
  local p="[setup/image/download]"
  
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

try_alternative_download() {
  local primary_url="$1"
  local alt_url="$2"
  local output="$3"
  local name="$4"
  local min_size="$5"
  local p="[setup/image/download]"
  
  download_with_auth "$primary_url" "$output" "$name" false "$min_size" || {
    echo "Trying alternative source..."
    download_with_auth "$alt_url" "$output" "$name" false "$min_size" || echo "Warning: $name download failed"
  }
}