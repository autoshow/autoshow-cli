# CosyVoice TTS

CosyVoice3 (Fun-CosyVoice3-0.5B) is a state-of-the-art multilingual text-to-speech engine from FunAudioLLM. It supports 9 languages, 18+ Chinese dialects, zero-shot voice cloning, and instruction-based voice control.

## Requirements

- Python 3.10+ with the TTS virtual environment
- Docker (optional, for containerized deployment)
- First run will download models (~2-3GB)

## Setup

```bash
# Install CosyVoice TTS
bun setup:tts:cosyvoice
```

The setup script will:
1. Create the base TTS Python environment (if not already present)
2. Check for Docker and use containerized deployment if available
3. If Docker is not available, clone the CosyVoice repository to `build/cosyvoice`
4. Install required dependencies
5. Download the Fun-CosyVoice3-0.5B model (~2-3GB) from ModelScope or HuggingFace

## Quick Start

```bash
# Basic usage with default settings (instruct mode)
bun as -- tts file input/sample.md --cosyvoice

# Add voice instructions
bun as -- tts file input/sample.md --cosyvoice --cosy-instruct "Speak with enthusiasm and energy"

# Specify language
bun as -- tts file input/sample.md --cosyvoice --cosy-language ja

# Use Chinese dialect via instruction
bun as -- tts file input/sample.md --cosyvoice --cosy-instruct "Use Cantonese dialect"

# Voice cloning (zero-shot mode)
bun as -- tts file input/sample.md --cosyvoice --cosy-mode zero_shot --ref-audio voice.wav

# Process a script file
bun as -- tts script input/script.json --cosyvoice
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--cosyvoice` | Use CosyVoice3 TTS engine |
| `--cosy-mode <mode>` | Generation mode: instruct (default), zero_shot, cross_lingual |
| `--cosy-language <lang>` | Language: auto, zh, en, ja, ko, de, es, fr, it, ru |
| `--cosy-api-url <url>` | API server URL (default: http://localhost:50000) |
| `--cosy-instruct <text>` | Voice instruction for instruct mode |
| `--cosy-stream` | Enable streaming inference |
| `--ref-audio <path>` | Reference audio for voice cloning (zero_shot mode) |
| `--ref-text <text>` | Transcript of reference audio (optional) |

## Supported Languages

| Code | Language |
|------|----------|
| `auto` | Automatic detection (default) |
| `zh` | Chinese (Mandarin) |
| `en` | English |
| `ja` | Japanese |
| `ko` | Korean |
| `de` | German |
| `es` | Spanish |
| `fr` | French |
| `it` | Italian |
| `ru` | Russian |

## Generation Modes

### Instruct Mode (Default)

Uses instruction text to control voice characteristics. Does not require reference audio.

```bash
# Basic instruct mode
bun as -- tts file input/sample.md --cosyvoice

# With specific instructions
bun as -- tts file input/sample.md --cosyvoice --cosy-instruct "Speak slowly and clearly"

# Dialect control
bun as -- tts file input/sample.md --cosyvoice --cosy-instruct "Use Cantonese dialect"

# Speed control
bun as -- tts file input/sample.md --cosyvoice --cosy-instruct "Speak as fast as possible"

# Emotion control
bun as -- tts file input/sample.md --cosyvoice --cosy-instruct "Speak with excitement and joy"
```

### Zero-Shot Mode

Clones a voice from a reference audio sample. Requires `--ref-audio`.

```bash
# Basic voice cloning
bun as -- tts file input/sample.md --cosyvoice --cosy-mode zero_shot --ref-audio samples/voice.wav

# With transcript for better quality
bun as -- tts file input/sample.md --cosyvoice --cosy-mode zero_shot --ref-audio samples/voice.wav --ref-text "This is what the sample audio says"
```

**Tips for voice cloning:**
- Use 3-10 second audio clips
- Clear audio without background noise works best
- Providing `--ref-text` improves cloning accuracy

### Cross-Lingual Mode

Fine-grained control with breath markers and pronunciation inpainting. Requires `--ref-audio`.

```bash
bun as -- tts file input/sample.md --cosyvoice --cosy-mode cross_lingual --ref-audio samples/voice.wav
```

You can include control markers in your text:
- `[breath]` - Add a breath/pause
- Pinyin notation for Chinese pronunciation control
- CMU phonemes for English pronunciation control

## Script Format

For multi-speaker scripts, you can specify per-segment settings:

```json
[
  {
    "speaker": "NARRATOR",
    "text": "Welcome to today's episode.",
    "instruct": "Calm and welcoming tone"
  },
  {
    "speaker": "DUCO",
    "text": "I have exciting news!",
    "instruct": "Enthusiastic and energetic"
  },
  {
    "speaker": "SEAMUS",
    "text": "Tell me more...",
    "instruct": "Curious and intrigued"
  }
]
```

Segment-level fields (`instruct`, `mode`, `refAudio`) override CLI/environment defaults.

## Environment Variables

```bash
# API configuration
COSYVOICE_API_URL=http://localhost:50000

# Script voice mappings (instructions per speaker)
COSYVOICE_INSTRUCT_DUCO="Speak with energy and enthusiasm"
COSYVOICE_INSTRUCT_SEAMUS="Speak in a calm, thoughtful manner"
COSYVOICE_INSTRUCT_NARRATOR="Speak clearly and professionally"

# Reference audio per speaker (for zero-shot mode)
COSYVOICE_REF_DUCO=/path/to/duco-voice.wav
COSYVOICE_REF_SEAMUS=/path/to/seamus-voice.wav
```

## Setup Options

### Docker Mode (Recommended)

If Docker is available, the setup script will check for a CosyVoice container:

```bash
# Build or pull the CosyVoice Docker image
docker build -t cosyvoice:latest path/to/cosyvoice/runtime/python

# The setup script will auto-start the container
bun setup:tts:cosyvoice
```

### Local Mode

If Docker is not available, the setup script will:
1. Clone the CosyVoice repository to `build/cosyvoice`
2. Install dependencies in the shared TTS virtual environment
3. Download the Fun-CosyVoice3-0.5B model from ModelScope/HuggingFace

```bash
bun setup:tts:cosyvoice
```

## Performance Notes

1. **First Model Load**: Initial run downloads models (~2-3GB) and loads them into memory. Subsequent runs are faster.

2. **CPU Mode**: By default, CosyVoice runs on CPU. Generation takes 10-30 seconds per sentence depending on length.

3. **Long Text**: Text longer than 500 characters is automatically chunked. This may introduce slight pauses between segments.

4. **Memory Usage**: The 0.5B model requires ~2-4GB RAM during inference.

## Instruction Examples

CosyVoice3 supports various instruction types:

### Speed Control
- "Speak as fast as possible"
- "Speak slowly and clearly"
- "Use a moderate speaking pace"

### Emotion/Tone
- "Speak with enthusiasm and energy"
- "Use a calm and soothing voice"
- "Speak with excitement and joy"
- "Use a serious and professional tone"

### Dialect/Accent (Chinese)
- "Use Cantonese dialect" (Guangdong)
- "Use Sichuan dialect"
- "Use Beijing dialect"
- "Use Shanghai dialect"
- "Use Minnan dialect"

### Language Switching
- "Speak in Japanese"
- "Use English pronunciation"
- "Mix Chinese and English naturally"

## Troubleshooting

### "CosyVoice not installed"

Run the setup script:
```bash
bun setup:tts:cosyvoice
```

Or manually:
```bash
bash .github/setup/tts/cosyvoice.sh
```

### "Failed to clone CosyVoice repository"

Check your network connection. The repository includes large submodules:
```bash
cd build/cosyvoice
git submodule update --init --recursive
```

### "Model download failed"

Try downloading manually:
```python
from modelscope import snapshot_download
snapshot_download('FunAudioLLM/Fun-CosyVoice3-0.5B-2512', local_dir='build/cosyvoice/pretrained_models/Fun-CosyVoice3-0.5B')
```

Or from HuggingFace:
```python
from huggingface_hub import snapshot_download
snapshot_download('FunAudioLLM/Fun-CosyVoice3-0.5B-2512', local_dir='build/cosyvoice/pretrained_models/Fun-CosyVoice3-0.5B')
```

### "Zero-shot mode requires --ref-audio"

Zero-shot voice cloning requires a reference audio file:
```bash
bun as -- tts file input/sample.md --cosyvoice --cosy-mode zero_shot --ref-audio path/to/voice.wav
```

If you don't have reference audio, use instruct mode instead (the default).
