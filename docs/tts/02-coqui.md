# Coqui TTS

## Commands

### Basic Usage
```bash
bun as -- tts file input/sample.md --coqui
bun as -- tts file input/sample.md --coqui --speaker "Ana Florence"
bun as -- tts file input/sample.md --coqui --speed 0.8
```

### Voice Cloning with XTTS
```bash
bun as -- tts file input/sample.md --coqui --coqui-model xtts --voice-clone voice.wav
bun as -- tts file input/sample.md --coqui --coqui-model xtts --voice-clone voice.wav --language es
bun as -- tts file input/sample.md --coqui --coqui-model xtts --speaker "Ana Florence"
```

### Script Processing
```bash
bun as -- tts script input/script.json --coqui
bun as -- tts script input/script.json --coqui --coqui-model xtts
```

### Model Selection
```bash
bun as -- tts file input/sample.md --coqui --coqui-model "tts_models/en/vctk/vits"
bun as -- tts file input/sample.md --coqui --coqui-model "tts_models/swl/fairseq/vits"
```

## Environment Variables
```env
COQUI_PYTHON_PATH=/path/to/python
COQUI_VOICE_DUCO=/path/to/duco_voice.wav
COQUI_VOICE_SEAMUS=/path/to/seamus_voice.wav
COQUI_SPEAKER_DUCO=Claribel Dervla
COQUI_SPEAKER_SEAMUS=Daisy Studious
```