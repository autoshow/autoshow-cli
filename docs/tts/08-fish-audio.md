# FishAudio TTS

FishAudio provides two state-of-the-art TTS models with natural, expressive speech, fine-grained emotion control, and zero-shot voice cloning.

## Available Models

| Model | Size | Features | Availability |
|-------|------|----------|--------------|
| **s1-mini** | 0.5B | Open-source, natural speech, emotion control, voice cloning | HuggingFace, local inference |
| **s1** | 4B | Flagship model, best quality and stability, all features | HuggingFace, local inference |

## Requirements

- Python 3.11 with the TTS virtual environment
- **FishAudio API server running** (Docker recommended)
- GPU recommended (12GB VRAM for s1-mini, 24GB for s1) but CPU mode works

## Setup

```bash
# Install FishAudio TTS with s1-mini (default)
bun setup:tts:fish

# Install with s1 model (4B, best quality)
FISHAUDIO_MODEL=s1 bun setup:tts:fish
```

The setup script will:
1. Create the base TTS Python environment (if not already present)
2. Install required dependencies (requests, torch)
3. Attempt to download FishAudio weights (~2GB for s1-mini, ~8GB for s1) if HuggingFace credentials are configured
4. Optionally install flash-attn for better performance if CUDA is available

**Note:** FishAudio requires HuggingFace authentication to download the model weights. See the server setup instructions below.

## Quick Start

**Step 1: Download the model weights**

The FishAudio models require HuggingFace authentication (gated models).

```bash
# 1. Login to HuggingFace (one-time setup)
hf auth login

# 2. Accept the model license at:
#    s1-mini: https://huggingface.co/fishaudio/openaudio-s1-mini
#    s1: https://huggingface.co/fishaudio/openaudio-s1

# 3. Download weights
# s1-mini (~2GB)
mkdir -p build/checkpoints
hf download fishaudio/openaudio-s1-mini --local-dir build/checkpoints/openaudio-s1-mini

# s1 (~8GB, best quality)
hf download fishaudio/openaudio-s1 --local-dir build/checkpoints/openaudio-s1
```

**Step 2: Start the FishAudio API server**

```bash
# GPU server (recommended)
docker run -d --gpus all -p 8080:8080 \
  -v ./checkpoints:/app/checkpoints \
  -e COMPILE=1 \
  fishaudio/fish-speech:server-cuda

# Or CPU-only (slower, no GPU required)
docker run -d -p 8080:8080 \
  -v ./checkpoints:/app/checkpoints \
  fishaudio/fish-speech:server-cpu
```

**Step 3: Generate speech**

```bash
# Basic usage with s1-mini (default)
bun as -- tts input/sample.md --fish-audio

# Use s1 model (best quality)
bun as -- tts input/sample.md --fish-audio --fish-model s1

# With emotion control
bun as -- tts input/sample.md --fish-audio --fish-emotion excited

# Voice cloning with reference audio
bun as -- tts input/sample.md --fish-audio --ref-audio path/to/sample.wav

# Process a script file
bun as -- tts input/script.json --fish-audio
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--fish-audio` | Use FishAudio TTS engine |
| `--fish-model <model>` | Model: s1-mini (default), s1 |
| `--fish-language <lang>` | Language code: en, zh, ja, de, fr, es, ko, ar, ru, nl, it, pl, pt |
| `--fish-api-url <url>` | API server URL (default: http://localhost:8080) |
| `--fish-emotion <emotion>` | Emotion marker to prepend (see Emotion Control) |
| `--fish-device <device>` | Device override: cpu, mps, cuda |
| `--ref-audio <path>` | Reference audio for voice cloning (10-30s recommended) |
| `--ref-text <text>` | Transcript of reference audio |
| `--output <dir>` | Output directory |

## Server Setup

FishAudio requires the Fish Speech API server to be running.

### Docker (Recommended)

```bash
# 1. Login to HuggingFace and accept model licenses
hf auth login
# Then accept licenses at:
# s1-mini: https://huggingface.co/fishaudio/openaudio-s1-mini
# s1: https://huggingface.co/fishaudio/openaudio-s1

# 2. Download weights
# s1-mini (~2GB)
mkdir -p build/checkpoints
hf download fishaudio/openaudio-s1-mini --local-dir build/checkpoints/openaudio-s1-mini

# s1 (~8GB, best quality)
hf download fishaudio/openaudio-s1 --local-dir build/checkpoints/openaudio-s1

# 3. Start server - GPU (fastest)
docker run -d --gpus all -p 8080:8080 \
  -v ./checkpoints:/app/checkpoints \
  -e COMPILE=1 \
  fishaudio/fish-speech:server-cuda

# Or CPU server (slower, no GPU required)
docker run -d -p 8080:8080 \
  -v ./checkpoints:/app/checkpoints \
  fishaudio/fish-speech:server-cpu
```

### Manual Setup (Advanced)

```bash
# Clone fish-speech repository
git clone https://github.com/fishaudio/fish-speech.git
cd fish-speech

# Install dependencies
pip install -e .[cu129]  # or .[cpu] for CPU-only

# Download weights (choose one or both)
# s1-mini
hf download fishaudio/openaudio-s1-mini --local-dir build/checkpoints/openaudio-s1-mini

# s1
hf download fishaudio/openaudio-s1 --local-dir build/checkpoints/openaudio-s1

# Start server with s1-mini
python -m tools.api_server \
  --listen 0.0.0.0:8080 \
  --llama-checkpoint-path build/checkpoints/openaudio-s1-mini \
  --decoder-checkpoint-path build/checkpoints/openaudio-s1-mini/codec.pth

# Or start server with s1
python -m tools.api_server \
  --listen 0.0.0.0:8080 \
  --llama-checkpoint-path build/checkpoints/openaudio-s1 \
  --decoder-checkpoint-path build/checkpoints/openaudio-s1/codec.pth
```

## Emotion Control

FishAudio supports inline emotion markers in text:

**Basic emotions:**
```
(angry) (sad) (excited) (surprised) (satisfied) (delighted) 
(scared) (worried) (upset) (nervous) (frustrated) (depressed)
(empathetic) (embarrassed) (disgusted) (moved) (proud) (relaxed)
(grateful) (confident) (interested) (curious) (confused) (joyful)
```

**Advanced emotions:**
```
(disdainful) (anxious) (hysterical) (indifferent) (impatient)
(sarcastic) (sincere) (hesitating) (painful) (amused)
```

**Tone markers:**
```
(in a hurry tone) (shouting) (screaming) (whispering) (soft tone)
```

**Effects:**
```
(laughing) (chuckling) (sobbing) (crying loudly) (sighing) (panting)
```

Example:
```bash
# Via CLI flag
bun as -- tts input/sample.md --fish-audio --fish-emotion excited

# Or embed directly in text
echo "(whispering) This is a secret message." > input/secret.md
bun as -- tts input/secret.md --fish-audio
```

## Voice Cloning

Clone any voice from a short reference sample (10-30 seconds recommended):

```bash
bun as -- tts input/sample.md --fish-audio \
  --ref-audio path/to/voice-sample.wav \
  --ref-text "Transcript of the sample audio"
```

**Tips:**
- Use a clean audio clip without background noise
- 10-30 seconds provides best results
- Consistent speaker throughout the reference
- WAV format preferred to avoid resampling

## Supported Languages

English, Chinese, Japanese, German, French, Spanish, Korean, Arabic, Russian, Dutch, Italian, Polish, Portuguese

## Script Format

For multi-speaker scripts:

```json
[
  {
    "speaker": "NARRATOR",
    "text": "Welcome to today's episode."
  },
  {
    "speaker": "DUCO",
    "text": "I have exciting news!",
    "refAudio": "voices/duco-sample.wav",
    "emotion": "excited"
  }
]
```

## Environment Variables

```bash
# Model selection
FISHAUDIO_MODEL=s1-mini  # or s1

# API server URL
FISHAUDIO_API_URL=http://localhost:8080

# Checkpoint location (optional, auto-determined from model if not set)
FISHAUDIO_CHECKPOINT_PATH=build/checkpoints/openaudio-s1-mini

# Voice mappings for script processing
FISHAUDIO_VOICE_DUCO=path/to/duco.wav
FISHAUDIO_VOICE_SEAMUS=path/to/seamus.wav
FISHAUDIO_VOICE_NARRATOR=path/to/narrator.wav
```

## Config File

Add to `build/config/.tts-config.json`:

```json
{
  "fishaudio": {
    "default_model": "s1-mini",
    "default_language": "en",
    "api_url": "http://localhost:8080",
    "checkpoint_path": "build/checkpoints/openaudio-s1-mini",
    "use_api": true,
    "compile": true
  }
}
```

## Testing

```bash
bun test test/tts/tts-local.test.ts
```

Ensure the FishAudio API server is running and weights are available before running the test.

## Troubleshooting

- **Connection refused**: API server not running. Start it with Docker (see Server Setup)
- **401 Unauthorized / Gated repo**: Login to HuggingFace (`hf auth login`) and accept the model licenses:
  - s1-mini: https://huggingface.co/fishaudio/openaudio-s1-mini
  - s1: https://huggingface.co/fishaudio/openaudio-s1
- **Checkpoint not found**: Download weights after logging in to HuggingFace
- **CUDA out of memory**: Use `--fish-device cpu`, switch to s1-mini, or reduce text length
- **ModuleNotFoundError**: Run `bun setup:tts:fish` to install FishAudio dependencies
- **Invalid model**: Valid models are `s1-mini` and `s1`

## Performance Notes

1. **API Mode**: Fastest with server running and `COMPILE=1`
2. **CLI Mode**: Slower but works without server; ~10x speedup with `--compile` on CUDA
3. **GPU Memory**:
   - s1-mini: 12GB VRAM recommended
   - s1: 24GB VRAM recommended
   - CPU mode works but is significantly slower
4. **Model Downloads**:
   - s1-mini: ~2GB
   - s1: ~8GB
5. **Quality**: s1 (4B) provides better quality and stability than s1-mini (0.5B)
