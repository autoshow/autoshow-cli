# Kitten TTS 😻

Ultra-lightweight, CPU-optimized text-to-speech with just 15 million parameters - runs on any device without GPU.

## Features

- **Ultra-lightweight**: Model size less than 25MB
- **CPU-optimized**: No GPU required
- **Fast inference**: Real-time synthesis
- **Multiple voices**: 8 built-in expressive voices
- **Simple API**: Easy integration
- **Offline capable**: Works without internet
- **Auto-chunking**: Automatically handles long texts

## Setup

```bash
npm run setup
```

This will automatically install Kitten TTS via pip in the Python environment.

## Basic Usage

```bash
# Using default voice (expr-voice-2-f)
npm run as -- tts file input/sample.md --kitten

# Specify voice
npm run as -- tts file input/sample.md --kitten --voice expr-voice-3-m

# Adjust speech speed
npm run as -- tts file input/sample.md --kitten --speed 0.9

# Long texts are automatically chunked
npm run as -- tts file input/story.md --kitten
```

## Available Voices

Kitten TTS includes 8 expressive voices:

### Female Voices
- `expr-voice-2-f` - Warm, friendly (default)
- `expr-voice-3-f` - Professional, clear
- `expr-voice-4-f` - Energetic, upbeat
- `expr-voice-5-f` - Calm, soothing

### Male Voices
- `expr-voice-2-m` - Conversational
- `expr-voice-3-m` - Authoritative
- `expr-voice-4-m` - Friendly, casual
- `expr-voice-5-m` - Deep, narrative

## Script Processing

Process dialogue with different voices:

```bash
npm run as -- tts script input/script.json --kitten
```

Configure character voices via environment variables:
```env
# Character voice assignments
KITTEN_VOICE_DUCO=expr-voice-2-m
KITTEN_VOICE_SEAMUS=expr-voice-3-m
```

## Speed Control

```bash
# Slower speech (good for clarity)
npm run as -- tts file input/sample.md --kitten --speed 0.8

# Faster speech
npm run as -- tts file input/sample.md --kitten --speed 1.2
```

## Text Length Handling

Kitten TTS automatically handles long texts by:
- Splitting text into chunks of ~500 characters
- Processing each chunk separately
- Seamlessly combining the audio output
- Adding natural pauses between chunks

This means you can process entire books or long documents without manual splitting:

```bash
# Process a long story or book chapter
npm run as -- tts file input/long-story.md --kitten
```

## Model Selection

```bash
# Use specific model version
npm run as -- tts file input/sample.md --kitten --kitten-model "KittenML/kitten-tts-nano-0.1"
```

## Advantages

**Perfect for:**
- Edge devices and embedded systems
- Offline applications
- Low-resource environments
- Rapid prototyping
- Mobile applications
- Privacy-focused deployments
- Long-form content (automatic chunking)

**Key benefits:**
- No internet connection required
- Minimal resource usage
- Fast startup time
- Consistent quality
- No API costs
- Handles texts of any length

## Comparison with Other Engines

| Feature | Kitten | Coqui | ElevenLabs | Polly |
|---------|---------|--------|------------|--------|
| Model Size | 25MB | 100MB-2GB | Cloud | Cloud |
| GPU Required | No | Optional | No | No |
| Offline | Yes | Yes | No | No |
| Voice Cloning | No | Yes | Yes | No |
| Languages | English | 1100+ | 29 | 30+ |
| Cost | Free | Free | Paid | Paid |
| Speed | Fast | Medium | Fast | Fast |
| Max Text Length | Unlimited* | Unlimited | API limits | API limits |

*Automatically chunks long texts for processing

## Limitations

- English only (currently)
- No voice cloning
- Limited voice customization
- Fixed output sample rate (24kHz)

## Troubleshooting

### Installation Issues
```bash
# Manual installation if setup fails
pip install https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl
```

### Python Version
Kitten TTS requires Python 3.8 or higher.

### Audio Quality
For best quality, use:
- Clear, well-punctuated text
- Appropriate voice selection
- Speed adjustment for clarity

### Long Text Processing
If you encounter issues with very long texts:
- The system automatically chunks text at ~500 characters
- Each chunk is processed with natural sentence boundaries
- Brief pauses are added between chunks for natural flow

## Examples

### Simple narration
```bash
npm run as -- tts file story.md --kitten --voice expr-voice-5-m
```

### Long document processing
```bash
# Automatically handles chunking for long texts
npm run as -- tts file book-chapter.md --kitten
```

### Dialogue processing
```bash
npm run as -- tts script dialogue.json --kitten
```

### Batch processing
```bash
for file in input/*.md; do
  npm run as -- tts file "$file" --kitten
done
```