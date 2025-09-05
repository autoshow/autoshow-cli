# Kitten TTS

Ultra-lightweight text-to-speech engine.

## Commands

### Basic Usage
```bash
npm run as -- tts file input/sample.md --kitten
npm run as -- tts file input/sample.md --kitten --voice expr-voice-3-m
npm run as -- tts file input/sample.md --kitten --speed 0.9
```

### Script Processing
```bash
npm run as -- tts script input/script.json --kitten
```

### Model Selection
```bash
npm run as -- tts file input/sample.md --kitten --kitten-model "KittenML/kitten-tts-nano-0.1"
```

## Available Voices

**Female**: expr-voice-2-f (default), expr-voice-3-f, expr-voice-4-f, expr-voice-5-f

**Male**: expr-voice-2-m, expr-voice-3-m, expr-voice-4-m, expr-voice-5-m

## Environment Variables
```env
KITTEN_VOICE_DUCO=expr-voice-2-m
KITTEN_VOICE_SEAMUS=expr-voice-3-m
```