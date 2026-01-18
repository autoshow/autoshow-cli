#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../common.sh"

MARKER_FILE="$CONFIG_DIR/.tts-models-installed"

check_marker "$MARKER_FILE" && exit 0

require_tts_env

tts_python - <<'PY' >/dev/null 2>&1 || true
try:
    from TTS.api import TTS
    import os
    os.environ['TTS_CACHE_PATH'] = 'build/models/tts'
    os.makedirs('build/models/tts', exist_ok=True)
    tts = TTS('tts_models/en/ljspeech/tacotron2-DDC', progress_bar=False)
except Exception:
    pass
PY

tts_python - <<'PY' >/dev/null 2>&1 || true
try:
    from kittentts import KittenTTS
    import os
    os.environ['HF_HOME'] = 'build/models/kitten'
    os.makedirs('build/models/kitten', exist_ok=True)
    m = KittenTTS("KittenML/kitten-tts-nano-0.1")
except Exception:
    pass
PY

touch "$MARKER_FILE"
