#!/bin/bash
set -euo pipefail
p='[setup/transcription/whisper-diarization]'

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
esac

ensure_python311() {
  if command -v python3.11 &>/dev/null; then
    echo "$p Python 3.11 already available"
    return 0
  fi
  
  if command -v brew &>/dev/null; then
    echo "$p Installing Python 3.11 via Homebrew"
    brew install python@3.11 >/dev/null 2>&1 || {
      echo "$p WARNING: Failed to install Python 3.11 via Homebrew"
      return 1
    }
    echo "$p Python 3.11 installed successfully"
    return 0
  else
    echo "$p ERROR: Homebrew not found, cannot install Python 3.11"
    return 1
  fi
}

get_python311_path() {
  for pth in python3.11 /usr/local/bin/python3.11 /opt/homebrew/bin/python3.11; do
    if command -v "$pth" &>/dev/null; then
      v=$("$pth" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
      if [ "$v" = "3.11" ]; then
        echo "$pth"
        return 0
      fi
    fi
  done
  return 1
}

WHISPER_DIAR_DIR="whisper-diarization-temp"
BIN_DIR="build/bin"
MODELS_DIR="build/models"
SCRIPT_DIR=".github/setup/transcription"
VENV_DIR="build/pyenv/whisper-diarization"

mkdir -p "$BIN_DIR" "$MODELS_DIR"

echo "$p Setting up whisper-diarization Python environment with Python 3.11"

if ! ensure_python311; then
  echo "$p ERROR: Cannot install Python 3.11, whisper-diarization features unavailable"
  exit 1
fi

PY311=$(get_python311_path) || {
  echo "$p ERROR: Python 3.11 not found after installation"
  exit 1
}

echo "$p Using Python 3.11 at: $PY311"

if [ -d "$VENV_DIR" ]; then
  echo "$p Removing existing whisper-diarization environment"
  chmod -R u+w "$VENV_DIR" 2>/dev/null || true
  rm -rf "$VENV_DIR" 2>/dev/null || {
    echo "$p WARNING: Could not remove existing environment completely"
    mv "$VENV_DIR" "${VENV_DIR}.backup.$(date +%s)" 2>/dev/null || true
  }
fi

echo "$p Creating whisper-diarization environment with Python 3.11"
"$PY311" -m venv "$VENV_DIR" || {
  echo "$p ERROR: Failed to create virtual environment with Python 3.11"
  exit 1
}

if [ ! -f "$VENV_DIR/bin/python" ]; then
  echo "$p ERROR: Failed to create Python virtual environment"
  exit 1
fi

PIP="$VENV_DIR/bin/pip"
PYTHON="$VENV_DIR/bin/python"

echo "$p Upgrading pip and installing core dependencies"
"$PIP" install --upgrade pip setuptools wheel >/dev/null 2>&1
"$PIP" install "numpy<2" >/dev/null 2>&1

echo "$p Installing system dependencies"
if command -v ffmpeg >/dev/null 2>&1; then
  echo "$p ffmpeg found"
else
  echo "$p ERROR: ffmpeg not found, whisper-diarization requires ffmpeg"
  exit 1
fi

echo "$p Installing Cython and Rust (for ctc-forced-aligner)"
"$PIP" install cython >/dev/null 2>&1

if [ "$IS_MAC" = true ]; then
  if ! command -v rustc >/dev/null 2>&1; then
    echo "$p Installing Rust for ctc-forced-aligner compilation"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y >/dev/null 2>&1
    source "$HOME/.cargo/env" || export PATH="$HOME/.cargo/bin:$PATH"
  fi
fi

echo "$p Installing PyTorch (compatible versions)"
if [ "$IS_MAC" = true ]; then
  "$PIP" install "torch==2.2.0" >/dev/null 2>&1
  "$PIP" install "torchaudio==2.2.0" >/dev/null 2>&1
else
  "$PIP" install "torch==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
  "$PIP" install "torchaudio==2.2.0" --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1
fi

echo "$p Installing audio processing dependencies"
"$PIP" install librosa soundfile scipy >/dev/null 2>&1

echo "$p Installing whisper dependencies"
"$PIP" install "openai-whisper==20231117" >/dev/null 2>&1
"$PIP" install "faster-whisper==0.10.1" >/dev/null 2>&1

echo "$p Installing ctc-forced-aligner (specific compatible version)"
export PATH="$HOME/.cargo/bin:$PATH"
"$PIP" install "ctc-forced-aligner==0.1.8" >/dev/null 2>&1 || {
  "$PIP" install "ctc-forced-aligner==0.1.7" >/dev/null 2>&1 || {
    "$PIP" install ctc-forced-aligner >/dev/null 2>&1 || {
      echo "$p WARNING: Failed to install ctc-forced-aligner, using whisper-only fallback"
    }
  }
}

echo "$p Installing speaker diarization dependencies (specific versions)"
"$PIP" install "demucs==4.0.0" >/dev/null 2>&1 || "$PIP" install demucs >/dev/null 2>&1 || echo "$p WARNING: demucs installation failed"
"$PIP" install "pyannote.audio==3.1.1" >/dev/null 2>&1 || "$PIP" install "pyannote.audio" >/dev/null 2>&1 || echo "$p WARNING: pyannote.audio installation failed"

echo "$p Installing NeMo toolkit (compatible version)"
"$PIP" install "nemo-toolkit[asr]==1.22.0" >/dev/null 2>&1 || "$PIP" install "nemo-toolkit[asr]" >/dev/null 2>&1 || "$PIP" install nemo-toolkit >/dev/null 2>&1 || echo "$p WARNING: nemo-toolkit installation failed"

echo "$p Cloning and setting up whisper-diarization"
rm -rf "$WHISPER_DIAR_DIR"
git clone https://github.com/MahmoudAshraf97/whisper-diarization.git "$WHISPER_DIAR_DIR" >/dev/null 2>&1

cd "$WHISPER_DIAR_DIR"

if [ -f "requirements.txt" ]; then
  echo "$p Installing remaining requirements from requirements.txt"
  "$PIP" install -r requirements.txt >/dev/null 2>&1 || echo "$p WARNING: Some additional requirements failed to install"
fi

echo "$p Copying diarization scripts"
if [ -f "diarize.py" ]; then
  cp diarize.py "../$BIN_DIR/whisper-diarize-original.py"
else
  echo "$p WARNING: diarize.py not found in whisper-diarization repository"
fi

if [ -f "helpers.py" ]; then
  cp helpers.py "../$BIN_DIR/"
fi

cd ..
rm -rf "$WHISPER_DIAR_DIR"

echo "$p Installing compatibility wrapper"
if [ -f "$SCRIPT_DIR/whisper-diarization-wrapper.py" ]; then
  cp "$SCRIPT_DIR/whisper-diarization-wrapper.py" "$BIN_DIR/whisper-diarize.py"
else
  echo "$p ERROR: whisper-diarization-wrapper.py not found"
  exit 1
fi

echo "$p Validating dependencies and compatibility"
"$PYTHON" - <<'PY'
import sys
critical_modules = ["whisper", "librosa", "soundfile", "scipy", "torch", "torchaudio", "numpy"]
optional_modules = ["ctc_forced_aligner", "demucs", "pyannote.audio"]
missing_critical = []
missing_optional = []
compatibility_issues = []

for module in critical_modules:
    try:
        mod = __import__(module)
        print(f"✓ {module}")
    except ImportError as e:
        missing_critical.append(f"{module}: {e}")
        print(f"✗ {module}: {e}")

for module in optional_modules:
    try:
        mod = __import__(module)
        print(f"✓ {module}")
        
        if module == "ctc_forced_aligner":
            try:
                from ctc_forced_aligner import load_alignment_model
                print(f"  ✓ load_alignment_model function available")
            except ImportError:
                try:
                    from ctc_forced_aligner.alignment import load_model
                    print(f"  ✓ alternative load_model function available")
                except ImportError:
                    compatibility_issues.append(f"{module}: missing expected functions")
                    
    except ImportError as e:
        missing_optional.append(f"{module}: {e}")
        print(f"✗ {module}: {e}")

if missing_critical:
    print(f"\nCRITICAL ERROR: Missing required modules:")
    for missing in missing_critical:
        print(f"  - {missing}")
    sys.exit(1)
    
if missing_optional:
    print(f"\nOptional modules missing (will use fallback mode):")
    for missing in missing_optional:
        print(f"  - {missing}")
    
if compatibility_issues:
    print(f"\nCompatibility issues detected:")
    for issue in compatibility_issues:
        print(f"  - {issue}")
    print("Whisper-diarization will use fallback mode")
else:
    print("\nAll dependencies and compatibility checks passed")
PY

chmod +x "$BIN_DIR/whisper-diarize.py" 2>/dev/null || true

FINAL_PY_VERSION=$("$PYTHON" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')
echo "$p Whisper-diarization environment setup complete with Python $FINAL_PY_VERSION"
echo "$p Done"