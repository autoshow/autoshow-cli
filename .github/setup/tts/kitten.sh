#!/bin/bash
set -euo pipefail
p='[setup/tts/kitten]'
if [ ! -x "python_env/bin/pip" ]; then
  echo "$p Skipping Kitten setup, shared env missing"
  exit 0
fi
pip() { "python_env/bin/pip" "$@"; }
echo "$p Installing KittenTTS"
pip install --quiet https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl >/dev/null 2>&1 || true
python_env/bin/python - <<'PY' || true
try:
    from kittentts import KittenTTS
    m = KittenTTS("KittenML/kitten-tts-nano-0.1")
    print("OK")
except Exception as e:
    print(f"ERR:{e}")
PY
echo "$p Done"