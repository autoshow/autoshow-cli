#!/bin/bash

clone_whisper_repo() {
  local dir="$1"
  local tmp_log="/tmp/whisper-clone-$$.log"
  
  rm -rf "$dir"
  log "Cloning whisper.cpp repository..."
  if ! git clone https://github.com/ggerganov/whisper.cpp.git "$dir" > "$tmp_log" 2>&1; then
    log "ERROR: Failed to clone whisper.cpp repository"
    cat "$tmp_log"
    rm -f "$tmp_log"
    return 1
  fi
  rm -f "$tmp_log"
}

configure_whisper_build() {
  local dir="$1"
  shift
  local extra_flags=("$@")
  local tmp_log="/tmp/whisper-cmake-$$.log"
  
  log "Configuring build with CMake..."
  if ! cmake -B "$dir/build" -S "$dir" -DBUILD_SHARED_LIBS=OFF "${extra_flags[@]}" > "$tmp_log" 2>&1; then
    log "ERROR: CMake configuration failed"
    cat "$tmp_log"
    rm -f "$tmp_log"
    return 1
  fi
  rm -f "$tmp_log"
}

build_whisper() {
  local dir="$1"
  local tmp_log="/tmp/whisper-build-$$.log"
  
  log "Building whisper.cpp (this may take a few minutes)..."
  if ! cmake --build "$dir/build" --config Release > "$tmp_log" 2>&1; then
    log "ERROR: Build failed"
    cat "$tmp_log"
    rm -f "$tmp_log"
    return 1
  fi
  rm -f "$tmp_log"
}

install_whisper_binary() {
  local src_dir="$1"
  local dest_dir="$2"
  local binary_name="${3:-whisper-cli}"
  
  log "Installing $binary_name binary..."
  
  local src_binary=""
  if [ -f "$src_dir/build/bin/whisper-cli" ]; then
    src_binary="$src_dir/build/bin/whisper-cli"
  elif [ -f "$src_dir/build/whisper-cli" ]; then
    src_binary="$src_dir/build/whisper-cli"
  else
    log "ERROR: whisper-cli binary not found in expected locations:"
    log "  - $src_dir/build/bin/whisper-cli"
    log "  - $src_dir/build/whisper-cli"
    ls -la "$src_dir/build/" 2>/dev/null || log "Build directory does not exist"
    return 1
  fi
  
  mkdir -p "$dest_dir"
  cp "$src_binary" "$dest_dir/$binary_name"
  chmod +x "$dest_dir/$binary_name"
}

copy_whisper_dylibs() {
  local src_dir="$1"
  local dest_dir="$2"
  
  for lib_dir in "$src_dir/build/src" "$src_dir/build/ggml/src" "$src_dir/build/ggml/src/ggml-metal"; do
    if [ -d "$lib_dir" ]; then
      cp "$lib_dir"/*.dylib "$dest_dir/" 2>/dev/null || true
    fi
  done
}

fix_macos_dylib_paths() {
  local bin_dir="$1"
  local binary_name="$2"
  local binary_path="$bin_dir/$binary_name"
  
  is_macos || return 0
  
  local libs
  libs=$(otool -L "$binary_path" 2>/dev/null | grep -E "(libwhisper|libggml)" | awk '{print $1}' || true)
  if [ -n "$libs" ]; then
    for lib in $libs; do
      local libname
      libname=$(basename "$lib")
      if [ -f "$bin_dir/$libname" ]; then
        install_name_tool -change "$lib" "@executable_path/$libname" "$binary_path" || true
      fi
    done
  fi
  
  for dylib in "$bin_dir"/*.dylib; do
    if [ -f "$dylib" ]; then
      local deps
      deps=$(otool -L "$dylib" 2>/dev/null | grep -E "(libwhisper|libggml)" | awk '{print $1}' || true)
      for dep in $deps; do
        local depname
        depname=$(basename "$dep")
        if [ -f "$bin_dir/$depname" ] && [ "$depname" != "$(basename "$dylib")" ]; then
          install_name_tool -change "$dep" "@loader_path/$depname" "$dylib" || true
        fi
      done
    fi
  done
}

build_whisper_full() {
  local work_dir="$1"
  local bin_dir="$2"
  local binary_name="$3"
  shift 3
  local cmake_flags=("$@")
  
  clone_whisper_repo "$work_dir" || return 1
  configure_whisper_build "$work_dir" "${cmake_flags[@]}" || return 1
  build_whisper "$work_dir" || return 1
  install_whisper_binary "$work_dir" "$bin_dir" "$binary_name" || return 1
  copy_whisper_dylibs "$work_dir" "$bin_dir"
  fix_macos_dylib_paths "$bin_dir" "$binary_name"
  
  rm -rf "$work_dir"
}
