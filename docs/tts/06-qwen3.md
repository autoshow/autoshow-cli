# Qwen3 TTS

Qwen3 TTS is a high-quality multilingual text-to-speech engine from Alibaba. It supports multiple languages, voice cloning, and natural language voice control through instructions.

## Requirements

- Python 3.11 with the TTS virtual environment
- GPU recommended (4GB+ VRAM for 1.7B model) but CPU mode works
- First run will download models from Hugging Face (~3-7GB depending on model)

## Setup

```bash
# Install Qwen3 TTS
bun setup:tts:qwen3
```

The setup script will:
1. Create the base TTS Python environment (if not already present)
2. Install qwen-tts from PyPI
3. Optionally install flash-attn for better performance if CUDA is available

## Quick Start

```bash
# Basic usage with default settings (Vivian voice)
bun as -- tts input/sample.md --qwen3

# Choose a different speaker
bun as -- tts input/sample.md --qwen3 --qwen3-speaker Ryan

# Add voice instructions
bun as -- tts input/sample.md --qwen3 --qwen3-instruct "Speak with enthusiasm and energy"

# Process a script file
bun as -- tts script input/script.json --qwen3
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--qwen3` | Use Qwen3 TTS engine |
| `--qwen3-model <model>` | Model variant (CustomVoice, VoiceDesign, Base) |
| `--qwen3-speaker <name>` | Speaker name (see Available Speakers) |
| `--qwen3-instruct <text>` | Natural language voice control |
| `--qwen3-mode <mode>` | Generation mode: custom, design, clone |
| `--qwen3-language <lang>` | Language for synthesis |
| `--qwen3-max-chunk <n>` | Max chunk size for long text (default: 500) |
| `--ref-audio <path>` | Reference audio for voice cloning |
| `--ref-text <text>` | Transcript of reference audio |
| `--speed <number>` | Speed adjustment 0.25-4.0 |

## Available Speakers

| Speaker | Voice Description | Native Language |
|---------|-------------------|-----------------|
| Vivian | Bright, slightly edgy young female voice | Chinese |
| Serena | Warm, gentle young female voice | Chinese |
| Uncle_Fu | Seasoned male voice with a low, mellow timbre | Chinese |
| Dylan | Youthful Beijing male voice with a clear, natural timbre | Chinese (Beijing Dialect) |
| Eric | Lively Chengdu male voice with a slightly husky brightness | Chinese (Sichuan Dialect) |
| Ryan | Dynamic male voice with strong rhythmic drive | English |
| Aiden | Sunny American male voice with a clear midrange | English |
| Ono_Anna | Playful Japanese female voice with a light, nimble timbre | Japanese |
| Sohee | Warm Korean female voice with rich emotion | Korean |

## Supported Languages

- Auto (automatic detection)
- Chinese
- English
- Japanese
- Korean
- German
- French
- Russian
- Portuguese
- Spanish
- Italian

## Generation Modes

### Custom Voice Mode (Default)

Uses pre-built voices with optional instruction control.

```bash
bun as -- tts input/sample.md --qwen3 --qwen3-speaker Vivian
bun as -- tts input/sample.md --qwen3 --qwen3-speaker Ryan --qwen3-instruct "Speak slowly and clearly"
```

### Voice Design Mode

Creates voices from natural language descriptions. Requires `--qwen3-instruct`.

```bash
bun as -- tts input/sample.md --qwen3 --qwen3-mode design --qwen3-instruct "Young cheerful female voice with a slight British accent"
```

Note: Voice design mode requires the `VoiceDesign` model variant.

### Voice Clone Mode

Clones a voice from a reference audio sample. Requires `--ref-audio`.

```bash
bun as -- tts input/sample.md --qwen3 --qwen3-mode clone --ref-audio path/to/sample.wav --ref-text "Transcript of the sample audio"
```

Note: Voice clone mode requires the `Base` model variant.

## Model Variants

| Model | Features | Size | Instruction Control |
|-------|----------|------|---------------------|
| Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice | Pre-built voices, streaming | ~3GB | Yes |
| Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign | Voice design from descriptions | ~3GB | Yes |
| Qwen/Qwen3-TTS-12Hz-1.7B-Base | Voice cloning | ~3GB | No |
| Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice | Pre-built voices, lightweight | ~1.2GB | No |
| Qwen/Qwen3-TTS-12Hz-0.6B-Base | Voice cloning, lightweight | ~1.2GB | No |

## Script Format

For multi-speaker scripts, you can specify per-segment voice settings:

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

Segment-level fields (`speaker`, `instruct`, `mode`) override CLI/environment defaults.

## Environment Variables

```bash
# Default settings
QWEN3_DEFAULT_MODEL=Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice
QWEN3_DEFAULT_SPEAKER=Vivian
QWEN3_DEFAULT_LANGUAGE=Auto

# Script voice mappings
QWEN3_VOICE_DUCO=Ryan
QWEN3_VOICE_SEAMUS=Aiden
QWEN3_VOICE_NARRATOR=Vivian
```

## Performance Notes

1. **First Model Load**: The first run downloads models from Hugging Face (~3-7GB). This can take several minutes.

2. **GPU Memory**: The 1.7B model requires ~4GB+ VRAM. CPU mode works but is significantly slower (minutes vs seconds per generation).

3. **Long Text**: Text longer than 500 characters is automatically chunked. Use `--qwen3-max-chunk` to adjust.

4. **Speed Adjustment**: The current speed adjustment changes pitch. For pitch-preserved speed changes, consider post-processing with audio tools.

## Examples

```bash
# Japanese voice
bun as -- tts input/sample.md --qwen3 --qwen3-speaker Ono_Anna --qwen3-language Japanese

# Korean voice with instructions
bun as -- tts input/sample.md --qwen3 --qwen3-speaker Sohee --qwen3-language Korean --qwen3-instruct "Warm and friendly"

# Voice design from description
bun as -- tts input/sample.md --qwen3 --qwen3-mode design --qwen3-model "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign" --qwen3-instruct "Elderly wise male voice with gravelly undertones"

# Voice cloning
bun as -- tts input/sample.md --qwen3 --qwen3-mode clone --qwen3-model "Qwen/Qwen3-TTS-12Hz-1.7B-Base" --ref-audio samples/my-voice.wav --ref-text "This is a sample of my voice"
```
