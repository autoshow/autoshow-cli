# AutoShow CLI Setup

## Quick Start

### Base Setup
```bash
bun setup
```
Installs npm dependencies and creates directory structure. No Python environments or models.

### Feature Setup
```bash
# All features (transcription + TTS)
bun setup:all

# Audio transcription (Whisper.cpp)
bun setup:transcription

# Text-to-speech (Coqui + Kitten)
bun setup:tts
```

Each feature is self-contained and won't affect others if setup fails.

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **macOS** | Fully supported | Uses Homebrew, includes CoreML acceleration |
| **Linux** | Fully supported | Auto-detects package manager (apt, dnf, yum, pacman, apk, zypper) |
| **Windows** | Via WSL | Install [WSL](https://learn.microsoft.com/en-us/windows/wsl/install), then use Linux instructions |

## Requirements

- **Homebrew** (macOS) - install from https://brew.sh/
- **Package manager** (Linux) - apt, dnf, yum, pacman, apk, or zypper
- **Internet connection** for model downloads

## Storage Requirements

| Feature | Disk Space | Time |
|---------|------------|------|
| Base | ~200MB | 1-2 min |
| Transcription | ~1GB | 3-5 min |
| TTS | ~500MB | 2-3 min |
| All | ~1.5GB | 5-8 min |

## What Gets Installed

### Transcription (`--transcription`)

The setup automatically detects your platform and configures the optimal Whisper.cpp build:

| Platform | Binary | Acceleration |
|----------|--------|--------------|
| **macOS** | whisper-cli, whisper-cli-coreml | Metal + CoreML |
| **Linux** | whisper-cli | CPU |

**Installed components:**
- **Binaries:** `build/bin/whisper-cli` (+ `whisper-cli-coreml` on macOS)
- **Environments:** `build/pyenv/coreml/` (macOS only)
- **Models:** GGML base model (~140MB), CoreML models (macOS only)
- **Dependencies:** cmake, ffmpeg, git, pkg-config

### Text-to-Speech (`--tts`)
- **Environment:** `build/pyenv/tts/`
- **Models:** Coqui TTS, KittenTTS default models
- **Dependencies:** ffmpeg, espeak-ng, pkg-config

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

## Troubleshooting

### Linux: Missing dependencies

If auto-installation fails, install dependencies manually:

```bash
# Debian/Ubuntu
sudo apt-get install cmake ffmpeg git pkg-config espeak-ng python3.11 python3.11-venv

# Fedora/RHEL
sudo dnf install cmake ffmpeg git pkg-config espeak-ng python3.11

# Arch
sudo pacman -S cmake ffmpeg git pkg-config espeak-ng python

# Alpine
sudo apk add cmake ffmpeg git pkgconf espeak-ng python3 py3-pip

# openSUSE
sudo zypper install cmake ffmpeg git pkg-config espeak-ng python311
```

### Windows: Use WSL

AutoShow CLI requires WSL on Windows:

1. Install WSL: `wsl --install`
2. Open a WSL terminal
3. Follow Linux setup instructions
