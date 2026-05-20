# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/output/tts-voices`
- Total providers: 27 (0 local, 27 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose separate fastest, cheapest, and highest-quality surfaces for each group.

## Method

- Fastest rankings use processing time when present.
- Cheapest local rankings use zero monetary cost and compare only local providers.
- Cheapest service rankings use reported monetary cost when present.
- Highest-quality rankings use only explicit quality evidence for the category.

## Local Providers

### Top 3 Fastest

Unavailable: No local providers were found.

### Top 3 Cheapest

Unavailable: No local providers were found.

### Top 3 Highest Quality

Unavailable: No local providers were found.

### Provider Detail

No local providers were found.

## Service Providers

### Top 3 Fastest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `cartesia/sonic-3.5#sonic-3.5-default` | 5.08s |
| 2 | `speechify/simba-english#english-george` | 5.81s |
| 3 | `hume/octave-2#Male-English-Actor` | 6.04s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `grok/grok-tts#ara` | $0.0021 |
| 2 | `grok/grok-tts#eve` | $0.0021 |
| 3 | `grok/grok-tts#leo` | $0.0021 |

### Top 3 Highest Quality

Unavailable: No roundtrip WER or explicit voice-quality metric was available for service providers. Duration, bitrate, and file size are not used as quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `cartesia/sonic-3.5#sonic-3.5-default` | n/a | 5.08s | $0.0190 |
| `cartesia/sonic-3#sonic-3-default` | n/a | 10.22s | $0.0190 |
| `deepgram/aura-2-andromeda-en#andromeda` | n/a | 15.02s | $0.0152 |
| `deepgram/aura-2-apollo-en#apollo` | n/a | 17.35s | $0.0152 |
| `deepgram/aura-2-arcas-en#arcas` | n/a | 17.44s | $0.0152 |
| `deepgram/aura-2-asteria-en#asteria` | n/a | 16.05s | $0.0152 |
| `deepgram/aura-2-thalia-en#thalia` | n/a | 16.95s | $0.0152 |
| `elevenlabs/eleven_v3#default` | n/a | 24.73s | $0.0508 |
| `gemini/gemini-3.1-flash-tts-preview#Kore` | n/a | 19.48s | $0.0107 |
| `gemini/gemini-3.1-flash-tts-preview#Puck` | n/a | 15.34s | $0.0107 |
| `grok/grok-tts#ara` | n/a | 7.66s | $0.0021 |
| `grok/grok-tts#eve` | n/a | 8.46s | $0.0021 |
| `grok/grok-tts#leo` | n/a | 9.13s | $0.0021 |
| `grok/grok-tts#rex` | n/a | 9.00s | $0.0021 |
| `grok/grok-tts#sal` | n/a | 9.04s | $0.0021 |
| `groq/canopylabs/orpheus-v1-english#english-austin` | n/a | 6.21s | $0.0163 |
| `groq/canopylabs/orpheus-v1-english#english-autumn` | n/a | 8.83s | $0.0163 |
| `groq/canopylabs/orpheus-v1-english#english-daniel` | n/a | 6.88s | $0.0163 |
| `groq/canopylabs/orpheus-v1-english#english-diana` | n/a | 9.32s | $0.0163 |
| `groq/canopylabs/orpheus-v1-english#english-hannah` | n/a | 6.92s | $0.0163 |
| `groq/canopylabs/orpheus-v1-english#english-troy` | n/a | 7.36s | $0.0163 |
| `hume/octave-2#Male-English-Actor` | n/a | 6.04s | $0.0762 |
| `minimax/speech-2.8-hd#hd-English_expressive_narrator` | n/a | 36.11s | $0.0508 |
| `minimax/speech-2.8-turbo#turbo-English_expressive_narrator` | n/a | 26.40s | $0.0305 |
| `openai/gpt-4o-mini-tts#alloy` | n/a | 9.20s | $0.0064 |
| `speechify/simba-english#english-george` | n/a | 5.81s | $0.0051 |
| `speechify/simba-multilingual#multilingual-george` | n/a | 7.37s | $0.0051 |

## Notes

- Best cloud service: `speechify/simba-english#english-george` scored 37.56/100.
- The cheapest cloud providers were `grok/grok-tts#ara`, `grok/grok-tts#eve`, `grok/grok-tts#rex`, `grok/grok-tts#sal`, and `grok/grok-tts#leo` at 0.2134¢ ($0.0021).
- Fastest cloud service: `cartesia/sonic-3.5#sonic-3.5-default` at 5.08s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
