# AWS Polly TTS

Professional text-to-speech service from AWS with support for multiple languages and neural voices.

## Features
- 100+ voices across 30+ languages
- Neural and standard voice engines
- SSML support for fine control
- Multiple output formats (MP3, OGG, PCM)
- Adjustable sample rates
- Real-time synthesis
- Cost-effective pricing

## Setup

### Install dependency
```bash
npm install @aws-sdk/client-polly
```

### Configuration
Add to your `.env` file:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Optional: Default voices for script characters
POLLY_VOICE_DUCO=Matthew
POLLY_VOICE_SEAMUS=Brian
```

## Basic Usage

```bash
# Use default voice (Joanna)
npm run as -- tts file input/sample.md --polly --output output/polly

# Specify voice
npm run as -- tts file input/sample.md --polly --voice Amy

# Use neural engine
npm run as -- tts file input/sample.md --polly --polly-engine neural

# Use standard engine
npm run as -- tts file input/sample.md --polly --polly-engine standard

# Use generative engine
npm run as -- tts file input/sample.md --polly --polly-engine generative

# Use long-form engine
npm run as -- tts file input/story.md --polly --polly-engine long-form --voice Gregory

# Different output format
npm run as -- tts file input/sample.md --polly --polly-format ogg_vorbis
```

## Available Voices

### English (US)
- **Neural voices**: Ivy, Joanna, Kendra, Kimberly, Salli, Joey, Justin, Kevin, Matthew, Ruth, Stephen, Danielle, Gregory
- **Standard voices**: Ivy, Joanna, Kendra, Kimberly, Salli, Joey, Justin, Matthew

### English (GB)
- **Neural voices**: Amy, Brian, Emma, Olivia, Arthur
- **Standard voices**: Amy, Brian, Emma

## Script Processing

```bash
npm run as -- tts script input/script.json --polly
```

Configure character voices via environment variables:
- `POLLY_VOICE_DUCO`
- `POLLY_VOICE_SEAMUS`

## Output Formats

```bash
# MP3 (default)
--polly-format mp3

# OGG Vorbis
--polly-format ogg_vorbis

# PCM (raw audio)
--polly-format pcm
```

## Sample Rates

```bash
# 8kHz (telephony)
--polly-sample-rate 8000

# 16kHz (wideband)
--polly-sample-rate 16000

# 22.05kHz (broadcast)
--polly-sample-rate 22050

# 24kHz (default, high quality)
--polly-sample-rate 24000
```

## Voice Engines

### Standard Engine
- Lower cost
- Good quality
- All voices supported

### Neural Engine
- Higher quality, more natural
- Limited voice selection
- Slightly higher cost

```bash
# Explicitly use neural engine
--polly-engine neural

# Use standard engine
--polly-engine standard
```

## Language Support

Specify language code for better pronunciation:
```bash
# Spanish with es-ES language code
npm run as -- tts file spanish.md --polly --voice Conchita --language es-ES

# French with fr-FR language code
npm run as -- tts file french.md --polly --voice Celine --language fr-FR
```

## Advanced Examples

### High-quality audiobook
```bash
npm run as -- tts file input/story.md --polly --voice Matthew --polly-engine neural --polly-sample-rate 24000
```

### Multi-lingual content
```bash
# English narration
npm run as -- tts file chapter1.md --polly --voice Joanna

# Spanish translation
npm run as -- tts file chapter1-es.md --polly --voice Lupe --language es-US
```

### Broadcast quality
```bash
npm run as -- tts file news.md --polly --voice Amy --polly-engine neural --polly-sample-rate 22050
```

## Cost Optimization Tips

- Use standard voices for drafts
- Neural voices for final production
- PCM format for further processing
- Lower sample rates for telephony applications

## Performance

- Fast synthesis (typically < 1 second)
- Low latency
- Reliable service with high availability
- Automatic retry on rate limits

## Comparison with Other Engines

**Advantages:**
- Wide language support
- Consistent quality
- Fast synthesis
- Reliable cloud service
- Neural voice option

**Limitations:**
- Requires AWS account
- Internet connection required
- Limited voice customization
- No voice cloning

Best suited for:
- Production applications
- Multi-lingual content
- Applications requiring consistent quality
- High-volume synthesis