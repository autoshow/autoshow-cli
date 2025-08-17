# ElevenLabs TTS

Professional-quality text-to-speech with voice cloning capabilities.

## Features
- Excellent voice quality
- Voice cloning support
- Multiple pre-made voices
- Emotional control
- Fast synthesis

## Setup

### Install dependency
```bash
npm install elevenlabs
```

### Configuration
Add to your `.env` file:
```env
ELEVENLABS_API_KEY=your_elevenlabs_key

# Optional: Voice IDs for script characters
VOICE_ID_DUCO=your_voice_id
VOICE_ID_SEAMUS=your_voice_id
```

## Basic Usage

```bash
# Use default voice
npm run as -- tts file input/sample.md --elevenlabs

# Specify voice ID
npm run as -- tts file input/sample.md --elevenlabs --voice voice_id_here
```

## Script Processing

Process dialogue with different voices:

```bash
npm run as -- tts script input/script.json --elevenlabs
```

The script will use voice IDs from environment variables:
- `VOICE_ID_DUCO` for DUCO character
- `VOICE_ID_SEAMUS` for SEAMUS character

## Voice Settings

Default voice settings (can be modified in code):
```javascript
{
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
}
```

## Available Voices

Popular pre-made voices:
- Rachel - Calm, conversational
- Domi - Confident, engaging
- Bella - Warm, friendly
- Antoni - Professional male
- Josh - Young adult male
- Adam - Deep, authoritative

## Voice Cloning

1. Upload voice samples to ElevenLabs dashboard
2. Get the generated voice ID
3. Use the voice ID in your commands

## Rate Limits

The integration includes automatic retry logic for rate limits:
- Initial retry after 1 second
- Second retry after 2 seconds
- Third retry after 4 seconds

## Error Handling

Common errors and solutions:

### API Key not set
```
Error: ELEVENLABS_API_KEY environment variable not set
```
Solution: Add your API key to `.env` file

### Rate limit exceeded
The integration will automatically retry with exponential backoff

### Invalid voice ID
```
Error: Voice not found
```
Solution: Verify voice ID in ElevenLabs dashboard

## Cost Optimization

- Use streaming for longer texts
- Cache generated audio when possible
- Monitor usage in ElevenLabs dashboard