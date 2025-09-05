#!/bin/bash
set -euo pipefail
p='[setup/image/sdcpp]'
BIN_DIR="build/bin"
REPO_URL="https://github.com/leejet/stable-diffusion.cpp.git"
SD_CPP_DIR=".tmp-sd-cpp"
mkdir -p "$BIN_DIR"
if [ -d "$SD_CPP_DIR" ]; then
  cd "$SD_CPP_DIR"
  git pull origin master >/dev/null 2>&1 || true
  git submodule update --init --recursive >/dev/null 2>&1 || true
  cd ..
else
  git clone --recursive "$REPO_URL" "$SD_CPP_DIR" >/dev/null 2>&1
fi
mkdir -p "$SD_CPP_DIR/build"
cd "$SD_CPP_DIR/build"
IS_MAC=false
HAS_CUDA=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
  *) if command -v nvcc &>/dev/null; then HAS_CUDA=true; fi ;;
esac
if [ "$IS_MAC" = true ]; then
  echo "$p Building with Metal"
  cmake .. -DSD_METAL=ON -DCMAKE_BUILD_TYPE=Release >/dev/null 2>&1
elif [ "$HAS_CUDA" = true ]; then
  echo "$p Building with CUDA"
  cmake .. -DSD_CUDA=ON -DCMAKE_BUILD_TYPE=Release >/dev/null 2>&1
else
  echo "$p Building with CPU"
  cmake .. -DCMAKE_BUILD_TYPE=Release >/dev/null 2>&1
fi
cmake --build . --config Release >/dev/null 2>&1
if [ -f "./bin/sd" ]; then
  cp "./bin/sd" "../../$BIN_DIR/sd"
  chmod +x "../../$BIN_DIR/sd"
elif [ -f "./sd" ]; then
  cp "./sd" "../../$BIN_DIR/sd"
  chmod +x "../../$BIN_DIR/sd"
else
  echo "$p ERROR: sd binary not found"
  exit 1
fi
cd ../..
rm -rf "$SD_CPP_DIR"
echo "$p Done"