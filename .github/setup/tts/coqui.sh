#!/bin/bash
set -euo pipefail
p='[setup/tts/coqui]'
if [ ! -x "python_env/bin/pip" ]; then
  echo "$p Skipping Coqui setup, shared env missing"
  exit 0
fi
pip() { "python_env/bin/pip" "$@"; }
echo "$p Installing Coqui TTS"
pip install TTS >/dev/null 2>&1 || pip install "TTS==0.22.0" >/dev/null 2>&1 || pip install git+https://github.com/coqui-ai/TTS.git >/dev/null 2>&1 || true
pip install sentencepiece >/dev/null 2>&1 || pip install --only-binary :all: sentencepiece >/dev/null 2>&1 || true
python_env/bin/python - <<'PY' || true
try:
    from TTS.api import TTS
    TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=False)
    print("OK")
except Exception as e:
    print(f"ERR:{e}")
PY
echo "$p Done"