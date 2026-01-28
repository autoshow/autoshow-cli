# Text-to-Speech (TTS) Command

Generate speech from text using multiple TTS engines.

## Setup

### Install Default TTS Engines
```bash
# Installs Coqui and Kitten
bun setup:tts
```

### Install Individual TTS Engines
```bash
# Qwen3 - Multilingual TTS with voice cloning and instructions
bun setup:tts:qwen3

# Chatterbox - Zero-shot voice cloning with paralinguistic tags
bun setup:tts:chatterbox

# FishAudio - Natural speech with emotion control
bun setup:tts:fish

# CosyVoice - 9 languages, 18+ Chinese dialects, instruction-based control
bun setup:tts:cosyvoice
```

Each setup command automatically creates the base TTS environment if it doesn't exist.

## Commands

### Single File
```bash
bun as -- tts file input/sample.md
bun as -- tts file input/sample.md --coqui --output output/coqui
bun as -- tts file input/sample.md --kitten --output output/kitten
bun as -- tts file input/sample.md --elevenlabs --output output/elevenlabs
bun as -- tts file input/sample.md --polly --output output/polly
bun as -- tts file input/sample.md --qwen3 --output output/qwen3
bun as -- tts file input/sample.md --chatterbox --output output/chatterbox
bun as -- tts file input/sample.md --fish-audio --output output/fishaudio
bun as -- tts file input/sample.md --cosyvoice --output output/cosyvoice
```

### Script Files
```bash
bun as -- tts script input/script.json
bun as -- tts script input/script.json --kitten
bun as -- tts script input/script.json --elevenlabs
bun as -- tts script input/script.json --coqui
bun as -- tts script input/script.json --polly
bun as -- tts script input/script.json --qwen3
bun as -- tts script input/script.json --chatterbox
bun as -- tts script input/script.json --fish-audio
bun as -- tts script input/script.json --cosyvoice
```

### List Models
```bash
bun as -- tts list
```

## Options

- `--coqui` - Use Coqui TTS engine (default)
- `--kitten` - Use Kitten TTS engine
- `--elevenlabs` - Use ElevenLabs engine
- `--polly` - Use AWS Polly engine
- `--qwen3` - Use Qwen3 TTS engine
- `--chatterbox` - Use Chatterbox TTS engine
- `--fish-audio` - Use FishAudio TTS engine (S1-mini)
- `--cosyvoice` - Use CosyVoice TTS engine
- `--output <dir>` - Output directory (default: output/)
- `--voice <name>` - Voice ID or name
- `--speaker <name>` - Speaker name (Coqui)
- `--voice-clone <path>` - Voice sample for cloning (Coqui XTTS)
- `--language <code>` - Language code
- `--speed <number>` - Speed 0.25-4.0 (Coqui/Kitten/Qwen3)
- `--coqui-model <model>` - Coqui model name
- `--kitten-model <model>` - Kitten model name
- `--qwen3-model <model>` - Qwen3 model variant (CustomVoice, VoiceDesign, Base)
- `--qwen3-speaker <name>` - Qwen3 speaker (Vivian, Ryan, Aiden, etc.)
- `--qwen3-instruct <text>` - Natural language voice control
- `--qwen3-mode <mode>` - Generation mode (custom, design, clone)
- `--qwen3-language <lang>` - Language (Auto, Chinese, English, Japanese, Korean, etc.)
- `--ref-audio <path>` - Reference audio for voice cloning (Qwen3/Chatterbox/FishAudio)
- `--ref-text <text>` - Transcript of reference audio (Qwen3/FishAudio)
- `--chatterbox-model <model>` - Chatterbox model (turbo, standard, multilingual)
- `--chatterbox-language <lang>` - Language for multilingual model (en, fr, ja, zh, etc.)
- `--chatterbox-device <device>` - Device override (cpu, mps, cuda)
- `--chatterbox-exaggeration <n>` - Exaggeration 0.0-1.0 (standard model)
- `--chatterbox-cfg <n>` - CFG weight 0.0-1.0 (standard model)
- `--fish-language <lang>` - FishAudio language (en, zh, ja, de, fr, es, ko, etc.)
- `--fish-api-url <url>` - FishAudio API server URL (default: http://localhost:8080)
- `--fish-emotion <emotion>` - Emotion marker (excited, sad, whispering, etc.)
- `--fish-device <device>` - Device override (cpu, mps, cuda)
- `--cosyvoice-model <model>` - CosyVoice model (CosyVoice-300M, CosyVoice-300M-SFT, CosyVoice-300M-Instruct, CosyVoice-300M-25Hz, CosyVoice2-0.5B)
- `--cosyvoice-speaker <name>` - Speaker name for SFT/Instruct models
- `--cosyvoice-instruct <text>` - Natural language voice control for Instruct models
- `--cosyvoice-device <device>` - Device override (cpu, mps, cuda)
- `--polly-format <format>` - Output format (mp3, ogg_vorbis, pcm)
- `--polly-sample-rate <rate>` - Sample rate (8000, 16000, 22050, 24000)
- `--polly-engine <engine>` - Engine type (standard, neural, generative, long-form)

## Script Format
```json
{
  "title": "Sample",
  "segments": [
    {
      "speaker": "narrator",
      "text": "Text content here"
    }
  ]
}
```