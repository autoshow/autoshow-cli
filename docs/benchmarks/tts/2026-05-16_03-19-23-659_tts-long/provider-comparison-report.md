# TTS Provider Comparison Report

## Summary

- Input text: `input.txt` (286 characters, 60 words)
- Total providers: 29 (4 local, 25 cloud)
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
- Existing local/cloud ranking uses a composite score: 60% speaking rate naturalness (120-180 c/s optimal for English), 20% cost efficiency, 20% processing speed.
- Overall ranking uses neutral 50/100 accuracy components when roundtrip WER is missing.

## Overall Ranking

| Rank | Provider | Group | Group Rank | Group Tier | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gcloud/standard` | cloud | 1 | 1 | 74.47 | 50.00 | 99.80 | 98.09 |
| 2 | `gcloud/wavenet` | cloud | 2 | 1 | 74.46 | 50.00 | 99.73 | 98.09 |
| 3 | `grok/grok-tts` | cloud | 3 | 1 | 73.21 | 50.00 | 94.86 | 98.00 |
| 4 | `gcloud/neural2` | cloud | 4 | 1 | 73.09 | 50.00 | 100.00 | 92.37 |
| 5 | `kitten/kitten-tts-nano` | local | 1 | 1 | 72.96 | 50.00 | 91.85 | 100.00 |
| 6 | `deapi/Kokoro` | cloud | 5 | 1 | 72.55 | 50.00 | 90.57 | 99.63 |
| 7 | `kitten/kitten-tts-micro` | local | 2 | 2 | 72.52 | 50.00 | 90.09 | 100.00 |
| 8 | `kitten/kitten-tts-nano-0.8-int8` | local | 3 | 3 | 72.51 | 50.00 | 90.05 | 100.00 |
| 9 | `openai/gpt-4o-mini-tts` | cloud | 6 | 1 | 72.25 | 50.00 | 95.01 | 93.99 |
| 10 | `kitten/kitten-tts-mini` | local | 4 | 3 | 72.12 | 50.00 | 88.47 | 100.00 |
| 11 | `gemini/gemini-2.5-flash-preview-tts` | cloud | 7 | 1 | 71.44 | 50.00 | 86.02 | 99.76 |
| 12 | `gcloud/chirp3-hd` | cloud | 8 | 1 | 70.78 | 50.00 | 97.43 | 85.70 |
| 13 | `groq/canopylabs/orpheus-v1-english` | cloud | 9 | 2 | 70.09 | 50.00 | 95.60 | 84.75 |
| 14 | `gemini/gemini-2.5-pro-preview-tts` | cloud | 10 | 2 | 69.60 | 50.00 | 78.87 | 99.52 |
| 15 | `deepgram/aura-2-thalia-en` | cloud | 11 | 2 | 68.99 | 50.00 | 90.25 | 85.70 |
| 16 | `elevenlabs/eleven_turbo_v2_5` | cloud | 12 | 2 | 68.91 | 50.00 | 99.47 | 76.17 |
| 17 | `elevenlabs/eleven_flash_v2_5` | cloud | 13 | 2 | 68.91 | 50.00 | 99.47 | 76.17 |
| 18 | `gemini/gemini-3.1-flash-tts-preview` | cloud | 14 | 2 | 68.78 | 50.00 | 85.14 | 89.99 |
| 19 | `minimax/speech-02-turbo` | cloud | 15 | 2 | 65.68 | 50.00 | 91.31 | 71.40 |
| 20 | `minimax/speech-2.6-turbo` | cloud | 16 | 2 | 64.48 | 50.00 | 86.51 | 71.40 |
| 21 | `deapi/Chatterbox` | cloud | 17 | 3 | 61.66 | 50.00 | 47.00 | 99.63 |
| 22 | `minimax/speech-02-hd` | cloud | 18 | 3 | 60.78 | 50.00 | 90.80 | 52.33 |
| 23 | `minimax/speech-2.6-hd` | cloud | 19 | 3 | 59.86 | 50.00 | 87.11 | 52.33 |
| 24 | `elevenlabs/eleven_v3` | cloud | 20 | 3 | 59.69 | 50.00 | 86.41 | 52.33 |
| 25 | `deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice` | cloud | 21 | 3 | 58.50 | 50.00 | 34.37 | 99.63 |
| 26 | `minimax/speech-2.8-hd` | cloud | 22 | 3 | 55.84 | 50.00 | 71.04 | 52.33 |
| 27 | `gcloud/studio` | cloud | 23 | 3 | 55.57 | 50.00 | 98.56 | 23.73 |
| 28 | `runway/eleven_multilingual_v2` | cloud | 24 | 3 | 46.80 | 50.00 | 87.20 | 0.00 |
| 29 | `minimax/speech-2.8-turbo` | cloud | 25 | 3 | 42.85 | 50.00 | 0.00 | 71.40 |

## Tier Breakdown

Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (4)

#### Tier 1 (group rank 1)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 5 | `kitten/kitten-tts-nano` | 72.96 | 50.00 | 91.85 | 100.00 |

#### Tier 2 (group rank 2)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2 | 7 | `kitten/kitten-tts-micro` | 72.52 | 50.00 | 90.09 | 100.00 |

#### Tier 3 (group ranks 3-4)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 8 | `kitten/kitten-tts-nano-0.8-int8` | 72.51 | 50.00 | 90.05 | 100.00 |
| 4 | 10 | `kitten/kitten-tts-mini` | 72.12 | 50.00 | 88.47 | 100.00 |


### Third-Party Group (25)

#### Tier 1 (group ranks 1-8)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `gcloud/standard` | 74.47 | 50.00 | 99.80 | 98.09 |
| 2 | 2 | `gcloud/wavenet` | 74.46 | 50.00 | 99.73 | 98.09 |
| 3 | 3 | `grok/grok-tts` | 73.21 | 50.00 | 94.86 | 98.00 |
| 4 | 4 | `gcloud/neural2` | 73.09 | 50.00 | 100.00 | 92.37 |
| 5 | 6 | `deapi/Kokoro` | 72.55 | 50.00 | 90.57 | 99.63 |
| 6 | 9 | `openai/gpt-4o-mini-tts` | 72.25 | 50.00 | 95.01 | 93.99 |
| 7 | 11 | `gemini/gemini-2.5-flash-preview-tts` | 71.44 | 50.00 | 86.02 | 99.76 |
| 8 | 12 | `gcloud/chirp3-hd` | 70.78 | 50.00 | 97.43 | 85.70 |

#### Tier 2 (group ranks 9-16)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 13 | `groq/canopylabs/orpheus-v1-english` | 70.09 | 50.00 | 95.60 | 84.75 |
| 10 | 14 | `gemini/gemini-2.5-pro-preview-tts` | 69.60 | 50.00 | 78.87 | 99.52 |
| 11 | 15 | `deepgram/aura-2-thalia-en` | 68.99 | 50.00 | 90.25 | 85.70 |
| 12 | 16 | `elevenlabs/eleven_turbo_v2_5` | 68.91 | 50.00 | 99.47 | 76.17 |
| 13 | 17 | `elevenlabs/eleven_flash_v2_5` | 68.91 | 50.00 | 99.47 | 76.17 |
| 14 | 18 | `gemini/gemini-3.1-flash-tts-preview` | 68.78 | 50.00 | 85.14 | 89.99 |
| 15 | 19 | `minimax/speech-02-turbo` | 65.68 | 50.00 | 91.31 | 71.40 |
| 16 | 20 | `minimax/speech-2.6-turbo` | 64.48 | 50.00 | 86.51 | 71.40 |

#### Tier 3 (group ranks 17-25)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 17 | 21 | `deapi/Chatterbox` | 61.66 | 50.00 | 47.00 | 99.63 |
| 18 | 22 | `minimax/speech-02-hd` | 60.78 | 50.00 | 90.80 | 52.33 |
| 19 | 23 | `minimax/speech-2.6-hd` | 59.86 | 50.00 | 87.11 | 52.33 |
| 20 | 24 | `elevenlabs/eleven_v3` | 59.69 | 50.00 | 86.41 | 52.33 |
| 21 | 25 | `deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice` | 58.50 | 50.00 | 34.37 | 99.63 |
| 22 | 26 | `minimax/speech-2.8-hd` | 55.84 | 50.00 | 71.04 | 52.33 |
| 23 | 27 | `gcloud/studio` | 55.57 | 50.00 | 98.56 | 23.73 |
| 24 | 28 | `runway/eleven_multilingual_v2` | 46.80 | 50.00 | 87.20 | 0.00 |
| 25 | 29 | `minimax/speech-2.8-turbo` | 42.85 | 50.00 | 0.00 | 71.40 |



## Ranking

### Local Models (4)

  - `kitten/kitten-tts-nano`
  - `kitten/kitten-tts-micro`
  - `kitten/kitten-tts-nano-0.8-int8`
  - `kitten/kitten-tts-mini`

| Rank | Provider | Score / 100 | Speaking Rate | Duration | Processing Time |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `kitten/kitten-tts-nano` | 37.61 | 15.3 c/s | 18.67s | 7.18s |
| 2 | `kitten/kitten-tts-micro` | 37.13 | 15.9 c/s | 17.94s | 8.62s |
| 3 | `kitten/kitten-tts-nano-0.8-int8` | 37.12 | 15.2 c/s | 18.79s | 8.65s |
| 4 | `kitten/kitten-tts-mini` | 36.69 | 18.6 c/s | 15.39s | 9.94s |
### Cloud Services (25)

  - `gcloud/standard`
  - `gcloud/wavenet`
  - `gcloud/neural2`
  - `grok/grok-tts`
  - `gcloud/chirp3-hd`
  - `elevenlabs/eleven_turbo_v2_5`
  - `elevenlabs/eleven_flash_v2_5`
  - `openai/gpt-4o-mini-tts`
  - `groq/canopylabs/orpheus-v1-english`
  - `deapi/Kokoro`
  - `deepgram/aura-2-thalia-en`
  - `gemini/gemini-2.5-flash-preview-tts`
  - `minimax/speech-02-turbo`
  - `gemini/gemini-3.1-flash-tts-preview`
  - `gcloud/studio`
  - `minimax/speech-02-hd`
  - `minimax/speech-2.6-turbo`
  - `gemini/gemini-2.5-pro-preview-tts`
  - `minimax/speech-2.6-hd`
  - `elevenlabs/eleven_v3`
  - `runway/eleven_multilingual_v2`
  - `minimax/speech-2.8-hd`
  - `deapi/Chatterbox`
  - `deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice`
  - `minimax/speech-2.8-turbo`

| Rank | Provider | Score / 100 | Speaking Rate | Duration | Processing Time | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `gcloud/standard` | 39.66 | 18.2 c/s | 15.68s | 0.67s | 0.1144¢ ($0.0011) |
| 2 | `gcloud/wavenet` | 39.64 | 17.4 c/s | 16.47s | 0.73s | 0.1144¢ ($0.0011) |
| 3 | `gcloud/neural2` | 39.37 | 18.2 c/s | 15.68s | 0.51s | 0.4576¢ ($0.0046) |
| 4 | `grok/grok-tts` | 38.31 | 15.8 c/s | 18.05s | 4.71s | 0.1201¢ ($0.0012) |
| 5 | `gcloud/chirp3-hd` | 38.27 | 16.2 c/s | 17.68s | 2.61s | 0.8580¢ ($0.0086) |
| 6 | `elevenlabs/eleven_turbo_v2_5` | 38.25 | 16.6 c/s | 17.28s | 0.94s | 1.4300¢ ($0.0143) |
| 7 | `elevenlabs/eleven_flash_v2_5` | 38.25 | 16.2 c/s | 17.65s | 0.95s | 1.4300¢ ($0.0143) |
| 8 | `openai/gpt-4o-mini-tts` | 38.11 | 14.6 c/s | 19.65s | 4.59s | 0.3604¢ ($0.0036) |
| 9 | `groq/canopylabs/orpheus-v1-english` | 37.72 | 11.3 c/s | 25.36s | 4.11s | 0.9152¢ ($0.0092) |
| 10 | `deapi/Kokoro` | 37.24 | 16.8 c/s | 17.02s | 8.23s | 0.0220¢ ($0.0002) |
| 11 | `deepgram/aura-2-thalia-en` | 36.31 | 15.7 c/s | 18.22s | 8.48s | 0.8580¢ ($0.0086) |
| 12 | `gemini/gemini-2.5-flash-preview-tts` | 36.00 | 14.1 c/s | 20.25s | 11.95s | 0.0143¢ ($0.0001) |
| 13 | `minimax/speech-02-turbo` | 35.74 | 16.2 c/s | 17.60s | 7.62s | 1.7160¢ ($0.0172) |
| 14 | `gemini/gemini-3.1-flash-tts-preview` | 35.18 | 12.5 c/s | 22.92s | 12.67s | 0.6006¢ ($0.0060) |
| 15 | `gcloud/studio` | 34.86 | 17.8 c/s | 16.02s | 1.69s | 4.5760¢ ($0.0458) |
| 16 | `minimax/speech-02-hd` | 34.46 | 13.8 c/s | 20.66s | 8.03s | 2.8600¢ ($0.0286) |
| 17 | `minimax/speech-2.6-turbo` | 34.44 | 16.0 c/s | 17.93s | 11.54s | 1.7160¢ ($0.0172) |
| 18 | `gemini/gemini-2.5-pro-preview-tts` | 34.04 | 11.3 c/s | 25.33s | 17.80s | 0.0286¢ ($0.0003) |
| 19 | `minimax/speech-2.6-hd` | 33.45 | 16.0 c/s | 17.93s | 11.06s | 2.8600¢ ($0.0286) |
| 20 | `elevenlabs/eleven_v3` | 33.27 | 15.1 c/s | 18.88s | 11.63s | 2.8600¢ ($0.0286) |
| 21 | `runway/eleven_multilingual_v2` | 30.34 | 14.7 c/s | 19.43s | 10.98s | 6.0000¢ ($0.0600) |
| 22 | `minimax/speech-2.8-hd` | 29.07 | 15.6 c/s | 18.32s | 24.20s | 2.8600¢ ($0.0286) |
| 23 | `deapi/Chatterbox` | 25.36 | 23.9 c/s | 11.96s | 43.87s | 0.0220¢ ($0.0002) |
| 24 | `deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice` | 21.91 | 10.0 c/s | 28.48s | 54.20s | 0.0220¢ ($0.0002) |
| 25 | `minimax/speech-2.8-turbo` | 18.28 | 16.6 c/s | 17.24s | 82.31s | 1.7160¢ ($0.0172) |

## Notes

- Best overall provider: `gcloud/standard` scored 74.47/100 using balanced overall weighting.
- Worst overall provider: `minimax/speech-2.8-turbo` scored 42.85/100 using balanced overall weighting.
- Best local model: `kitten/kitten-tts-nano` scored 37.61/100.
- Best cloud service: `gcloud/standard` scored 39.66/100.
- The cheapest cloud provider was `gemini/gemini-2.5-flash-preview-tts` at 0.0143¢ ($0.0001).
- Fastest local model: `kitten/kitten-tts-nano` at 7.18s.
- Fastest cloud service: `gcloud/neural2` at 0.51s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
