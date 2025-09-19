#!/bin/bash
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOGFILE="setup-${TIMESTAMP}.log"
exec > >(tee -a "$LOGFILE") 2>&1

cleanup_log() {
  local status=$?
  if [ "$status" -eq 0 ]; then
    rm -f "$LOGFILE"
  else
    echo "ERROR: Script failed (exit code $status). Logs saved in: $LOGFILE"
    echo "Last 20 lines of log:"
    tail -n 20 "$LOGFILE"
  fi
  exit $status
}
trap cleanup_log EXIT

set -euo pipefail
p='[setup/index]'

SETUP_MODE=""
case "${1:-}" in
  --image)
    SETUP_MODE="image"
    ;;
  --sd1)
    SETUP_MODE="sd1"
    ;;
  --sd3)
    SETUP_MODE="sd3"
    ;;
  --music)
    SETUP_MODE="music"
    ;;
  --transcription)
    SETUP_MODE="transcription"
    ;;
  --whisper)
    SETUP_MODE="whisper"
    ;;
  --whisper-coreml)
    SETUP_MODE="whisper-coreml"
    ;;
  --whisper-diarization)
    SETUP_MODE="whisper-diarization"
    ;;
  --tts)
    SETUP_MODE="tts"
    ;;
  "")
    SETUP_MODE="base"
    ;;
  *)
    echo "$p ERROR: Invalid argument '$1'"
    echo "$p Usage: $0 [--image|--sd1|--sd3|--music|--transcription|--whisper|--whisper-coreml|--whisper-diarization|--tts]"
    echo "$p   (no args): Base setup only (npm dependencies and directories)"
    echo "$p   --image: Setup image generation environment and download all models (SD 1.5 + SD 3.5)"
    echo "$p   --sd1: Setup Stable Diffusion 1.5 models only"
    echo "$p   --sd3: Setup Stable Diffusion 3.5 models only"
    echo "$p   --music: Setup music generation environment and download models"
    echo "$p   --transcription: Setup all transcription environments and download models"
    echo "$p   --whisper: Setup whisper-metal (default whisper.cpp with Metal support)"
    echo "$p   --whisper-coreml: Setup whisper CoreML for optimized inference on Apple Silicon"
    echo "$p   --whisper-diarization: Setup whisper with speaker diarization capabilities"
    echo "$p   --tts: Setup TTS environment and download models"
    exit 1
    ;;
esac

IS_MAC=false
case "$OSTYPE" in
  darwin*) IS_MAC=true ;;
  *) echo "$p ERROR: Only macOS is supported"; exit 1 ;;
esac

quiet_brew_install() {
  local pkg="$1"
  if ! brew list --formula | grep -qx "$pkg"; then
    echo "$p Installing $pkg..."
    brew install "$pkg"
  fi
}

command_exists() {
  command -v "$1" &>/dev/null
}

ensure_homebrew() {
  if ! command_exists brew; then
    echo "$p ERROR: Homebrew not found. Install from https://brew.sh/"
    exit 1
  fi
}

echo "$p Starting AutoShow CLI setup (mode: $SETUP_MODE)"

echo "$p Running base setup (npm dependencies and directories)"
mkdir -p build/config
echo "$p Created build/config directory"
mkdir -p build/pyenv
echo "$p Created build/pyenv directory for Python environments"

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
fi

if [ -f ".env" ]; then
  echo "$p Loading environment from .env"
  set -a
  . ./.env
  set +a
  if [ -n "${HF_TOKEN:-}" ]; then
    echo "$p Detected HF_TOKEN starting with ${HF_TOKEN:0:8}..."
  fi
fi

npm install

if [ "$IS_MAC" != true ]; then
  echo "$p ERROR: This script only supports macOS"
  exit 1
fi

ensure_homebrew

SETUP_DIR=".github/setup"

case "$SETUP_MODE" in
  image)
    echo "$p Setting up image generation environment and downloading models"
    
    echo "$p Installing required Homebrew packages for image generation"
    quiet_brew_install "cmake"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up stable-diffusion.cpp"
    bash "$SETUP_DIR/image/sdcpp.sh"
    
    echo "$p Downloading image generation models"
    bash "$SETUP_DIR/image/sd1_5.sh"
    bash "$SETUP_DIR/image/sd3_5.sh"
    
    echo "$p Image generation setup completed"
    ;;
    
  sd1)
    echo "$p Setting up Stable Diffusion 1.5 models only"
    
    echo "$p Installing required Homebrew packages for image generation"
    quiet_brew_install "cmake"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up stable-diffusion.cpp"
    bash "$SETUP_DIR/image/sdcpp.sh"
    
    echo "$p Downloading Stable Diffusion 1.5 models"
    bash "$SETUP_DIR/image/sd1_5.sh"
    
    echo "$p Stable Diffusion 1.5 setup completed"
    ;;
    
  sd3)
    echo "$p Setting up Stable Diffusion 3.5 models only"
    
    echo "$p Installing required Homebrew packages for image generation"
    quiet_brew_install "cmake"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up stable-diffusion.cpp"
    bash "$SETUP_DIR/image/sdcpp.sh"
    
    echo "$p Downloading Stable Diffusion 3.5 models"
    bash "$SETUP_DIR/image/sd3_5.sh"
    
    echo "$p Stable Diffusion 3.5 setup completed"
    ;;
    
  music)
    echo "$p Setting up music generation environment and downloading models"
    
    echo "$p Installing required Homebrew packages for music generation"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up shared TTS environment for music generation"
    bash "$SETUP_DIR/tts/tts-env.sh"
    
    echo "$p Setting up AudioCraft"
    bash "$SETUP_DIR/music/audiocraft.sh"
    
    echo "$p Setting up Stable Audio"
    bash "$SETUP_DIR/music/stable-audio.sh"
    
    echo "$p Downloading music generation models"
    bash "$SETUP_DIR/music/models.sh"
    
    echo "$p Music generation setup completed"
    ;;
    
  transcription)
    echo "$p Setting up all transcription environments and downloading models"
    
    echo "$p Installing required Homebrew packages for transcription"
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    quiet_brew_install "git"
    
    echo "$p Setting up Whisper CPU"
    bash "$SETUP_DIR/transcription/whisper.sh"
    
    echo "$p Setting up Whisper Metal"
    bash "$SETUP_DIR/transcription/whisper-metal.sh"
    
    echo "$p Setting up Whisper CoreML"
    bash "$SETUP_DIR/transcription/whisper-coreml.sh"
    
    echo "$p Setting up Whisper Diarization"
    bash "$SETUP_DIR/transcription/whisper-diarization.sh"
    
    echo "$p Downloading transcription models"
    bash "$SETUP_DIR/transcription/models.sh"
    
    echo "$p All transcription environments setup completed"
    ;;
    
  whisper)
    echo "$p Setting up whisper-metal (default whisper.cpp with Metal support)"
    
    echo "$p Installing required Homebrew packages for whisper"
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up Whisper CPU"
    bash "$SETUP_DIR/transcription/whisper.sh"
    
    echo "$p Setting up Whisper Metal"
    bash "$SETUP_DIR/transcription/whisper-metal.sh"
    
    echo "$p Downloading whisper models"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    
    echo "$p Whisper-metal setup completed"
    ;;
    
  whisper-coreml)
    echo "$p Setting up whisper CoreML for optimized inference on Apple Silicon"
    
    echo "$p Installing required Homebrew packages for whisper CoreML"
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up Whisper CPU (base dependency)"
    WHISPER_RESULT=0
    bash "$SETUP_DIR/transcription/whisper.sh" || WHISPER_RESULT=$?
    if [ $WHISPER_RESULT -ne 0 ]; then
      echo "$p ERROR: Whisper CPU setup failed with code $WHISPER_RESULT"
      exit $WHISPER_RESULT
    fi
    
    echo "$p Setting up Whisper CoreML"
    COREML_RESULT=0
    bash "$SETUP_DIR/transcription/whisper-coreml.sh" || COREML_RESULT=$?
    if [ $COREML_RESULT -ne 0 ]; then
      echo "$p ERROR: Whisper CoreML setup failed with code $COREML_RESULT"
      exit $COREML_RESULT
    fi
    
    echo "$p Downloading whisper models"
    MODEL_RESULT=0
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models" || MODEL_RESULT=$?
    if [ $MODEL_RESULT -ne 0 ]; then
      echo "$p ERROR: Model download failed with code $MODEL_RESULT"
      exit $MODEL_RESULT
    fi
    
    echo "$p Generating CoreML models"
    GENERATE_RESULT=0
    bash "$SETUP_DIR/transcription/generate-coreml-model.sh" base || GENERATE_RESULT=$?
    if [ $GENERATE_RESULT -ne 0 ]; then
      echo "$p WARNING: CoreML model generation returned code $GENERATE_RESULT"
      echo "$p Checking if model was created despite non-zero exit code"
      if [ -d "build/models/ggml-base-encoder.mlmodelc" ] || [ -d "build/models/coreml-encoder-base.mlpackage" ]; then
        echo "$p CoreML model artifacts found, continuing"
      else
        echo "$p ERROR: No CoreML model artifacts found"
        exit $GENERATE_RESULT
      fi
    fi
    
    echo "$p Whisper CoreML setup completed"
    ;;
    
  whisper-diarization)
    echo "$p Setting up whisper with speaker diarization capabilities"
    
    echo "$p Installing required Homebrew packages for whisper diarization"
    quiet_brew_install "cmake"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "pkg-config"
    quiet_brew_install "git"
    
    echo "$p Setting up Whisper CPU (base dependency)"
    bash "$SETUP_DIR/transcription/whisper.sh"
    
    echo "$p Setting up Whisper Diarization"
    bash "$SETUP_DIR/transcription/whisper-diarization.sh"
    
    echo "$p Downloading whisper models"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" base "./build/models"
    bash "$SETUP_DIR/transcription/download-ggml-model.sh" medium.en "./build/models"
    
    echo "$p Whisper diarization setup completed"
    ;;
    
  tts)
    echo "$p Setting up TTS environment and downloading models"
    
    echo "$p Installing required Homebrew packages for TTS"
    quiet_brew_install "ffmpeg"
    quiet_brew_install "espeak-ng"
    quiet_brew_install "pkg-config"
    
    echo "$p Setting up shared TTS environment"
    bash "$SETUP_DIR/tts/tts-env.sh"
    
    echo "$p Setting up Kitten TTS"
    bash "$SETUP_DIR/tts/kitten.sh"
    
    echo "$p Setting up Coqui TTS"
    bash "$SETUP_DIR/tts/coqui.sh"
    
    echo "$p Downloading TTS models"
    bash "$SETUP_DIR/tts/models.sh"
    
    echo "$p TTS setup completed"
    ;;
    
  base)
    echo "$p Base setup completed (npm dependencies and directories only)"
    echo "$p Run with --image, --sd1, --sd3, --music, --transcription, --whisper, --whisper-coreml, --whisper-diarization, or --tts to set up specific features"
    ;;
esac

echo "$p Setup completed successfully"
exit 0