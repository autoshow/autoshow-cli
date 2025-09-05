#!/bin/bash
set -euo pipefail
p='[setup/tts/models]'

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  echo "$p ERROR: TTS environment not found. Run base setup first."
  exit 1
fi

echo "$p Pre-downloading TTS models"

echo "$p Pre-downloading Coqui TTS default model"
build/pyenv/tts/bin/python - <<'PY' || true
try:
    from TTS.api import TTS
    import os
    os.environ['TTS_CACHE_PATH'] = 'build/models/tts'
    os.makedirs('build/models/tts', exist_ok=True)
    print("Downloading tts_models/en/ljspeech/tacotron2-DDC...")
    tts = TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=False)
    print("Successfully downloaded Coqui TTS default model")
except Exception as e:
    print(f"WARNING: Failed to pre-download Coqui model: {e}")
PY

echo "$p Pre-downloading KittenTTS model"
build/pyenv/tts/bin/python - <<'PY' || true
try:
    from kittentts import KittenTTS
    import os
    os.environ['HF_HOME'] = 'build/models/kitten'
    os.makedirs('build/models/kitten', exist_ok=True)
    print("Downloading KittenML/kitten-tts-nano-0.1...")
    m = KittenTTS("KittenML/kitten-tts-nano-0.1")
    print("Successfully downloaded KittenTTS model")
except Exception as e:
    print(f"WARNING: Failed to pre-download Kitten model: {e}")
PY

echo "$p TTS models setup complete"