#!/bin/bash

set -euo pipefail

echo "Setting up Kitten TTS..."

find_py() {
  for p in python3.{11..8} python3 /usr/local/bin/python3.{11..8} /opt/homebrew/bin/python3.{11..8} python; do
    if command -v "$p" &>/dev/null; then
      v=$("$p" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      if [[ $v =~ 3\.(8|9|10|11) ]]; then
        echo "$p"
        return 0
      fi
    fi
  done
  return 1
}

PY=$(find_py) || {
  echo "Need Python 3.8-3.11. Install with: brew install python@3.11"
  echo "Warning: Kitten TTS will not be available without Python setup"
  exit 0
}
echo "Using Python: $PY"

VENV="python_env"
if [[ ! -d $VENV ]]; then
  echo "Virtual environment not found. Run the main TTS setup first."
  exit 1
fi

pip() {
  "$VENV/bin/pip" "$@"
}

echo "Installing Kitten TTS..."
pip install --quiet https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl || {
  echo "Warning: Failed to install Kitten TTS"
  echo "Kitten TTS features will not be available"
  exit 0
}

pip install --quiet soundfile numpy || {
  echo "Warning: Failed to install Kitten TTS dependencies"
  exit 0
}

echo "Verifying Kitten TTS installation..."
"$VENV/bin/python" - <<'PY'
try:
    from kittentts import KittenTTS
    print("✓ Kitten TTS installed successfully")
except Exception as e:
    print(f"⚠ Kitten TTS verification failed: {e}")
    exit(1)
PY

echo "Testing Kitten TTS with default model..."
"$VENV/bin/python" - <<'PY' || true
try:
    from kittentts import KittenTTS
    model = KittenTTS("KittenML/kitten-tts-nano-0.1")
    print("✓ Kitten TTS model loaded successfully")
except Exception as e:
    print(f"⚠ Model loading test failed: {e}")
PY

echo "Kitten TTS setup completed successfully!"