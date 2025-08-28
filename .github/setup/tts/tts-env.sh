#!/bin/bash
set -euo pipefail
p='[setup/tts/tts-env]'
find_py() {
  for pth in python3.{11..9} python3 /usr/local/bin/python3.{11..9} /opt/homebrew/bin/python3.{11..9} python; do
    if command -v "$pth" &>/dev/null; then
      v=$("$pth" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      case "$v" in
        3.9|3.10|3.11) echo "$pth"; return 0 ;;
      esac
    fi
  done
  return 1
}
PY=$(find_py) || { echo "$p WARNING: Python 3.9-3.11 not found. TTS features unavailable"; exit 0; }
VENV="build/pyenv/tts"
if [[ -d $VENV ]]; then
  rm -rf "$VENV"
fi
"$PY" -m venv "$VENV" || { echo "$p WARNING: Failed to create virtual environment. TTS features unavailable"; exit 0; }
pip() { "$VENV/bin/pip" "$@"; }
echo "$p Installing shared TTS packages"
pip install --upgrade pip >/dev/null 2>&1
pip install "numpy<2" soundfile librosa scipy >/dev/null 2>&1 || true
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || pip install torch torchaudio >/dev/null 2>&1 || true
mkdir -p build/config
if [ ! -f "build/config/.tts-config.json" ]; then
  cat >build/config/.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF
fi
echo "$p Done"