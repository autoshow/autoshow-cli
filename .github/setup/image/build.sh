#!/bin/bash

set -euo pipefail

build_stable_diffusion_cpp() {
  local p="[setup/image/build]"
  echo "Setting up stable-diffusion.cpp for image generation..."
  
  SD_CPP_DIR="stable-diffusion-cpp"
  
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
}

cleanup_build_artifacts() {
  local p="[setup/image/build]"
  rm -rf "$SD_CPP_DIR"
}