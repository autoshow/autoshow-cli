#!/bin/bash
set -euo pipefail
p='[setup/music/stable-audio]'

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  echo "$p Skipping Stable Audio setup, shared env missing"
  exit 0
fi

pip() { "build/pyenv/tts/bin/pip" "$@"; }

echo "$p Installing Stable Audio Tools and dependencies"
pip install --upgrade torch==2.5.0 --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || pip install torch==2.5.0 >/dev/null 2>&1 || true
pip install setuptools wheel >/dev/null 2>&1
pip install stable-audio-tools >/dev/null 2>&1 || pip install git+https://github.com/Stability-AI/stable-audio-tools.git >/dev/null 2>&1 || true
pip install einops >/dev/null 2>&1
pip install wandb >/dev/null 2>&1
pip install safetensors >/dev/null 2>&1
pip install gradio >/dev/null 2>&1 || true

echo "$p Downloading default Stable Audio Open 1.0 model"
build/pyenv/tts/bin/python - <<'PY' || true
try:
    import os
    import torch
    from huggingface_hub import hf_hub_download
    
    os.makedirs('build/models/stable-audio', exist_ok=True)
    
    print("Downloading model config...")
    config_path = hf_hub_download(
        repo_id="stabilityai/stable-audio-open-1.0",
        filename="model_config.json",
        cache_dir="build/models/stable-audio",
        local_dir="build/models/stable-audio"
    )
    
    print("Note: Model weights will be downloaded on first use")
    print("OK: Stable Audio Open 1.0 config downloaded")
except Exception as e:
    print(f"ERR: {e}")
PY

mkdir -p build/config
if [ ! -f "build/config/.music-config.json" ]; then
  cat >build/config/.music-config.json <<EOF
{"python":"build/pyenv/tts/bin/python","venv":"build/pyenv/tts","audiocraft":{"default_model":"facebook/musicgen-small","cache_dir":"build/models/audiocraft"},"stable_audio":{"default_model":"stabilityai/stable-audio-open-1.0","cache_dir":"build/models/stable-audio"}}
EOF
else
  build/pyenv/tts/bin/python - <<'PY' || true
import json
import os

config_path = 'build/config/.music-config.json'
with open(config_path, 'r') as f:
    config = json.load(f)

if 'stable_audio' not in config:
    config['stable_audio'] = {
        'default_model': 'stabilityai/stable-audio-open-1.0',
        'cache_dir': 'build/models/stable-audio'
    }
    
    with open(config_path, 'w') as f:
        json.dump(config, f)
PY
fi

echo "$p Done"