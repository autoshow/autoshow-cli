# TTS Provider Comparison Report

## Summary

- Input text: `tts-long.md` (612 characters, 119 words)
- Total providers: 15 (4 local, 11 cloud)
- Scoring method: composite (speaking rate naturalness + cost + speed)
- Score formula: `composite: 60% speaking-rate-naturalness + 20% cost + 20% speed`

## Method

- Each provider in `metadata.tts[]` was evaluated based on its audio output.
- Audio duration was measured via ffprobe to compute speaking rate (characters per second).
- Cost and processing time were extracted from `run.json` metadata.
- Providers are separated into local models and cloud services for independent comparison.
- No roundtrip STT transcriptions were available.
- Ranking uses a composite score: 60% speaking rate naturalness (120-180 c/s optimal for English), 20% cost efficiency, 20% processing speed.

## Ranking

### Local Models (4)

  - `kitten/kitten-tts-nano`
  - `kitten/kitten-tts-micro`
  - `kitten/kitten-tts-nano-0.8-int8`
  - `kitten/kitten-tts-mini`

| Rank | Provider | Score / 100 | Speaking Rate | Duration | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `kitten/kitten-tts-nano` | 38.64 | 16.0 c/s | 38.36s | 4.09s |
| 2 | `kitten/kitten-tts-micro` | 37.91 | 17.2 c/s | 35.51s | 6.27s |
| 3 | `kitten/kitten-tts-nano-0.8-int8` | 37.83 | 16.0 c/s | 38.16s | 6.52s |
| 4 | `kitten/kitten-tts-mini` | 36.45 | 18.9 c/s | 32.41s | 10.64s |
### Cloud Services (11)

  - `openai/gpt-4o-mini-tts`
  - `elevenlabs/eleven_turbo_v2_5`
  - `elevenlabs/eleven_flash_v2_5`
  - `groq/canopylabs/orpheus-v1-english`
  - `gemini/gemini-2.5-flash-preview-tts`
  - `deepgram/aura-2-thalia-en`
  - `minimax/speech-2.8-turbo`
  - `gemini/gemini-3.1-flash-tts-preview`
  - `gemini/gemini-2.5-pro-preview-tts`
  - `minimax/speech-2.8-hd`
  - `elevenlabs/eleven_v3`

| Rank | Provider | Score / 100 | Speaking Rate | Duration | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `openai/gpt-4o-mini-tts` | 36.73 | 14.1 c/s | 43.40s | 7.49s | 0.7711¢ ($0.0077) |
| 2 | `elevenlabs/eleven_turbo_v2_5` | 35.89 | 16.0 c/s | 38.27s | 1.32s | 3.6720¢ ($0.0367) |
| 3 | `elevenlabs/eleven_flash_v2_5` | 35.70 | 16.4 c/s | 37.34s | 1.87s | 3.6720¢ ($0.0367) |
| 4 | `groq/canopylabs/orpheus-v1-english` | 35.29 | 11.7 c/s | 52.40s | 8.25s | 1.9584¢ ($0.0196) |
| 5 | `gemini/gemini-2.5-flash-preview-tts` | 35.00 | 20.6 c/s | 29.77s | 14.92s | 0.0306¢ ($0.0003) |
| 6 | `deepgram/aura-2-thalia-en` | 32.14 | 15.6 c/s | 39.17s | 18.06s | 1.8360¢ ($0.0184) |
| 7 | `minimax/speech-2.8-turbo` | 31.99 | 15.7 c/s | 39.02s | 13.03s | 3.6720¢ ($0.0367) |
| 8 | `gemini/gemini-3.1-flash-tts-preview` | 31.79 | 13.4 c/s | 45.76s | 20.76s | 1.2852¢ ($0.0129) |
| 9 | `gemini/gemini-2.5-pro-preview-tts` | 28.66 | 11.1 c/s | 55.21s | 33.84s | 0.0612¢ ($0.0006) |
| 10 | `minimax/speech-2.8-hd` | 27.97 | 15.2 c/s | 40.36s | 17.73s | 6.1200¢ ($0.0612) |
| 11 | `elevenlabs/eleven_v3` | 27.32 | 15.2 c/s | 40.32s | 15.99s | 7.3440¢ ($0.0734) |

## Notes

- Best local model: `kitten/kitten-tts-nano` scored 38.64/100.
- Best cloud service: `openai/gpt-4o-mini-tts` scored 36.73/100.
- The cheapest cloud provider was `gemini/gemini-2.5-flash-preview-tts` at 0.0306¢ ($0.0003).
- Fastest local model: `kitten/kitten-tts-nano` at 4.09s.
- Fastest cloud service: `elevenlabs/eleven_turbo_v2_5` at 1.32s.
- No roundtrip STT data was available. Ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%).
