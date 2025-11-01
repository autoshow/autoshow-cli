# AutoShow CLI Setup

## Quick Start

### Base Setup
```bash
npm run setup
```
Installs npm dependencies and creates directory structure. No Python environments or models.

### Feature Setup
```bash
npm run setup:transcription       # Audio transcription (Whisper variants)
npm run setup:whisper             # Whisper.cpp configured for Metal
npm run setup:whisper-coreml      # Whisper.cpp configured for Apple CoreML
npm run setup:whisper-diarization # Whisper with diarization (speaker labels) added

npm run setup:tts                 # Text-to-speech (Coqui + Kitten)
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

## What Gets Installed

### Transcription (`--transcription`)
- **Binaries:** whisper-cli, whisper-cli-metal, whisper-cli-coreml
- **Environments:** `build/pyenv/coreml/`, `build/pyenv/whisper-diarization/`
- **Models:** GGML base model (~140MB), CoreML models (macOS)
- **Dependencies:** cmake, ffmpeg, git

### Text-to-Speech (`--tts`)
- **Environment:** `build/pyenv/tts/`
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
# Optional for cloud services
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```