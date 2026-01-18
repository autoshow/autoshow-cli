#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../transcription/python-version.sh"

VENV="build/pyenv/tts"
CONFIG_DIR="build/config"
MARKER_FILE="$CONFIG_DIR/.tts-env-installed"

mkdir -p "$CONFIG_DIR"

# Check if already installed via marker file
if [ -f "$MARKER_FILE" ] && [ -x "$VENV/bin/python" ]; then
  log "TTS environment: already configured, skipping"
  exit 0
fi

if ! ensure_python311; then
  log "ERROR: Cannot install Python 3.11, TTS features unavailable"
  exit 1
fi

PY311=$(get_python311_path) || {
  log "ERROR: Python 3.11 not found after installation"
  exit 1
}

if [ -d "$VENV" ]; then
  chmod -R u+w "$VENV" 2>/dev/null || true
  rm -rf "$VENV" 2>/dev/null || {
    mv "$VENV" "${VENV}.backup.$(date +%s)" 2>/dev/null || true
  }
fi

"$PY311" -m venv "$VENV" || { log "ERROR: Failed to create virtual environment with Python 3.11"; exit 1; }
pip() { "$VENV/bin/pip" "$@"; }

pip install --upgrade pip >/dev/null 2>&1

pip install "numpy<2" soundfile librosa scipy >/dev/null 2>&1 || { log "ERROR: Failed to install audio libraries"; exit 1; }

pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || pip install torch torchaudio >/dev/null 2>&1 || { log "ERROR: Failed to install PyTorch"; exit 1; }

if [ ! -f "build/config/.tts-config.json" ]; then
  cat >build/config/.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF
fi

touch "$MARKER_FILE"