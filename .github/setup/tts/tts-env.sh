#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

ensure_build_dirs

MARKER_FILE="$CONFIG_DIR/.tts-env-installed"

if check_marker "$MARKER_FILE" && [ -x "$TTS_PYTHON" ]; then
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

if [ -d "$TTS_VENV" ]; then
  chmod -R u+w "$TTS_VENV" 2>/dev/null || true
  rm -rf "$TTS_VENV" 2>/dev/null || {
    mv "$TTS_VENV" "${TTS_VENV}.backup.$(date +%s)" 2>/dev/null || true
  }
fi

"$PY311" -m venv "$TTS_VENV" || {
  log "ERROR: Failed to create virtual environment with Python 3.11"
  exit 1
}

tts_pip install --upgrade pip >/dev/null 2>&1

tts_pip install "numpy<2" soundfile librosa scipy >/dev/null 2>&1 || {
  log "ERROR: Failed to install audio libraries"
  exit 1
}

tts_pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || \
  tts_pip install torch torchaudio >/dev/null 2>&1 || {
    log "ERROR: Failed to install PyTorch"
    exit 1
  }

if [ ! -f "$CONFIG_DIR/.tts-config.json" ]; then
  cat >"$CONFIG_DIR/.tts-config.json" <<EOF
{"python":"$TTS_PYTHON","venv":"$TTS_VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"},"qwen3":{"default_model":"Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice","default_speaker":"Vivian","default_language":"Auto","default_mode":"custom"},"chatterbox":{"default_model":"turbo","default_language":"en","default_exaggeration":0.5,"default_cfg_weight":0.5},"cosyvoice":{"api_url":"http://localhost:50000","default_mode":"instruct","default_language":"auto","model_dir":"build/cosyvoice/pretrained_models/Fun-CosyVoice3-0.5B"},"fishaudio":{"api_url":"http://localhost:8080","default_language":"en","checkpoint_path":"build/checkpoints/openaudio-s1-mini","use_api":true,"compile":false}}
EOF
fi

touch "$MARKER_FILE"
