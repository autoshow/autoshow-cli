# ElevenLabs Music Options

Detailed options for ElevenLabs Eleven Music generation.

## API Requirements

```bash
ELEVENLABS_API_KEY=your_api_key
```

## Output Formats

### MP3 (Default)
- `mp3_44100_128` - Standard quality (default)
- `mp3_44100_192` - High quality (Creator tier+)
- `mp3_44100_96`, `mp3_44100_64`, `mp3_44100_32` - Lower bitrates

### PCM (Pro tier+)
- `pcm_44100` - CD quality
- `pcm_48000` - Studio quality
- `pcm_8000` to `pcm_32000` - Various sample rates

### Opus
- `opus_48000_128` - Efficient high quality
- `opus_48000_32` to `opus_48000_192` - Various bitrates

### Telephony
- `ulaw_8000` - u-law for Twilio
- `alaw_8000` - A-law

## Composition Plans

Create a structured composition plan before generating:

```bash
# Create plan
bun as -- music plan --prompt "A pop song about summer" --duration 2m -o plan.json

# Review and edit plan.json, then use with generate
```

### Example Plan Shape

```json
{
  "positive_global_styles": ["uplifting", "dance-pop"],
  "negative_global_styles": ["dark"],
  "sections": [
    {
      "section_name": "intro",
      "positive_local_styles": ["sparkly synths"],
      "negative_local_styles": [],
      "duration_ms": 15000,
      "lines": [""],
      "source_from": null
    }
  ]
}
```

## Prompting Best Practices

### Genre & Style
- Abstract moods: "eerie", "foreboding", "euphoric"
- Musical details: "dissonant violin screeches over pulsing sub-bass"

### Vocals
- Use "a cappella" for isolated vocals
- Specify vocal style: "breathy", "raw", "aggressive"
- For instrumental: add "instrumental only" or use `--instrumental`

### Musical Control
- Tempo: "130 BPM", "fast-paced"
- Key: "in A minor", "C major"
- Multiple vocalists: "two singers harmonizing in C"

### Timing
- "lyrics begin at 15 seconds"
- "instrumental only after 1:45"

## Example Prompts

```bash
# Video game music
bun as -- music generate --prompt "Intense electronic track for video game, driving synth arpeggios, punchy drums, 130-150 BPM" --duration 1m

# Commercial jingle
bun as -- music generate --prompt "Upbeat, polished track for mascara commercial with voiceover" --duration 30s

# Live performance feel
bun as -- music generate --prompt "Raw indie rock with female vocals, emotionally spontaneous performance, fusing R&B and folk"
```

## Limitations

- Duration: 3 seconds to 5 minutes
- No direct stem generation (use targeted prompts instead)
- Commercial use cleared on most plans (see ElevenLabs music terms)

## Notes

- `--timestamps` routes through the detailed endpoint and may increase latency/response size.
- C2PA signing support may be limited to certain output formats (mp3).
