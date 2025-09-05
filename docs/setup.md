# AutoShow CLI Setup

## Quick Start

### Base Setup
```bash
npm run setup
```
Installs npm dependencies and creates directory structure. No Python environments or models.

### Feature Setup
```bash
npm run setup:image          # Image generation (stable-diffusion.cpp)
npm run setup:music          # Music generation (AudioCraft + Stable Audio)
npm run setup:transcription  # Audio transcription (Whisper variants)
npm run setup:tts            # Text-to-speech (Coqui + Kitten)
```

Each feature is self-contained and won't affect others if setup fails.

## Requirements

- **macOS only**
- **Homebrew** (install from https://brew.sh/)
- **Internet connection** for model downloads

## Storage Requirements

| Feature | Disk Space | Time |
|---------|------------|------|
| Base | ~200MB | 1-2 min |
| Transcription | ~1GB | 3-5 min |
| TTS | ~500MB | 2-3 min |
| Music | ~2GB | 5-8 min |
| Image | 1.6GB - 15GB | 5-15 min |

## Usage Patterns

**Minimal setup for transcription:**
```bash
npm run setup
npm run setup:transcription
```

**Content creation setup:**
```bash
npm run setup
npm run setup:transcription
npm run setup:tts
npm run setup:image
```

**Audio-focused setup:**
```bash
npm run setup
npm run setup:transcription
npm run setup:music
npm run setup:tts
```

## What Gets Installed

### Image Generation (`--image`)
- **Binary:** `build/bin/sd` (stable-diffusion.cpp)
- **Models:** SD 1.5 (~1.6GB) or SD 3.5 (~15GB with HF_TOKEN)
- **Dependencies:** cmake, pkg-config

### Music Generation (`--music`)
- **Environment:** `build/pyenv/tts/` (shared with TTS)
- **Models:** AudioCraft MusicGen, Stable Audio configs
- **Dependencies:** ffmpeg, pkg-config

### Transcription (`--transcription`)
- **Binaries:** whisper-cli, whisper-cli-metal, whisper-cli-coreml
- **Environments:** `build/pyenv/coreml/`, `build/pyenv/whisper-diarization/`
- **Models:** GGML base model (~140MB), CoreML models (macOS)
- **Dependencies:** cmake, ffmpeg, git

### Text-to-Speech (`--tts`)
- **Environment:** `build/pyenv/tts/` (shared with music)
- **Models:** Coqui TTS, KittenTTS default models
- **Dependencies:** ffmpeg, espeak-ng

## Directory Structure

```
autoshow-cli/
├── build/
│   ├── bin/           # Compiled binaries
│   ├── config/        # JSON configuration files
│   ├── models/        # Downloaded models
│   └── pyenv/         # Python virtual environments
├── node_modules/      # npm dependencies
└── .env              # API keys and configuration
```

## Environment Variables

Add to `.env` file for enhanced functionality:

```env
# Required for SD 3.5 models
HF_TOKEN=your_huggingface_token

# Optional for cloud services
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```