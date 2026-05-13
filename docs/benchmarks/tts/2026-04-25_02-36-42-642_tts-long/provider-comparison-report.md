# TTS Provider Comparison Report

## Summary

- Input text: `tts-long.md` (612 characters, 119 words)
- Total providers: 15 (4 local, 11 cloud)
- Scoring method: composite (speaking rate naturalness + cost + speed)
- Score formula: `composite: 60% speaking-rate-naturalness + 20% cost + 20% speed`
- Overall metric: balanced-overall (50% accuracy, 25% processing speed, 25% cost efficiency)

## Method

- Each provider in `metadata.tts[]` was evaluated based on its audio output.
- Audio duration was measured via ffprobe to compute speaking rate (characters per second).
- Cost and processing time were extracted from `run.json` metadata.
- Providers are separated into local models and cloud services for independent comparison.
- Overall ranking combines all providers using roundtrip WER accuracy when present, neutral 50/100 accuracy when missing, normalized processing speed, and normalized cost efficiency.
- Tier breakdown assigns local and third-party providers independently using balanced overall group rank.
- No roundtrip STT transcriptions were available.
- Ranking uses a composite score: 60% speaking rate naturalness (120-180 c/s optimal for English), 20% cost efficiency, 20% processing speed.

## Overall Ranking

| Rank | Provider | Group | Group Rank | Group Tier | Overall / 100 | Accuracy | Speed | Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `kitten/kitten-tts-nano` | local | 1 | 1 | 72.87 | 50.00 | 91.49 | 100.00 |
| 2 | `kitten/kitten-tts-micro` | local | 2 | 2 | 71.20 | 50.00 | 84.78 | 100.00 |
| 3 | `kitten/kitten-tts-nano-0.8-int8` | local | 3 | 3 | 71.01 | 50.00 | 84.02 | 100.00 |
| 4 | `kitten/kitten-tts-mini` | local | 4 | 3 | 67.84 | 50.00 | 71.34 | 100.00 |
| 5 | `openai/gpt-4o-mini-tts` | cloud | 1 | 1 | 67.63 | 50.00 | 81.03 | 89.50 |
| 6 | `gemini/gemini-2.5-flash-preview-tts` | cloud | 2 | 1 | 64.44 | 50.00 | 58.19 | 99.58 |
| 7 | `groq/canopylabs/orpheus-v1-english` | cloud | 3 | 1 | 63.01 | 50.00 | 78.69 | 73.33 |
| 8 | `elevenlabs/eleven_turbo_v2_5` | cloud | 4 | 2 | 62.50 | 50.00 | 100.00 | 50.00 |
| 9 | `elevenlabs/eleven_flash_v2_5` | cloud | 5 | 2 | 62.08 | 50.00 | 98.31 | 50.00 |
| 10 | `deepgram/aura-2-thalia-en` | cloud | 6 | 2 | 55.88 | 50.00 | 48.52 | 75.00 |
| 11 | `gemini/gemini-3.1-flash-tts-preview` | cloud | 7 | 3 | 55.68 | 50.00 | 40.22 | 82.50 |
| 12 | `minimax/speech-2.8-turbo` | cloud | 8 | 3 | 53.50 | 50.00 | 64.01 | 50.00 |
| 13 | `gemini/gemini-2.5-pro-preview-tts` | cloud | 9 | 3 | 49.79 | 50.00 | 0.00 | 99.17 |
| 14 | `minimax/speech-2.8-hd` | cloud | 10 | 3 | 41.55 | 50.00 | 49.53 | 16.67 |
| 15 | `elevenlabs/eleven_v3` | cloud | 11 | 3 | 38.72 | 50.00 | 54.88 | 0.00 |

## Tier Breakdown

Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (4)

#### Tier 1 (group rank 1)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `kitten/kitten-tts-nano` | 72.87 | 50.00 | 91.49 | 100.00 |

#### Tier 2 (group rank 2)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2 | 2 | `kitten/kitten-tts-micro` | 71.20 | 50.00 | 84.78 | 100.00 |

#### Tier 3 (group ranks 3-4)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 3 | `kitten/kitten-tts-nano-0.8-int8` | 71.01 | 50.00 | 84.02 | 100.00 |
| 4 | 4 | `kitten/kitten-tts-mini` | 67.84 | 50.00 | 71.34 | 100.00 |


### Third-Party Group (11)

#### Tier 1 (group ranks 1-3)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 5 | `openai/gpt-4o-mini-tts` | 67.63 | 50.00 | 81.03 | 89.50 |
| 2 | 6 | `gemini/gemini-2.5-flash-preview-tts` | 64.44 | 50.00 | 58.19 | 99.58 |
| 3 | 7 | `groq/canopylabs/orpheus-v1-english` | 63.01 | 50.00 | 78.69 | 73.33 |

#### Tier 2 (group ranks 4-6)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 4 | 8 | `elevenlabs/eleven_turbo_v2_5` | 62.50 | 50.00 | 100.00 | 50.00 |
| 5 | 9 | `elevenlabs/eleven_flash_v2_5` | 62.08 | 50.00 | 98.31 | 50.00 |
| 6 | 10 | `deepgram/aura-2-thalia-en` | 55.88 | 50.00 | 48.52 | 75.00 |

#### Tier 3 (group ranks 7-11)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 7 | 11 | `gemini/gemini-3.1-flash-tts-preview` | 55.68 | 50.00 | 40.22 | 82.50 |
| 8 | 12 | `minimax/speech-2.8-turbo` | 53.50 | 50.00 | 64.01 | 50.00 |
| 9 | 13 | `gemini/gemini-2.5-pro-preview-tts` | 49.79 | 50.00 | 0.00 | 99.17 |
| 10 | 14 | `minimax/speech-2.8-hd` | 41.55 | 50.00 | 49.53 | 16.67 |
| 11 | 15 | `elevenlabs/eleven_v3` | 38.72 | 50.00 | 54.88 | 0.00 |



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

- Best overall provider: `kitten/kitten-tts-nano` scored 72.87/100 using balanced overall weighting.
- Worst overall provider: `elevenlabs/eleven_v3` scored 38.72/100 using balanced overall weighting.
- Best local model: `kitten/kitten-tts-nano` scored 38.64/100.
- Best cloud service: `openai/gpt-4o-mini-tts` scored 36.73/100.
- The cheapest cloud provider was `gemini/gemini-2.5-flash-preview-tts` at 0.0306¢ ($0.0003).
- Fastest local model: `kitten/kitten-tts-nano` at 4.09s.
- Fastest cloud service: `elevenlabs/eleven_turbo_v2_5` at 1.32s.
- No roundtrip STT data was available. Ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%).
