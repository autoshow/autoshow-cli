# Text-to-Speech (TTS) Command

Generate speech from text using multiple TTS engines.

## Commands

### Single File
```bash
bun as -- tts file input/sample.md
bun as -- tts file input/sample.md --coqui --output output/coqui
bun as -- tts file input/sample.md --kitten --output output/kitten
bun as -- tts file input/sample.md --elevenlabs --output output/elevenlabs
bun as -- tts file input/sample.md --polly --output output/polly
bun as -- tts file input/sample.md --qwen3 --output output/qwen3
```

### Script Files
```bash
bun as -- tts script input/script.json
bun as -- tts script input/script.json --kitten
bun as -- tts script input/script.json --elevenlabs
bun as -- tts script input/script.json --coqui
bun as -- tts script input/script.json --polly
bun as -- tts script input/script.json --qwen3
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
- `--ref-audio <path>` - Reference audio for voice cloning (Qwen3)
- `--ref-text <text>` - Transcript of reference audio (Qwen3)
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