# Coqui TTS

Advanced text-to-speech with support for 1100+ languages and voice cloning capabilities.

## Features

- Support for 1100+ languages
- Voice cloning with XTTS v2
- Multi-speaker synthesis
- Fast inference
- Both single and multi-speaker models
- Streaming support (< 200ms latency)

## Setup

```bash
npm run setup
```

## Basic Usage

```bash
# Using default English model
npm run as -- tts file input/sample.md --coqui

# Using XTTS v2 for voice cloning
npm run as -- tts file input/sample.md --coqui --coqui-model xtts --voice-clone voice.wav

# Multi-lingual with language specification
npm run as -- tts file input/spanish.md --coqui --coqui-model xtts --language es

# Using specific speaker
npm run as -- tts file input/sample.md --coqui --speaker "Ana Florence"
```

## List Speakers

List available built-in speakers for XTTS v2:

```bash
npm run as -- tts list
```

## Voice Cloning with XTTS v2

```bash
# Single reference voice
npm run as -- tts file input/sample.md --coqui --coqui-model xtts --voice-clone speaker.wav --language en

# For other languages
npm run as -- tts file input/french.md --coqui --coqui-model xtts --voice-clone speaker.wav --language fr

# Using built-in XTTS speakers
npm run as -- tts file input/sample.md --coqui --coqui-model xtts --speaker "Ana Florence" --language en
```

## Script Processing

```bash
# Process dialogue with different voices
npm run as -- tts script input/script.json --coqui

# With voice cloning for characters
npm run as -- tts script input/script.json --coqui --coqui-model xtts
```

## Environment Variables

```env
# Custom Python path
COQUI_PYTHON_PATH=/path/to/custom/python

# Voice samples for script characters (XTTS)
COQUI_VOICE_DUCO=/path/to/duco_voice.wav
COQUI_VOICE_SEAMUS=/path/to/seamus_voice.wav

# Pre-defined speakers for script characters
COQUI_SPEAKER_DUCO=Claribel Dervla
COQUI_SPEAKER_SEAMUS=Daisy Studious
```

## Speed Control

```bash
# Slower speech
npm run as -- tts file input/sample.md --coqui --speed 0.8

# Faster speech
npm run as -- tts file input/sample.md --coqui --speed 1.2
```

## Model Selection

```bash
# Use specific model by full name
npm run as -- tts file input/sample.md --coqui --coqui-model "tts_models/en/vctk/vits"

# Fairseq model for specific language (e.g., Swahili)
npm run as -- tts file input/swahili.md --coqui --coqui-model "tts_models/swl/fairseq/vits"
```

## Performance Tips

- XTTS v2 supports streaming for low latency
- Use CPU-optimized installation for better compatibility
- Batch processing improves efficiency
- GPU acceleration available if CUDA is installed
