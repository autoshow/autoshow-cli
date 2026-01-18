#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"
source "$(dirname "${BASH_SOURCE[0]}")/whisper-build-common.sh"

setup_error_trap
detect_platform
ensure_build_dirs

MARKER_FILE="$CONFIG_DIR/.whisper-installed"

skip_if_installed "$MARKER_FILE" "$BIN_DIR/whisper-cli" "whisper-cli"

CMAKE_FLAGS=()
if [ "$IS_MAC" = true ]; then
  CMAKE_FLAGS+=("-DGGML_METAL=ON")
fi

build_whisper_full "whisper-cpp-temp" "$BIN_DIR" "whisper-cli" "${CMAKE_FLAGS[@]}"

touch "$MARKER_FILE"
log "Whisper.cpp setup completed"
