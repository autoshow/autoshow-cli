# Chatterbox TTS

Chatterbox is a family of open-source text-to-speech models by Resemble AI. It supports zero-shot voice cloning and paralinguistic tags for natural-sounding English speech.

## Requirements

- Python 3.11 with the TTS virtual environment
- GPU recommended (CUDA or Apple Silicon MPS) but CPU mode works
- First run will download models from Hugging Face (~350MB-500MB depending on model)

## Setup

```bash
# Install Chatterbox TTS only
bun setup:tts:chatterbox
```

The setup script will:
1. Create the base TTS Python environment (if not already present)
2. Install chatterbox-tts from PyPI
3. Optionally install flash-attn for better performance if CUDA is available

## Quick Start

```bash
# Basic usage with Turbo model (default, fastest)
bun as -- tts file input/sample.md --chatterbox

# Use the standard model with creative controls
bun as -- tts file input/sample.md --chatterbox --chatterbox-model standard

# Voice cloning with a reference audio
bun as -- tts file input/sample.md --chatterbox --ref-audio path/to/voice-sample.wav

# Process a script file
bun as -- tts script input/script.json --chatterbox
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--chatterbox` | Use Chatterbox TTS engine |
| `--chatterbox-model <model>` | Model variant: turbo, standard (default: turbo) |
| `--chatterbox-device <device>` | Device override: cpu, mps, cuda |
| `--chatterbox-dtype <dtype>` | Dtype override: float32, float16, bfloat16 |
| `--chatterbox-exaggeration <n>` | Exaggeration level 0.0-1.0 (standard model only) |
| `--chatterbox-cfg <n>` | CFG weight 0.0-1.0 (standard model only) |
| `--ref-audio <path>` | Reference audio for voice cloning (10s recommended, WAV/PCM preferred) |
| `--output <dir>` | Output directory |

## Model Variants

| Model | Size | Languages | Key Features | Best For |
|-------|------|-----------|--------------|----------|
| **Turbo** (default) | 350M | English | Paralinguistic tags, lowest latency | Voice agents, production |
| Standard | 500M | English | CFG & exaggeration tuning | Creative controls |

**Note**: The multilingual model has been removed due to compatibility issues with non-CUDA devices. For multilingual TTS, use Qwen3 TTS (`--qwen3`) which supports 10+ languages including French, Spanish, German, Japanese, Korean, and more.

## Voice Cloning

All Chatterbox models support zero-shot voice cloning from a reference audio sample.

```bash
# Clone a voice (10-second reference clip recommended)
bun as -- tts file input/sample.md --chatterbox --ref-audio path/to/sample.wav
```

**Tips for best cloning results:**
- Use a clean 10-second audio clip
- Avoid background noise or music
- Consistent speaker throughout the reference
- Use WAV/PCM if possible to reduce resampling artifacts

## Paralinguistic Tags (Turbo Model)

The Turbo model supports embedded paralinguistic tags for natural speech:

```bash
# Embed tags directly in your text
echo "Hi there [chuckle], have you got a minute?" > input/tagged.md
bun as -- tts file input/tagged.md --chatterbox
```

Supported tags: `[laugh]`, `[chuckle]`, `[cough]`, and more.

## Creative Controls (Standard Model)

The standard model offers fine-grained control over speech characteristics:

```bash
# Higher exaggeration = more expressive, faster speech
bun as -- tts file input/sample.md --chatterbox --chatterbox-model standard --chatterbox-exaggeration 0.7

# Lower CFG weight = slower, more deliberate pacing
bun as -- tts file input/sample.md --chatterbox --chatterbox-model standard --chatterbox-cfg 0.3

# Combine for dramatic speech
bun as -- tts file input/sample.md --chatterbox --chatterbox-model standard --chatterbox-exaggeration 0.7 --chatterbox-cfg 0.3
```

**Tuning Guidelines:**
- Default values (`exaggeration=0.5`, `cfg_weight=0.5`) work well for most cases
- Fast reference speakers: lower `cfg_weight` (~0.3) improves pacing
- Expressive/dramatic speech: increase `exaggeration` to 0.7+, decrease `cfg_weight`

## Script Format

For multi-speaker scripts, you can specify per-segment voice references:

```json
[
  {
    "speaker": "NARRATOR",
    "text": "Welcome to today's episode."
  },
  {
    "speaker": "DUCO",
    "text": "I have exciting news!",
    "refAudio": "voices/duco-sample.wav"
  },
  {
    "speaker": "SEAMUS",
    "text": "Tell me more..."
  }
]
```

## Environment Variables

```bash
# Voice references for script processing
CHATTERBOX_VOICE_DUCO=path/to/duco-voice.wav
CHATTERBOX_VOICE_SEAMUS=path/to/seamus-voice.wav
CHATTERBOX_VOICE_NARRATOR=path/to/narrator-voice.wav
```

## Performance Notes

1. **Device Priority**: CUDA > MPS (Apple Silicon) > CPU
2. **Model Download**: First run downloads from Hugging Face (Turbo ~350MB, Standard/Multilingual ~500MB)
3. **GPU Memory**: Models require 2-4GB VRAM. CPU mode works but is slower.
4. **Apple Silicon**: Full MPS support for M1/M2/M3 Macs

## Troubleshooting

- **MPS failure on model load**: try `--chatterbox` with `--chatterbox-device cpu` or set a device override in config
- **ModuleNotFoundError**: run `bun setup:tts:chatterbox` to install Chatterbox TTS
- **First run stalls**: model download may take several minutes; check Hugging Face cache location

## Watermarking

All Chatterbox-generated audio includes Resemble AI's Perth watermark for responsible AI use. The watermark is imperceptible and survives compression/editing.

## Examples

```bash
# English with Turbo (fastest)
bun as -- tts file input/sample.md --chatterbox

# Expressive narration
bun as -- tts file input/story.md --chatterbox --chatterbox-model standard --chatterbox-exaggeration 0.8 --chatterbox-cfg 0.3

# Voice cloning for podcast
bun as -- tts file input/script.md --chatterbox --ref-audio voices/host.wav

# Multi-speaker conversation
bun as -- tts script input/conversation.json --chatterbox

# For multilingual TTS, use Qwen3 instead:
bun as -- tts file input/japanese.md --qwen3 --qwen3-language Japanese --qwen3-speaker Ono_Anna
```
