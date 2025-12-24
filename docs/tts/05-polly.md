# AWS Polly TTS

## Commands

### Basic Usage
```bash
bun as -- tts file input/sample.md --polly
bun as -- tts file input/sample.md --polly --voice Amy
bun as -- tts file input/sample.md --polly --polly-engine neural
bun as -- tts file input/sample.md --polly --polly-engine standard
bun as -- tts file input/sample.md --polly --polly-engine generative
bun as -- tts file input/sample.md --polly --polly-engine long-form --voice Gregory
bun as -- tts file input/sample.md --polly --polly-format ogg_vorbis
bun as -- tts file input/sample.md --polly --polly-sample-rate 16000
```

### Script Processing
```bash
bun as -- tts script input/script.json --polly
```

### Multi-lingual
```bash
bun as -- tts file spanish.md --polly --voice Lupe --language es-US
bun as -- tts file french.md --polly --voice Celine --language fr-FR
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