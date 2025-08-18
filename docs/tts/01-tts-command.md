# Text-to-Speech (TTS) Command

Generate speech from text using multiple TTS engines.

## Commands

### Single File
```bash
npm run as -- tts file input/sample.md
npm run as -- tts file input/sample.md --coqui --output output/coqui
npm run as -- tts file input/sample.md --kitten --output output/kitten
npm run as -- tts file input/sample.md --elevenlabs --output output/elevenlabs
npm run as -- tts file input/sample.md --polly --output output/polly
```

### Script Files
```bash
npm run as -- tts script input/script.json
npm run as -- tts script input/script.json --kitten
npm run as -- tts script input/script.json --elevenlabs
npm run as -- tts script input/script.json --coqui
npm run as -- tts script input/script.json --polly
```

### List Models
```bash
npm run as -- tts list
```

## Options

- `--coqui` - Use Coqui TTS engine (default)
- `--kitten` - Use Kitten TTS engine
- `--elevenlabs` - Use ElevenLabs engine
- `--polly` - Use AWS Polly engine
- `--output <dir>` - Output directory (default: output/)
- `--voice <name>` - Voice ID or name
- `--speaker <name>` - Speaker name (Coqui)
- `--voice-clone <path>` - Voice sample for cloning (Coqui XTTS)
- `--language <code>` - Language code
- `--speed <number>` - Speed 0.25-4.0 (Coqui/Kitten)
- `--coqui-model <model>` - Coqui model name
- `--kitten-model <model>` - Kitten model name
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