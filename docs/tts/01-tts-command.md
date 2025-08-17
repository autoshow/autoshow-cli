# Text-to-Speech (TTS) Command

Generate natural-sounding speech from text using multiple TTS engines.

## Overview

The Audio & AI Studio Toolkit supports 4 different TTS engines, each with unique strengths:

| Engine | Speed | Quality | Voice Control | Special Features | Documentation |
|--------|-------|---------|---------------|------------------|---------------|
| **[Coqui](tts/coqui.md)** | Fast | Excellent | Voice cloning | 1100+ languages, XTTS v2 (default) | [→ Guide](tts/coqui.md) |
| **[Kitten](tts/kitten.md)** | Very Fast | Good | 8 voices | Ultra-lightweight (25MB), CPU-only | [→ Guide](tts/kitten.md) |
| **[ElevenLabs](tts/elevenlabs.md)** | Fast | Excellent | Voice cloning | Professional quality | [→ Guide](tts/elevenlabs.md) |
| **[AWS Polly](tts/polly.md)** | Fast | Very Good | 100+ voices | 30+ languages, neural voices | [→ Guide](tts/polly.md) |

### Output

Generated audio files are saved to the `output/` directory:
- Single files: `output/sample-tts.wav`
- Scripts: `output/script-title/segment-001.wav`

## Basic Usage

### Generate Single Speaker Speech

```bash
# Using default Coqui engine
npm run as -- tts file input/sample.md

# Using specific engines
npm run as -- tts file input/sample.md --coqui --output output/coqui
npm run as -- tts file input/sample.md --kitten --output output/kitten
npm run as -- tts file input/sample.md --elevenlabs --output output/elevenlabs
npm run as -- tts file input/sample.md --polly --output output/polly
```

### Process Script Files for Multi-Character Dialogue

Script files are JSON files that define multiple text segments with different speakers:

```json
{
  "title": "Sample Dialogue",
  "segments": [
    {
      "speaker": "narrator",
      "text": "Once upon a time..."
    },
    {
      "speaker": "character1",
      "text": "Hello there!"
    }
  ]
}
```

Example commands:

```bash
npm run as -- tts script input/script.json
npm run as -- tts script input/script.json --kitten
npm run as -- tts script input/script.json --elevenlabs
npm run as -- tts script input/script.json --coqui
npm run as -- tts script input/script.json --polly

# Using Coqui with voice cloning
npm run as -- tts script input/script.json --coqui --coqui-model xtts

# Using Kitten TTS (lightweight, CPU-only)
npm run as -- tts script input/script.json --kitten

# Using AWS Polly with multiple voices
npm run as -- tts script input/script.json --polly
```

### High-quality audiobook narration

```bash
# Using Coqui XTTS with voice cloning
npm run as -- tts file input/story.md --coqui --coqui-model xtts --voice-clone narrator.wav

# Using Kitten TTS for lightweight deployment
npm run as -- tts file input/story.md --kitten --voice expr-voice-5-m

# Using ElevenLabs for professional quality
npm run as -- tts file input/story.md --elevenlabs

# Using AWS Polly with neural voice
npm run as -- tts file input/story.md --polly --voice Matthew --polly-engine neural
```

### Voice cloning workflow

```bash
# Clone with Coqui XTTS
npm run as -- tts file script.md --coqui --coqui-model xtts --voice-clone speaker-sample.mp3

# Clone with ElevenLabs
npm run as -- tts script input/script.json --elevenlabs
```

### Multi-lingual content

```bash
# Generate Spanish speech with Coqui
npm run as -- tts file spanish.md --coqui --coqui-model xtts --language es

# Generate Spanish speech with AWS Polly
npm run as -- tts file spanish.md --polly --voice Lupe --language es-US
```

### Lightweight deployment

```bash
# Use Kitten TTS for edge devices or offline usage
npm run as -- tts file input/sample.md --kitten --voice expr-voice-2-f
```