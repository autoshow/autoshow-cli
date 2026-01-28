# AutoShow CLI Setup

## Quick Start

### Base Setup
```bash
bun setup
```
Installs npm dependencies and creates directory structure. No Python environments or models.

### Feature Setup
```bash
# All features (transcription + Reverb + TTS)
bun setup:all

# Audio transcription (Whisper.cpp)
bun setup:transcription

# Reverb ASR + diarization
bun setup:reverb

# Text-to-speech (Qwen3)
bun setup:tts

# Individual TTS engines
bun setup:tts:qwen3      # Qwen3 TTS (multilingual)
bun setup:tts:chatterbox # Chatterbox TTS (voice cloning)
bun setup:tts:fish       # FishAudio TTS (emotion control)
bun setup:tts:cosyvoice  # CosyVoice TTS (9 languages, dialects)
```

Each feature is self-contained and won't affect others if setup fails.

### Setup Report

```bash
# Run report for any setup command
bun report:reverb
bun report:tts:qwen3
bun report:tts:chatterbox
bun report:tts:fish
bun report:tts:cosyvoice

# Force fresh run (removes marker files first)
bun report:tts:qwen3 --fresh

# Or directly
bun .github/setup/setup-report.ts setup:reverb --fresh
```

## Global CLI Options

These options work with all commands and control output formatting, behavior, and error handling.

### Output Formatting

| Option | Description |
|--------|-------------|
| `--no-color` | Disable colored output (also respects `NO_COLOR` env var) |
| `--json` | Output results as JSON for scripting and automation |
| `--plain` | Plain text output without formatting (for piping to grep, awk, etc.) |
| `-q, --quiet` | Suppress progress messages and non-essential output |

```bash
# Machine-readable JSON output
bun as -- text --file input/audio.mp3 --json

# Quiet mode for scripts
bun as -- text --rss "https://example.com/feed" --quiet
```

### Scripting and Automation

| Option | Description |
|--------|-------------|
| `--no-input` | Disable all interactive prompts (for unattended scripts) |
| `--skip-existing` | Skip processing items that already have output files |

```bash
# Batch processing without prompts
bun as -- text --rss "https://example.com/feed" --no-input --skip-existing
```

### Network and Reliability

| Option | Description |
|--------|-------------|
| `--timeout <ms>` | Network request timeout in milliseconds (default: 30000) |
| `--max-retries <n>` | Maximum retry attempts for failed requests (default: 7) |

```bash
# Longer timeout for slow connections
bun as -- text --video "https://youtube.com/..." --timeout 60000

# More retries for flaky networks
bun as -- text --rss "https://example.com/feed" --max-retries 10
```

### Signal Handling

AutoShow CLI handles Ctrl-C (SIGINT) gracefully:

- **First Ctrl-C**: Stops processing, cleans up temporary files, and exits
- **Second Ctrl-C**: Forces immediate exit if cleanup takes too long

This ensures downloads and temporary files are properly cleaned up when you cancel an operation.

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
| Reverb (ASR + diarization) | ~3-6GB | 8-15 min |
| TTS | ~500MB | 2-3 min |
| All | ~4-7GB | 10-18 min |

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

### Reverb (`--reverb`)
- **Environment:** `build/pyenv/reverb/`
- **Dependencies:** git-lfs, python3.11
- **Models:** Reverb ASR + Pyannote diarization models (downloaded via HuggingFace)

### Text-to-Speech (`--tts`)
- **Environment:** `build/pyenv/tts/`
- **Models:** Qwen3 default model
- **Dependencies:** ffmpeg, espeak-ng, pkg-config
- **Individual engines:** Install additional engines with `setup:tts:qwen3`, `setup:tts:chatterbox`, `setup:tts:fish`, or `setup:tts:cosyvoice`

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

# Required for Reverb diarization models
HF_TOKEN=your_hf_token
```

## User Configuration

AutoShow CLI supports user-level configuration stored in `~/.config/autoshow-cli/config.json`. This follows the XDG Base Directory specification.

### Configuration Locations

| Location | Purpose |
|----------|---------|
| `~/.config/autoshow-cli/config.json` | User-level settings and API keys |
| `~/.cache/autoshow-cli/` | Downloaded models and cached data |
| `~/.local/share/autoshow-cli/` | Persistent application data |

### User Config File

Create `~/.config/autoshow-cli/config.json` to store settings:

```json
{
  "api_keys": {
    "OPENAI_API_KEY": "sk-...",
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "ELEVENLABS_API_KEY": "..."
  },
  "tts": {
    "default_engine": "qwen3",
    "voices": {
      "elevenlabs": {
        "DUCO": "voice_id_here",
        "SEAMUS": "voice_id_here"
      },
      "qwen3": {
        "DUCO": "Vivian",
        "SEAMUS": "Ryan"
      }
    }
  },
  "defaults": {
    "transcription": "whisper",
    "llm": "chatgpt",
    "timeout": 30000,
    "max_retries": 7
  }
}
```

### API Key Priority

API keys are loaded in this order (first found wins):

1. **Key file** via `--*-key-file` option (most secure for scripts)
2. **Environment variable** (e.g., `OPENAI_API_KEY`)
3. **User config** (`~/.config/autoshow-cli/config.json`)

```bash
# Using a key file (recommended for CI/CD)
bun as -- text --file input/audio.mp3 --chatgpt --openai-key-file /path/to/key.txt
```

### XDG Environment Variables

You can customize config locations using XDG environment variables:

```bash
export XDG_CONFIG_HOME=/custom/config/path
export XDG_CACHE_HOME=/custom/cache/path
export XDG_DATA_HOME=/custom/data/path
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

## Exit Codes

AutoShow CLI uses standard exit codes for scripting:

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid usage or arguments |
| `3` | API or network error |
| `4` | File I/O error |
| `130` | Interrupted (Ctrl-C) |

```bash
# Check exit code in scripts
bun as -- text --file input/audio.mp3 --chatgpt
if [ $? -eq 0 ]; then
  echo "Success"
elif [ $? -eq 3 ]; then
  echo "API error - check your API key"
fi
```
