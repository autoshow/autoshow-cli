# AutoShow CLI Setup Documentation

## Setup Commands

The setup system now offers flexible configuration options to install only what you need:

### Base Setup (Default)
```bash
npm run setup
```
- Installs all binaries and virtual environments
- Sets up all tooling needed to use AutoShow CLI features  
- Does **not** download any models
- Fastest setup option for getting started

### Complete Setup
```bash
npm run setup:all
```
- Runs base setup plus downloads all available models
- This was the old default behavior of `npm run setup`
- Downloads ~15-20GB of models across all categories
- Recommended for users who want everything ready

### Feature-Specific Setup
Download models for specific functionality while ensuring base setup is complete:

```bash
# Whisper models (GGML + CoreML)
npm run setup:transcription

# Text-to-speech models  
npm run setup:tts

# AudioCraft + Stable Audio models
npm run setup:music

# Stable Diffusion models
npm run setup:image

# Wan2.1 video generation models
npm run setup:video
```

Each feature-specific command:
- Checks if base setup is complete and runs it if needed
- Downloads only the models for that specific feature
- Can be run independently in any order
- Safe to run multiple times (skips existing models)

### Usage Examples

**Quick start for transcription only:**
```bash
npm run setup:transcription
```

**Set up everything for content creation:**
```bash
npm run setup:all
```

**Incremental setup:**
```bash
npm run setup              # Base setup first
npm run setup:image      # Add image generation later  
npm run setup:music      # Add music generation when needed
```

## Overview

The setup system executes `.github/setup/index.sh` which performs installation and configuration of AutoShow CLI dependencies, models, and tools on macOS systems. The system is now modular, allowing users to install only the components they need.

## Execution Flow

### Argument Parsing and Mode Selection
The setup script now accepts command-line arguments to determine what to install:
- No arguments: Base setup only (binaries, environments, packages)
- `--all`: Complete setup with all models (legacy behavior)
- `--image`, `--music`, `--transcription`, `--tts`, `--video`: Feature-specific model downloads

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

### 1. Base Setup (Always Runs)

**Environment Initialization**
- Creates `build/config` directory for all configuration files
- Creates `build/pyenv` directory for all Python virtual environments
- All Python environments are centralized under `build/pyenv/` for better organization

**Configuration Files**
- Creates `.env` from `.env.example` if missing
- Sources and exports all environment variables
- Displays masked preview of `HF_TOKEN` if configured

**Node.js Dependencies**
- Executes `npm install` for package.json dependencies

**System Dependencies (via Homebrew)**
Installs the following if not present:
- `cmake` - Build system for C++ compilation
- `ffmpeg` - Audio/video processing
- `graphicsmagick` - Image manipulation
- `espeak-ng` - Text-to-speech synthesis
- `git` - Version control
- `pkg-config` - Library configuration

### 2. Component Setup (Always Runs)

All component setup scripts now run with `NO_MODELS=true` to skip model downloads during base setup.

#### Transcription Toolchain Setup

**Whisper CPU (`whisper.sh`)**
- Clones `ggerganov/whisper.cpp` to temporary directory
- Builds static `whisper-cli` binary
- Copies binary to `build/bin/whisper-cli`
- Adjusts dylib paths for macOS compatibility

**Whisper Metal (`whisper-metal.sh`)**
- Builds with `-DGGML_METAL=ON` for GPU acceleration
- Creates `build/bin/whisper-cli-metal`
- Skips model downloads when `NO_MODELS=true`

**Whisper CoreML (`whisper-coreml.sh`)**
- Builds with `-DWHISPER_COREML=ON` for Apple Neural Engine
- Creates Python venv at `build/pyenv/coreml`
- Installs CoreML conversion dependencies
- Creates `build/bin/whisper-cli-coreml`
- Skips CoreML model generation when `NO_MODELS=true`

#### Text-to-Speech Setup

**Shared Environment (`tts-env.sh`)**
- Creates `build/pyenv/tts/` fresh on each run
- Requires Python 3.9-3.11
- Base packages: `numpy<2`, `soundfile`, `librosa`, `scipy`, `torch`, `torchaudio`
- Creates `build/config/.tts-config.json` with default configurations
- This environment is shared between TTS and Music generation

**KittenTTS (`kitten.sh`)**
- Uses shared `build/pyenv/tts/` environment
- Installs from GitHub release wheel
- Verifies installation capability

**Coqui TTS (`coqui.sh`)**
- Uses shared `build/pyenv/tts/` environment
- Installs `TTS==0.22.0` with Git fallback
- Skips model pre-downloading when `NO_MODELS=true`

#### Music Generation Setup

**AudioCraft (`audiocraft.sh`)**
- Uses shared `build/pyenv/tts/` environment
- Installs `torch==2.1.0` (CPU), `audiocraft`, `xformers`
- Skips model downloads when `NO_MODELS=true`
- Creates/updates `build/config/.music-config.json`

**Stable Audio (`stable-audio.sh`)**
- Uses shared `build/pyenv/tts/` environment
- Upgrades shared environment to `torch==2.5.0`
- Installs `stable-audio-tools`, `einops`, `wandb`, `safetensors`, `gradio`
- Skips model downloads when `NO_MODELS=true`
- Updates `build/config/.music-config.json`

#### Image Generation Setup

**stable-diffusion.cpp (`sdcpp.sh`)**
- Clones `leejet/stable-diffusion.cpp` to temporary directory
- Builds with Metal support on macOS, CUDA if available, CPU fallback
- Copies `sd` binary to `build/bin/sd`

#### Video Generation Setup

**Wan2.1 (`wan.sh`)**
- Creates dedicated `build/pyenv/wan` Python environment
- Installs comprehensive video generation dependencies
- Copies wrapper script to `build/models/wan/`
- Creates `build/config/.wan-config.json`
- Skips model downloads when `NO_MODELS=true`

### 3. Model Downloads (Conditional)

Model downloading now happens only when explicitly requested via command arguments:

#### `--transcription` or `--all`
**Transcription Models (`transcription/models.sh`)**
- Downloads `ggml-base.bin` (~140MB) to `build/models/`
- Generates CoreML encoder models on macOS
- Requires base transcription setup to be complete

#### `--tts` or `--all`  
**TTS Models (`tts/models.sh`)**
- Pre-downloads Coqui TTS default model (`tts_models/en/ljspeech/tacotron2-DDC`)
- Pre-downloads KittenTTS model (`KittenML/kitten-tts-nano-0.1`)
- Requires shared TTS environment to be complete

#### `--music` or `--all`
**Music Generation Models (`music/models.sh`)**
- Downloads AudioCraft MusicGen model (`facebook/musicgen-small`)
- Downloads Stable Audio config (`stabilityai/stable-audio-open-1.0`)
- Requires shared TTS environment to be complete

#### `--image` or `--all`
**Image Generation Models**
- Downloads SD 1.5 models (~1.6GB total):
  - `v1-5-pruned-emaonly.safetensors`
  - `lcm-lora-sdv1-5.safetensors`
- Downloads SD 3.5 models (~15GB, requires HF token):
  - SD3 Medium or SD3.5 Large models
  - Required text encoders (CLIP-L, CLIP-G, T5XXL)

#### `--video` or `--all`
**Video Generation Models (`video/models.sh`)**
- Downloads Wan2.1 T2V-1.3B-Diffusers model
- Requires video generation environment to be complete

## Directory Structure After Setup

### Base Setup Only
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
│   └── pyenv/
│       ├── tts/ (shared TTS/music environment)
│       ├── coreml/ (CoreML conversion environment)
│       └── wan/ (video generation environment)
└── .env
```

### After Model Downloads
```
autoshow-cli/
├── build/
│   ├── models/
│   │   ├── ggml-base.bin (--transcription)
│   │   ├── ggml-base-encoder.mlmodelc (--transcription, macOS)
│   │   ├── tts/ (--tts)
│   │   ├── kitten/ (--tts)
│   │   ├── sd/ (--image)
│   │   │   ├── v1-5-pruned-emaonly.safetensors
│   │   │   └── lcm-lora-sdv1-5.safetensors
│   │   ├── audiocraft/ (--music)
│   │   │   └── facebook/musicgen-small/
│   │   ├── stable-audio/ (--music)
│   │   │   └── model_config.json
│   │   └── wan/ (--video)
│   │       ├── T2V-1.3B-Diffusers/
│   │       └── wan_wrapper.py
│   └── [other directories same as base]
```

## Configuration Files Created

Configuration files are created during base setup and remain the same regardless of which models are downloaded:

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

## Storage Requirements by Setup Type

### Base Setup Only
- Disk Space: ~2-3GB
- Components: All binaries, environments, packages
- Time: ~5-10 minutes
- RAM: 8GB minimum

### Feature-Specific Model Downloads
- `--transcription`: +140MB (GGML) + ~500MB (CoreML, macOS only)
- `--tts`: +200-500MB (cached models)  
- `--music`: +1-2GB (AudioCraft models)
- `--image`: +1.6GB (SD 1.5) or +15GB (SD 3.5 with encoders)
- `--video`: +2-3GB (Wan2.1 models)

### Complete Setup (`--all`)
- Disk Space: ~20-25GB total
- Time: 15-30 minutes depending on connection
- RAM: 16GB recommended, 32GB optimal

## Python Environment Organization

The setup maintains a centralized `build/pyenv/` directory structure:

### Shared TTS/Music Environment (`build/pyenv/tts/`)
- **Used by**: Coqui TTS, Kitten TTS, AudioCraft, Stable Audio
- **Rationale**: These tools share many dependencies (torch, numpy, audio libraries)
- **Benefits**: Reduced disk usage, single environment to maintain

### CoreML Environment (`build/pyenv/coreml/`)
- **Used by**: Whisper CoreML conversion
- **Rationale**: Requires specific versions of coremltools and transformers
- **Benefits**: Isolated from other environments to prevent conflicts

### Wan Video Environment (`build/pyenv/wan/`)
- **Used by**: Wan2.1 video generation
- **Rationale**: Requires specific diffusers and video processing libraries
- **Benefits**: Dedicated environment for complex video generation dependencies

## Migration from Previous Versions

Users upgrading from earlier versions should note:

### Breaking Changes
- `npm run setup` no longer downloads models by default
- Use `npm run setup:all` to get the previous complete behavior

### Recommended Migration Path
1. **Existing users**: Run `npm run setup:all` to maintain current functionality
2. **New users**: Start with `npm run setup` then add features as needed
3. **CI/CD**: Update scripts to use `npm run setup:all` or specific feature flags

### Cleanup of Old Setups
The new setup system will work alongside existing installations. To start fresh:
```bash
rm -rf build/
npm run setup:all
```

## Error Recovery

### Log File Preservation
Failed setups preserve logs at: `setup-YYYYMMDD-HHMMSS.log`

### Partial Setup Recovery
- Base setup is atomic - either all components install or none
- Model downloads are independent - failures in one don't affect others
- Re-running setup commands is safe and will skip existing components

### Common Issues
1. **Python Version**: Ensure Python 3.9-3.11 is available
2. **Homebrew**: Must be installed before running setup
3. **Disk Space**: Check requirements based on desired setup type
4. **Network**: Stable connection required for model downloads
5. **HF Token**: Required for SD 3.5 models (`--image` or `--all`)

## Performance Optimization

### Incremental Setup Strategy
For optimal resource usage:
```bash
# Start minimal
npm run setup

# Add features as needed
npm run setup:transcription  # When you need audio processing
npm run setup:image          # When you need image generation
npm run setup:music          # When you need music generation
```

### CI/CD Optimization
For automated environments:
```bash
# Cache-friendly: only download what's needed
npm run setup:transcription --image

# Or for complete functionality:
npm run setup:all
```

This modular approach reduces setup time, storage requirements, and bandwidth usage while maintaining full functionality when needed.