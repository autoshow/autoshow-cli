#!/bin/bash

set -euo pipefail

echo "Setting up TTS environment..."

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
  echo "WARNING: Python 3.9-3.11 not found. TTS features unavailable"
  exit 0
}

VENV="python_env"
if [[ -d $VENV ]]; then
  rm -rf "$VENV"
fi

"$PY" -m venv "$VENV" || {
  echo "WARNING: Failed to create virtual environment. TTS features unavailable"
  exit 0
}

pip() {
  "$VENV/bin/pip" "$@"
}

echo "Installing TTS packages..."
pip install --upgrade pip
pip install "numpy<2" soundfile librosa scipy
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu || pip install torch torchaudio
pip install TTS || pip install "TTS==0.22.0" || pip install git+https://github.com/coqui-ai/TTS.git
pip install sentencepiece || pip install --only-binary :all: sentencepiece

pip install --quiet https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl || true

"$VENV/bin/python" - <<'PY'
import importlib,sys
for name,mod in {'Coqui':'TTS.api', 'Kitten':'kittentts'}.items():
    try: importlib.import_module(mod.split('.')[0]); print(f"✓ {name}")
    except Exception as e: print(f"⚠ {name}: {e}", file=sys.stderr)
PY

"$VENV/bin/python" - <<'PY' || true
from TTS.api import TTS; TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=True)
PY

"$VENV/bin/python" - <<'PY' || true
try:
    from kittentts import KittenTTS
    model = KittenTTS("KittenML/kitten-tts-nano-0.1")
    print("✓ Kitten TTS model loaded")
except Exception as e:
    print(f"⚠ Kitten TTS: {e}")
PY

cat >.tts-config.json <<EOF
{"python":"$VENV/bin/python","venv":"$VENV","coqui":{"default_model":"tts_models/en/ljspeech/tacotron2-DDC","xtts_model":"tts_models/multilingual/multi-dataset/xtts_v2"},"kitten":{"default_model":"KittenML/kitten-tts-nano-0.1","default_voice":"expr-voice-2-f"}}
EOF

echo "TTS setup completed successfully!"