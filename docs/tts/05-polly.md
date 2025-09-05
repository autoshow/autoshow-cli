# AWS Polly TTS

## Commands

### Basic Usage
```bash
npm run as -- tts file input/sample.md --polly
npm run as -- tts file input/sample.md --polly --voice Amy
npm run as -- tts file input/sample.md --polly --polly-engine neural
npm run as -- tts file input/sample.md --polly --polly-engine standard
npm run as -- tts file input/sample.md --polly --polly-engine generative
npm run as -- tts file input/sample.md --polly --polly-engine long-form --voice Gregory
npm run as -- tts file input/sample.md --polly --polly-format ogg_vorbis
npm run as -- tts file input/sample.md --polly --polly-sample-rate 16000
```

### Script Processing
```bash
npm run as -- tts script input/script.json --polly
```

### Multi-lingual
```bash
npm run as -- tts file spanish.md --polly --voice Lupe --language es-US
npm run as -- tts file french.md --polly --voice Celine --language fr-FR
```

## Available Voices

**US English Neural**: Ivy, Joanna, Kendra, Kimberly, Salli, Joey, Justin, Kevin, Matthew, Ruth, Stephen, Danielle, Gregory

**GB English Neural**: Amy, Brian, Emma, Olivia, Arthur

## Environment Variables
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
POLLY_VOICE_DUCO=Matthew
POLLY_VOICE_SEAMUS=Brian
```