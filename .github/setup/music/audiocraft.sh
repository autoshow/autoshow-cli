#!/bin/bash
set -euo pipefail
p='[setup/music/audiocraft]'

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  echo "$p Skipping AudioCraft setup, shared env missing"
  exit 0
fi

pip() { "build/pyenv/tts/bin/pip" "$@"; }

echo "$p Installing AudioCraft and MusicGen dependencies"
pip install --upgrade torch==2.1.0 --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || pip install torch==2.1.0 >/dev/null 2>&1 || true
pip install setuptools wheel >/dev/null 2>&1
pip install audiocraft >/dev/null 2>&1 || pip install git+https://github.com/facebookresearch/audiocraft >/dev/null 2>&1 || true
pip install xformers >/dev/null 2>&1 || true

if [ "${NO_MODELS:-false}" != "true" ]; then
  echo "$p Downloading default MusicGen model (facebook/musicgen-small)"
  build/pyenv/tts/bin/python - <<'PY' || true
try:
    from audiocraft.models import MusicGen
    import os
    os.environ['AUDIOCRAFT_CACHE_DIR'] = 'build/models/audiocraft'
    os.makedirs('build/models/audiocraft', exist_ok=True)
    model = MusicGen.get_pretrained('facebook/musicgen-small')
    print("OK: MusicGen small model downloaded")
except Exception as e:
    print(f"ERR: {e}")
PY
fi

mkdir -p build/config
if [ ! -f "build/config/.music-config.json" ]; then
  cat >build/config/.music-config.json <<EOF
{"python":"build/pyenv/tts/bin/python","venv":"build/pyenv/tts","audiocraft":{"default_model":"facebook/musicgen-small","cache_dir":"build/models/audiocraft"}}
EOF
fi

echo "$p Done"