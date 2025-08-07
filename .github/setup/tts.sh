#!/bin/bash

set -euo pipefail

echo "Setting up Python environment for TTS..."

find_py() {
  for p in python3.{11..9} python3 /usr/local/bin/python3.{11..9} /opt/homebrew/bin/python3.{11..9} python; do
    if command -v "$p" &>/dev/null; then
      v=$("$p" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      if [[ $v =~ 3\.(9|10|11) ]]; then
        echo "$p"
        return 0
      fi
    fi
  done
  return 1
}

PY=$(find_py) || {
  echo "Need Python 3.9-3.11. Install with: brew install python@3.11"
  echo "Warning: TTS features will not be available without Python setup"
  echo "You can still use whisper.cpp functionality"
  exit 0
}
echo "Using Python: $PY"

VENV="python_env"
if [[ -d $VENV ]]; then
  echo "Removing existing virtual environment"
  rm -rf "$VENV"
fi

echo "Creating virtual environment for TTS..."
"$PY" -m venv "$VENV" || {
  echo "Warning: Failed to create virtual environment"
  echo "TTS features will not be available"
  exit 0
}

pip() {
  "$VENV/bin/pip" "$@"
}

echo "Installing Python packages for TTS..."
pip install --upgrade pip
pip install "numpy<2" soundfile librosa scipy
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu || pip install torch torchaudio
pip install TTS || pip install "TTS==0.22.0" || pip install git+https://github.com/coqui-ai/TTS.git
pip install sentencepiece || pip install --only-binary :all: sentencepiece

echo "Verifying TTS installations..."
"$VENV/bin/python" - <<'PY'
import importlib,sys
for name,mod in {'Coqui':'TTS.api'}.items():
    try: importlib.import_module(mod.split('.')[0]); print(f"✓ {name}")
    except Exception as e: print(f"⚠ {name}: {e}", file=sys.stderr)
PY

echo "Downloading default Coqui model..."
"$VENV/bin/python" - <<'PY' || true
from TTS.api import TTS; TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=True)
PY

echo "Creating TTS configuration file..."
cat >.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"}}
EOF

echo "TTS setup completed successfully!"