#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="build/config/.tts-models-installed"

# Skip if already installed via marker file
if [ -f "$MARKER_FILE" ]; then
  exit 0
fi

if [ ! -x "build/pyenv/tts/bin/pip" ]; then
  log "ERROR: TTS environment not found. Run base setup first."
  exit 1
fi

build/pyenv/tts/bin/python - <<'PY' >/dev/null 2>&1 || true
try:
    from TTS.api import TTS
    import os
    os.environ['TTS_CACHE_PATH'] = 'build/models/tts'
    os.makedirs('build/models/tts', exist_ok=True)
    tts = TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=False)
except Exception as e:
    pass
PY

build/pyenv/tts/bin/python - <<'PY' >/dev/null 2>&1 || true
try:
    from kittentts import KittenTTS
    import os
    os.environ['HF_HOME'] = 'build/models/kitten'
    os.makedirs('build/models/kitten', exist_ok=True)
    m = KittenTTS("KittenML/kitten-tts-nano-0.1")
except Exception as e:
    pass
PY

touch "$MARKER_FILE"