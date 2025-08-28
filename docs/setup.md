# AutoShow CLI Setup Documentation

## Overview

The `npm run setup` command executes `.github/setup/index.sh` which performs a comprehensive installation and configuration of all AutoShow CLI dependencies, models, and tools on macOS systems.

## Execution Flow

### Logging and Error Handling
- Creates timestamped log file: `setup-YYYYMMDD-HHMMSS.log`
- Uses strict bash options (`set -euo pipefail`) for immediate error termination
- On success: log file is automatically deleted
- On failure: log file is preserved with error details

### Platform Requirements
- **Operating System**: macOS only (script exits on other platforms)
- **Python**: 3.9, 3.10, or 3.11 required for various components
- **Homebrew**: Must be installed before running setup

## Setup Components

### 1. Environment Initialization

**Directory Structure**
- Creates `build/config` directory for all configuration files
- Creates `build/pyenv` directory for all Python virtual environments
- All Python environments are centralized under `build/pyenv/` for better organization

**Configuration Files**
- Creates `.env` from `.env.example` if missing
- Sources and exports all environment variables
- Displays masked preview of `HF_TOKEN` if configured

**Node.js Dependencies**
- Executes `npm install` for package.json dependencies

### 2. System Dependencies (via Homebrew)

Installs the following if not present:
- `cmake` - Build system for C++ compilation
- `ffmpeg` - Audio/video processing
- `graphicsmagick` - Image manipulation
- `espeak-ng` - Text-to-speech synthesis
- `git` - Version control
- `pkg-config` - Library configuration

### 3. Transcription Toolchain

#### Whisper CPU (`whisper.sh`)
- Clones `ggerganov/whisper.cpp` to temporary directory
- Builds static `whisper-cli` binary
- Copies binary to `build/bin/whisper-cli`
- Adjusts dylib paths for macOS compatibility
- Removes temporary repository

#### Whisper Metal (`whisper-metal.sh`)
- Builds with `-DGGML_METAL=ON` for GPU acceleration
- Creates `build/bin/whisper-cli-metal`
- Downloads `ggml-base.bin` model (~140MB) to `build/models/`
- Cleans up temporary build directory

#### Whisper CoreML (`whisper-coreml.sh`)
- Builds with `-DWHISPER_COREML=ON` for Apple Neural Engine
- Creates Python venv at `build/pyenv/coreml`
- Installs specialized packages:
  - `numpy<2`, `torch==2.5.0` (CPU)
  - `coremltools>=7,<8`
  - `transformers`, `ane-transformers`
  - `openai-whisper`
- Attempts CoreML encoder conversion
- Creates `build/bin/whisper-cli-coreml`

### 4. Text-to-Speech (TTS)

#### Shared Environment (`tts-env.sh`)
- Creates `build/pyenv/tts/` fresh on each run
- Requires Python 3.9-3.11
- Base packages: `numpy<2`, `soundfile`, `librosa`, `scipy`, `torch`, `torchaudio`
- Creates `build/config/.tts-config.json` with default configurations
- This environment is shared between TTS and Music generation

#### KittenTTS (`kitten.sh`)
- Uses shared `build/pyenv/tts/` environment
- Installs from GitHub release wheel
- Verifies model loading capability
- Ultra-lightweight TTS engine

#### Coqui TTS (`coqui.sh`)
- Uses shared `build/pyenv/tts/` environment
- Installs `TTS==0.22.0` with Git fallback
- Pre-downloads `tts_models/en/ljspeech/tacotron2-DDC` model
- Supports voice cloning and multiple languages

### 5. Music Generation

#### AudioCraft (`audiocraft.sh`)
- Uses shared `build/pyenv/tts/` environment
- Installs `torch==2.1.0` (CPU), `audiocraft`, `xformers`
- Downloads `facebook/musicgen-small` to `build/models/audiocraft/`
- Creates/updates `build/config/.music-config.json` with AudioCraft settings

#### Stable Audio (`stable-audio.sh`)
- Uses shared `build/pyenv/tts/` environment
- Upgrades shared environment to `torch==2.5.0`
- Installs `stable-audio-tools`, `einops`, `wandb`, `safetensors`, `gradio`
- Downloads model config for `stabilityai/stable-audio-open-1.0`
- Model weights download on first use
- Updates `build/config/.music-config.json` with Stable Audio settings

### 6. Image Generation

#### stable-diffusion.cpp (`sdcpp.sh`)
- Clones `leejet/stable-diffusion.cpp` to temporary directory
- Builds with:
  - Metal support on macOS
  - CUDA support if available
  - CPU fallback
- Copies `sd` binary to `build/bin/sd`
- Removes temporary repository

#### SD 1.5 Models (`sd1_5.sh`)
Downloads with 3 retry attempts and size validation:
- `v1-5-pruned-emaonly.safetensors` (~1.6GB minimum)
- `lcm-lora-sdv1-5.safetensors` (~60MB minimum)

#### SD 3.5 Models (`sd3_5.sh`)
- Requires HF token with gated model access
- Downloads SD3 Medium or SD3.5 Large models
- Downloads required text encoders (CLIP-L, CLIP-G, T5XXL)

### 7. Video Generation (Beta)

#### Wan2.1 (`wan.sh`)
- Creates dedicated `build/pyenv/wan` Python environment
- Installs comprehensive dependencies:
  - `torch`, `torchvision`, `torchaudio` (CPU)
  - `transformers`, `accelerate`, `safetensors`
  - `diffusers>=0.31.0`
  - `imageio[ffmpeg]`, `opencv-python`
- Clones `Wan-Video/Wan2.1` to temporary directory
- Installs requirements if found
- Removes temporary repository after extracting requirements
- Downloads `Wan-AI/Wan2.1-T2V-1.3B-Diffusers` model
- Copies dedicated wrapper script from `.github/setup/video/wan_wrapper.py` to `build/models/wan/`
- Creates `build/config/.wan-config.json` configuration

## Directory Structure After Setup

```
autoshow-cli/
├── build/
│   ├── config/
│   │   ├── .tts-config.json
│   │   ├── .music-config.json
│   │   └── .wan-config.json
│   ├── bin/
│   │   ├── whisper-cli
│   │   ├── whisper-cli-metal
│   │   ├── whisper-cli-coreml
│   │   ├── sd
│   │   └── *.dylib (macOS library files)
│   ├── models/
│   │   ├── ggml-base.bin
│   │   ├── sd/
│   │   │   ├── v1-5-pruned-emaonly.safetensors
│   │   │   └── lcm-lora-sdv1-5.safetensors
│   │   ├── audiocraft/
│   │   │   └── facebook/musicgen-small/
│   │   ├── stable-audio/
│   │   │   └── model_config.json
│   │   └── wan/
│   │       ├── T2V-1.3B-Diffusers/
│   │       └── wan_wrapper.py
│   └── pyenv/
│       ├── tts/ (shared TTS/music environment)
│       ├── coreml/ (CoreML conversion environment)
│       └── wan/ (video generation environment)
└── .env
```

## Configuration Files Created

### `build/config/.tts-config.json`
```json
{
  "python": "build/pyenv/tts/bin/python",
  "venv": "build/pyenv/tts",
  "coqui": {
    "default_model": "tts_models/en/ljspeech/tacotron2-DDC",
    "xtts_model": "tts_models/multilingual/multi-dataset/xtts_v2"
  },
  "kitten": {
    "default_model": "KittenML/kitten-tts-nano-0.1",
    "default_voice": "expr-voice-2-f"
  }
}
```

### `build/config/.music-config.json`
```json
{
  "python": "build/pyenv/tts/bin/python",
  "venv": "build/pyenv/tts",
  "audiocraft": {
    "default_model": "facebook/musicgen-small",
    "cache_dir": "build/models/audiocraft"
  },
  "stable_audio": {
    "default_model": "stabilityai/stable-audio-open-1.0",
    "cache_dir": "build/models/stable-audio"
  }
}
```

### `build/config/.wan-config.json`
```json
{
  "python": "build/pyenv/wan/bin/python",
  "venv": "build/pyenv/wan",
  "models_dir": "build/models/wan",
  "default_model": "t2v-1.3b",
  "available_models": {
    "t2v-1.3b": "build/models/wan/T2V-1.3B-Diffusers",
    "t2v-14b": "build/models/wan/T2V-14B-Diffusers"
  }
}
```

## Memory and Storage Requirements

### Disk Space
- Minimum: ~10GB for basic setup
- Recommended: ~20GB with all models
- Optional SD3.5 models: Additional ~15GB

### RAM Requirements
- Minimum: 8GB
- Recommended: 16GB for video/music generation
- Optimal: 32GB for large model operations

### Python Virtual Environments
- `build/pyenv/tts/`: ~2-3GB (shared TTS/music)
- `build/pyenv/coreml/`: ~1-2GB (CoreML conversion)
- `build/pyenv/wan/`: ~2-3GB (video generation)

## Error Recovery

### Log File Preservation
Failed setups preserve logs at: `setup-YYYYMMDD-HHMMSS.log`

### Partial Setup Recovery
Components are modular - if one fails, others may still complete successfully.

### Common Issues
1. **Python Version**: Ensure Python 3.9-3.11 is available
2. **Homebrew**: Must be installed before running setup
3. **Disk Space**: Ensure sufficient space for models
4. **Network**: Stable connection required for downloads

## Python Environment Organization

The setup creates a centralized `build/pyenv/` directory structure:

### Shared TTS/Music Environment (`build/pyenv/tts/`)
- Used by: Coqui TTS, Kitten TTS, AudioCraft, Stable Audio
- Rationale: These tools share many dependencies (torch, numpy, audio libraries)
- Benefits: Reduced disk usage, single environment to maintain

### CoreML Environment (`build/pyenv/coreml/`)
- Used by: Whisper CoreML conversion
- Rationale: Requires specific versions of coremltools and transformers
- Benefits: Isolated from other environments to prevent conflicts

### Wan Video Environment (`build/pyenv/wan/`)
- Used by: Wan2.1 video generation
- Rationale: Requires specific diffusers and video processing libraries
- Benefits: Dedicated environment for complex video generation dependencies

## Cleanup Approach

The setup follows a consistent pattern for external repositories:
1. Clone to temporary directory
2. Build/extract necessary files
3. Copy artifacts to permanent locations
4. Remove temporary repository

This approach is used for:
- `whisper.cpp` (all variants)
- `stable-diffusion.cpp`
- `Wan2.1` repository

## Beta Features

### Wan2.1 Video Generation
- Currently generates placeholder videos
- Full Diffusers integration in progress
- Models downloaded but not fully operational
- Wrapper script provides fallback functionality