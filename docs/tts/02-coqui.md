# Coqui TTS

## Commands

### Basic Usage
```bash
npm run as -- tts file input/sample.md --coqui
npm run as -- tts file input/sample.md --coqui --speaker "Ana Florence"
npm run as -- tts file input/sample.md --coqui --speed 0.8
```

### Voice Cloning with XTTS
```bash
npm run as -- tts file input/sample.md --coqui --coqui-model xtts --voice-clone voice.wav
npm run as -- tts file input/sample.md --coqui --coqui-model xtts --voice-clone voice.wav --language es
npm run as -- tts file input/sample.md --coqui --coqui-model xtts --speaker "Ana Florence"
```

### Script Processing
```bash
npm run as -- tts script input/script.json --coqui
npm run as -- tts script input/script.json --coqui --coqui-model xtts
```

### Model Selection
```bash
npm run as -- tts file input/sample.md --coqui --coqui-model "tts_models/en/vctk/vits"
npm run as -- tts file input/sample.md --coqui --coqui-model "tts_models/swl/fairseq/vits"
```

### List Available Speakers
```bash
npm run as -- tts list
```

## Environment Variables
```env
COQUI_PYTHON_PATH=/path/to/python
COQUI_VOICE_DUCO=/path/to/duco_voice.wav
COQUI_VOICE_SEAMUS=/path/to/seamus_voice.wav
COQUI_SPEAKER_DUCO=Claribel Dervla
COQUI_SPEAKER_SEAMUS=Daisy Studious
```