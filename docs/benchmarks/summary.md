# Benchmark Rankings Summary

Static cross-run ranking report built from the current `provider-comparison-report.json` and `reference-comparison-report.json` files under `docs/benchmarks`. Deleted tracked runs and `project/reports/results` are not included.

Costs are lower-is-better and converted from cents to USD. Speeds are lower-is-better and converted from milliseconds to seconds. Auto-quality and human quality are higher-is-better. Averages use only observed rows for the exact `providerKey`; coverage shows observed category runs.

## Source Inventory

| Category | Reports | Provider rows | Groups present |
| --- | ---: | ---: | --- |
| image | 2 | 19 | service |
| music | 4 | 20 | service |
| ocr | 6 | 123 | local, thirdPartyService |
| stt | 3 | 90 | local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization |
| tts | 1 | 19 | local, service |
| url | 2 | 9 | local, service |
| video | 2 | 17 | service |
| **Total** | **20** | **297** | **7 categories** |

## Method

- Cost rankings use report `price.value` values; speed rankings use report `speed.value` values.
- Auto-quality uses `rankingSurfaces.*.automatedQuality`, except OCR and STT where it uses `metricRankings.*.qualityScore`.
- Human quality uses only explicit `rankingSurfaces.*.humanQuality` entries; automated scores are not used as proxies.
- Groups remain separate, and full rankings are shown without top-N truncation.

## Image

### service

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | grok/grok-imagine-image | 2/2 runs | $0.020000 |
| 2 | reve/latest | 2/2 runs | $0.024000 |
| 3 | reve/reve-create@20250915 | 1/2 runs | $0.024000 |
| 4 | bfl/flux-2-pro | 2/2 runs | $0.030000 |
| 5 | bfl/flux-2-flex | 2/2 runs | $0.050000 |
| 6 | grok/grok-imagine-image-quality | 2/2 runs | $0.050000 |
| 7 | openai/gpt-image-2 | 2/2 runs | $0.053000 |
| 8 | gemini/gemini-3.1-flash-image-preview | 2/2 runs | $0.067000 |
| 9 | bfl/flux-2-max | 2/2 runs | $0.070000 |
| 10 | openai/gpt-image-1.5 | 2/2 runs | $0.080000 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | grok/grok-imagine-image-quality | 2/2 runs | 4.878s |
| 2 | grok/grok-imagine-image | 2/2 runs | 5.748s |
| 3 | reve/reve-create@20250915 | 1/2 runs | 6.339s |
| 4 | reve/latest | 2/2 runs | 6.496s |
| 5 | bfl/flux-2-pro | 2/2 runs | 14.156s |
| 6 | bfl/flux-2-flex | 2/2 runs | 16.413s |
| 7 | gemini/gemini-3.1-flash-image-preview | 2/2 runs | 20.563s |
| 8 | openai/gpt-image-1.5 | 2/2 runs | 31.088s |
| 9 | bfl/flux-2-max | 2/2 runs | 44.407s |
| 10 | openai/gpt-image-2 | 2/2 runs | 105.686s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | openai/gpt-image-2 | 2/2 runs | 88.00/100 |
| 2 | gemini/gemini-3.1-flash-image-preview | 2/2 runs | 84.00/100 |
| 3 | openai/gpt-image-1.5 | 2/2 runs | 83.00/100 |
| 4 | bfl/flux-2-flex | 2/2 runs | 82.00/100 |
| 5 | grok/grok-imagine-image-quality | 2/2 runs | 82.00/100 |
| 6 | bfl/flux-2-max | 2/2 runs | 79.00/100 |
| 7 | bfl/flux-2-pro | 2/2 runs | 78.00/100 |
| 8 | grok/grok-imagine-image | 2/2 runs | 78.00/100 |
| 9 | reve/latest | 2/2 runs | 75.00/100 |
| 10 | reve/reve-create@20250915 | 1/2 runs | 60.00/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `image/service` in the current report files._

## Music

### service

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | minimax/music-2.6-free | 4/4 runs | $0.010000 |
| 2 | gemini/lyria-3-clip-preview | 4/4 runs | $0.040000 |
| 3 | gemini/lyria-3-pro-preview | 4/4 runs | $0.080000 |
| 4 | minimax/music-2.6 | 4/4 runs | $0.160000 |
| 5 | elevenlabs/music_v1 | 4/4 runs | $0.455000 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | gemini/lyria-3-clip-preview | 4/4 runs | 20.280s |
| 2 | elevenlabs/music_v1 | 4/4 runs | 20.765s |
| 3 | gemini/lyria-3-pro-preview | 4/4 runs | 36.636s |
| 4 | minimax/music-2.6 | 4/4 runs | 110.037s |
| 5 | minimax/music-2.6-free | 4/4 runs | 118.796s |

#### Auto-Quality Ranking

_Unavailable: no automatedQuality / qualityScore entries are present for `music/service` in the current report files._

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `music/service` in the current report files._

## OCR

### local

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | ocrmypdf | 6/6 runs | $0.000000 |
| 2 | paddle-ocr | 6/6 runs | $0.000000 |
| 3 | tesseract | 6/6 runs | $0.000000 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | tesseract | 6/6 runs | 4.251s |
| 2 | ocrmypdf | 6/6 runs | 13.310s |
| 3 | paddle-ocr | 6/6 runs | 33.806s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | tesseract | 6/6 runs | 65.51/100 |
| 2 | ocrmypdf | 6/6 runs | 63.51/100 |
| 3 | paddle-ocr | 6/6 runs | 61.62/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `ocr/local` in the current report files._

### thirdPartyService

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | glm (glm-ocr) | 6/6 runs | $0.000609 |
| 2 | openai (gpt-5.4-nano) | 6/6 runs | $0.004092 |
| 3 | gemini (gemini-3.1-flash-lite-preview) | 6/6 runs | $0.004465 |
| 6 | deepinfra (Qwen/Qwen3-VL-30B-A3B-Instruct) | 6/6 runs | $0.007979 |
| 7 | mistral (mistral-ocr-2512) | 6/6 runs | $0.010333 |
| 8 | deepinfra (Qwen/Qwen3-VL-235B-A22B-Instruct) | 6/6 runs | $0.010795 |
| 9 | openai (gpt-5.4-mini) | 6/6 runs | $0.013646 |
| 10 | grok (grok-4.3) | 6/6 runs | $0.022717 |
| 11 | anthropic (claude-haiku-4-5) | 5/6 runs | $0.026669 |
| 12 | kimi (kimi-k2.6) | 6/6 runs | $0.031046 |
| 13 | gemini (gemini-3.1-pro-preview) | 6/6 runs | $0.041827 |
| 14 | openai (gpt-5.4) | 6/6 runs | $0.055613 |
| 15 | anthropic (claude-sonnet-4-6) | 5/6 runs | $0.076090 |
| 16 | openai (gpt-5.5) | 6/6 runs | $0.146412 |
| 17 | unstructured (hi_res_and_enrichment) | 6/6 runs | $0.155000 |
| 18 | anthropic (claude-opus-4-7) | 5/6 runs | $0.177109 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | mistral (mistral-ocr-2512) | 6/6 runs | 6.595s |
| 2 | gemini (gemini-3.1-flash-lite-preview) | 6/6 runs | 9.679s |
| 3 | glm (glm-ocr) | 6/6 runs | 15.702s |
| 5 | openai (gpt-5.4-nano) | 6/6 runs | 29.051s |
| 6 | openai (gpt-5.4-mini) | 6/6 runs | 33.235s |
| 7 | openai (gpt-5.4) | 6/6 runs | 39.651s |
| 8 | openai (gpt-5.5) | 6/6 runs | 48.156s |
| 9 | anthropic (claude-haiku-4-5) | 5/6 runs | 62.211s |
| 11 | unstructured (hi_res_and_enrichment) | 6/6 runs | 66.108s |
| 12 | gemini (gemini-3.1-pro-preview) | 6/6 runs | 70.100s |
| 13 | anthropic (claude-opus-4-7) | 5/6 runs | 70.952s |
| 14 | deepinfra (Qwen/Qwen3-VL-235B-A22B-Instruct) | 6/6 runs | 75.023s |
| 15 | grok (grok-4.3) | 6/6 runs | 82.237s |
| 16 | kimi (kimi-k2.6) | 6/6 runs | 82.519s |
| 17 | deepinfra (Qwen/Qwen3-VL-30B-A3B-Instruct) | 6/6 runs | 121.088s |
| 18 | anthropic (claude-sonnet-4-6) | 5/6 runs | 139.961s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | anthropic (claude-opus-4-7) | 5/6 runs | 98.73/100 |
| 2 | grok (grok-4.3) | 6/6 runs | 97.84/100 |
| 3 | gemini (gemini-3.1-pro-preview) | 6/6 runs | 96.97/100 |
| 4 | kimi (kimi-k2.6) | 6/6 runs | 96.91/100 |
| 5 | deepinfra (Qwen/Qwen3-VL-235B-A22B-Instruct) | 6/6 runs | 95.10/100 |
| 6 | anthropic (claude-sonnet-4-6) | 5/6 runs | 90.50/100 |
| 7 | glm (glm-ocr) | 6/6 runs | 89.22/100 |
| 8 | deepinfra (Qwen/Qwen3-VL-30B-A3B-Instruct) | 6/6 runs | 87.03/100 |
| 9 | openai (gpt-5.4) | 6/6 runs | 86.95/100 |
| 10 | mistral (mistral-ocr-2512) | 6/6 runs | 84.24/100 |
| 11 | gemini (gemini-3.1-flash-lite-preview) | 6/6 runs | 82.28/100 |
| 12 | openai (gpt-5.5) | 6/6 runs | 78.69/100 |
| 13 | anthropic (claude-haiku-4-5) | 5/6 runs | 77.85/100 |
| 16 | openai (gpt-5.4-mini) | 6/6 runs | 72.74/100 |
| 17 | openai (gpt-5.4-nano) | 6/6 runs | 69.86/100 |
| 18 | unstructured (hi_res_and_enrichment) | 6/6 runs | 34.79/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `ocr/thirdPartyService` in the current report files._

## STT

### local

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | reverb-reverb (reverb_asr_v1) | 3/3 runs | $0.000000 |
| 2 | whisper-base | 3/3 runs | $0.000000 |
| 3 | whisper-large-v3-turbo | 3/3 runs | $0.000000 |
| 4 | whisper-medium | 3/3 runs | $0.000000 |
| 5 | whisper-small | 3/3 runs | $0.000000 |
| 6 | whisper-tiny | 3/3 runs | $0.000000 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | whisper-tiny | 3/3 runs | 20.825s |
| 2 | whisper-base | 3/3 runs | 22.836s |
| 3 | whisper-small | 3/3 runs | 41.750s |
| 4 | whisper-large-v3-turbo | 3/3 runs | 71.623s |
| 5 | whisper-medium | 3/3 runs | 96.919s |
| 6 | reverb-reverb (reverb_asr_v1) | 3/3 runs | 1211.293s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | whisper-medium | 3/3 runs | 94.38/100 |
| 2 | whisper-large-v3-turbo | 3/3 runs | 94.14/100 |
| 3 | whisper-small | 3/3 runs | 91.97/100 |
| 4 | whisper-base | 3/3 runs | 91.41/100 |
| 5 | reverb-reverb (reverb_asr_v1) | 3/3 runs | 89.99/100 |
| 6 | whisper-tiny | 3/3 runs | 89.39/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt/local` in the current report files._

### thirdPartyServiceNonDiarization

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | deepinfra-openai_whisper-large-v3-turbo | 3/3 runs | $0.003425 |
| 2 | deepinfra-openai_whisper-large-v3 | 3/3 runs | $0.007707 |
| 3 | groq-whisper-large-v3-turbo | 3/3 runs | $0.011417 |
| 4 | together-openai_whisper-large-v3 | 3/3 runs | $0.025689 |
| 5 | groq-whisper-large-v3 | 3/3 runs | $0.031683 |
| 6 | gemini-stt-gemini-3-flash-preview | 3/3 runs | $0.032881 |
| 7 | glm-stt-glm-asr-2512 | 3/3 runs | $0.041102 |
| 8 | openai-stt-gpt-4o-mini-transcribe | 3/3 runs | $0.051377 |
| 9 | supadata-auto | 3/3 runs | $0.073333 |
| 10 | openai-stt-gpt-4o-transcribe | 3/3 runs | $0.102754 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | together-openai_whisper-large-v3 | 3/3 runs | 3.263s |
| 2 | supadata-auto | 3/3 runs | 7.166s |
| 3 | groq-whisper-large-v3-turbo | 3/3 runs | 12.616s |
| 4 | groq-whisper-large-v3 | 3/3 runs | 13.595s |
| 5 | deepinfra-openai_whisper-large-v3-turbo | 3/3 runs | 13.823s |
| 6 | deepinfra-openai_whisper-large-v3 | 3/3 runs | 16.021s |
| 7 | openai-stt-gpt-4o-mini-transcribe | 3/3 runs | 29.078s |
| 8 | openai-stt-gpt-4o-transcribe | 3/3 runs | 44.042s |
| 9 | glm-stt-glm-asr-2512 | 3/3 runs | 77.345s |
| 10 | gemini-stt-gemini-3-flash-preview | 3/3 runs | 187.938s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | deepinfra-openai_whisper-large-v3 | 3/3 runs | 95.11/100 |
| 2 | groq-whisper-large-v3 | 3/3 runs | 94.83/100 |
| 3 | groq-whisper-large-v3-turbo | 3/3 runs | 94.79/100 |
| 4 | deepinfra-openai_whisper-large-v3-turbo | 3/3 runs | 94.77/100 |
| 5 | supadata-auto | 3/3 runs | 94.51/100 |
| 6 | together-openai_whisper-large-v3 | 3/3 runs | 94.36/100 |
| 7 | glm-stt-glm-asr-2512 | 3/3 runs | 92.14/100 |
| 8 | openai-stt-gpt-4o-transcribe | 3/3 runs | 92.11/100 |
| 9 | openai-stt-gpt-4o-mini-transcribe | 3/3 runs | 91.28/100 |
| 10 | gemini-stt-gemini-3-flash-preview | 3/3 runs | 59.70/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt/thirdPartyServiceNonDiarization` in the current report files._

### thirdPartyServiceDiarization

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | happyscribe-auto | 3/3 runs | $0.000000 |
| 2 | grok-speech-to-text | 3/3 runs | $0.028543 |
| 3 | soniox-stt-async-v4 | 3/3 runs | $0.028543 |
| 4 | rev-low_cost | 3/3 runs | $0.028556 |
| 5 | mistral-voxtral-mini-2602 | 3/3 runs | $0.051377 |
| 6 | rev-machine | 3/3 runs | $0.057111 |
| 7 | assemblyai-universal-3-pro | 3/3 runs | $0.059940 |
| 8 | elevenlabs-scribe_v2 | 3/3 runs | $0.062794 |
| 9 | speechmatics-standard | 3/3 runs | $0.128443 |
| 10 | deepgram-nova-3 | 3/3 runs | $0.166119 |
| 11 | gladia-default | 3/3 runs | $0.174111 |
| 12 | speechmatics-enhanced | 3/3 runs | $0.214071 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | deepgram-nova-3 | 3/3 runs | 5.407s |
| 2 | mistral-voxtral-mini-2602 | 3/3 runs | 14.944s |
| 3 | grok-speech-to-text | 3/3 runs | 17.418s |
| 4 | assemblyai-universal-3-pro | 3/3 runs | 21.916s |
| 5 | gladia-default | 3/3 runs | 25.986s |
| 6 | elevenlabs-scribe_v2 | 3/3 runs | 30.410s |
| 7 | speechmatics-standard | 3/3 runs | 35.209s |
| 8 | speechmatics-enhanced | 3/3 runs | 50.381s |
| 9 | soniox-stt-async-v4 | 3/3 runs | 70.938s |
| 10 | happyscribe-auto | 3/3 runs | 72.542s |
| 12 | rev-low_cost | 3/3 runs | 100.136s |
| 13 | rev-machine | 3/3 runs | 113.103s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | assemblyai-universal-3-pro | 3/3 runs | 97.69/100 |
| 2 | happyscribe-auto | 3/3 runs | 97.59/100 |
| 3 | mistral-voxtral-mini-2602 | 3/3 runs | 96.47/100 |
| 4 | speechmatics-enhanced | 3/3 runs | 95.51/100 |
| 5 | gladia-default | 3/3 runs | 95.46/100 |
| 6 | speechmatics-standard | 3/3 runs | 94.47/100 |
| 7 | soniox-stt-async-v4 | 3/3 runs | 94.42/100 |
| 9 | rev-machine | 3/3 runs | 92.65/100 |
| 10 | deepgram-nova-3 | 3/3 runs | 92.45/100 |
| 11 | elevenlabs-scribe_v2 | 3/3 runs | 92.27/100 |
| 13 | rev-low_cost | 3/3 runs | 91.95/100 |
| 14 | grok-speech-to-text | 3/3 runs | 88.44/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `stt/thirdPartyServiceDiarization` in the current report files._

## TTS

### local

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | kitten (kitten-tts-micro) | 1/1 runs | $0.000000 |
| 2 | kitten (kitten-tts-mini) | 1/1 runs | $0.000000 |
| 3 | kitten (kitten-tts-nano-0.8-int8) | 1/1 runs | $0.000000 |
| 4 | kitten (kitten-tts-nano) | 1/1 runs | $0.000000 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | kitten (kitten-tts-nano) | 1/1 runs | 5.133s |
| 2 | kitten (kitten-tts-micro) | 1/1 runs | 7.867s |
| 3 | kitten (kitten-tts-nano-0.8-int8) | 1/1 runs | 10.892s |
| 4 | kitten (kitten-tts-mini) | 1/1 runs | 12.903s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | kitten (kitten-tts-mini) | 1/1 runs | 96.07/100 |
| 2 | kitten (kitten-tts-nano-0.8-int8) | 1/1 runs | 96.07/100 |
| 3 | kitten (kitten-tts-nano) | 1/1 runs | 91.01/100 |
| 4 | kitten (kitten-tts-micro) | 1/1 runs | 85.96/100 |

#### Human Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | kitten (kitten-tts-micro) | 1/1 runs | 40.00/100 |
| 2 | kitten (kitten-tts-mini) | 1/1 runs | 40.00/100 |
| 3 | kitten (kitten-tts-nano-0.8-int8) | 1/1 runs | 40.00/100 |
| 4 | kitten (kitten-tts-nano) | 1/1 runs | 40.00/100 |

### service

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | grok (grok-tts) | 1/1 runs | $0.002247 |
| 2 | speechify (simba-english) | 1/1 runs | $0.005350 |
| 3 | speechify (simba-multilingual) | 1/1 runs | $0.005350 |
| 4 | openai (gpt-4o-mini-tts) | 1/1 runs | $0.006741 |
| 5 | gemini (gemini-3.1-flash-tts-preview) | 1/1 runs | $0.011235 |
| 6 | deepgram (aura-2-thalia-en) | 1/1 runs | $0.016050 |
| 8 | groq (canopylabs/orpheus-v1-english) | 1/1 runs | $0.017120 |
| 9 | cartesia (sonic-3.5) | 1/1 runs | $0.019996 |
| 10 | cartesia (sonic-3) | 1/1 runs | $0.019996 |
| 11 | minimax (speech-2.8-turbo) | 1/1 runs | $0.032100 |
| 12 | elevenlabs (eleven_v3) | 1/1 runs | $0.053500 |
| 13 | minimax (speech-2.8-hd) | 1/1 runs | $0.053500 |
| 14 | hume (octave-2) | 1/1 runs | $0.080250 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 3 | cartesia (sonic-3.5) | 1/1 runs | 5.835s |
| 4 | speechify (simba-multilingual) | 1/1 runs | 6.120s |
| 5 | hume (octave-2) | 1/1 runs | 6.316s |
| 6 | speechify (simba-english) | 1/1 runs | 6.697s |
| 7 | groq (canopylabs/orpheus-v1-english) | 1/1 runs | 7.451s |
| 8 | cartesia (sonic-3) | 1/1 runs | 7.966s |
| 9 | openai (gpt-4o-mini-tts) | 1/1 runs | 8.985s |
| 10 | grok (grok-tts) | 1/1 runs | 9.284s |
| 11 | deepgram (aura-2-thalia-en) | 1/1 runs | 17.719s |
| 12 | elevenlabs (eleven_v3) | 1/1 runs | 19.143s |
| 13 | minimax (speech-2.8-turbo) | 1/1 runs | 27.154s |
| 14 | gemini (gemini-3.1-flash-tts-preview) | 1/1 runs | 31.183s |
| 15 | minimax (speech-2.8-hd) | 1/1 runs | 109.594s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | minimax (speech-2.8-hd) | 1/1 runs | 98.31/100 |
| 2 | groq (canopylabs/orpheus-v1-english) | 1/1 runs | 97.19/100 |
| 3 | openai (gpt-4o-mini-tts) | 1/1 runs | 96.07/100 |
| 4 | gemini (gemini-3.1-flash-tts-preview) | 1/1 runs | 95.51/100 |
| 5 | grok (grok-tts) | 1/1 runs | 95.51/100 |
| 6 | speechify (simba-multilingual) | 1/1 runs | 94.94/100 |
| 7 | elevenlabs (eleven_v3) | 1/1 runs | 94.38/100 |
| 9 | deepgram (aura-2-thalia-en) | 1/1 runs | 93.26/100 |
| 10 | hume (octave-2) | 1/1 runs | 92.70/100 |
| 12 | speechify (simba-english) | 1/1 runs | 90.45/100 |
| 13 | cartesia (sonic-3.5) | 1/1 runs | 87.64/100 |
| 14 | cartesia (sonic-3) | 1/1 runs | 87.64/100 |
| 15 | minimax (speech-2.8-turbo) | 1/1 runs | 87.64/100 |

#### Human Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | elevenlabs (eleven_v3) | 1/1 runs | 80.00/100 |
| 3 | grok (grok-tts) | 1/1 runs | 80.00/100 |
| 4 | minimax (speech-2.8-turbo) | 1/1 runs | 80.00/100 |
| 5 | openai (gpt-4o-mini-tts) | 1/1 runs | 80.00/100 |
| 6 | deepgram (aura-2-thalia-en) | 1/1 runs | 70.00/100 |
| 8 | gemini (gemini-3.1-flash-tts-preview) | 1/1 runs | 70.00/100 |
| 9 | hume (octave-2) | 1/1 runs | 70.00/100 |
| 10 | minimax (speech-2.8-hd) | 1/1 runs | 70.00/100 |
| 11 | speechify (simba-english) | 1/1 runs | 70.00/100 |
| 12 | cartesia (sonic-3.5) | 1/1 runs | 60.00/100 |
| 13 | groq (canopylabs/orpheus-v1-english) | 1/1 runs | 60.00/100 |
| 14 | cartesia (sonic-3) | 1/1 runs | 50.00/100 |
| 15 | speechify (simba-multilingual) | 1/1 runs | 50.00/100 |

## URL

### local

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | defuddle | 2/2 runs | $0.000000 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | defuddle | 2/2 runs | 0.713s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | defuddle | 2/2 runs | 98.28/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `url/local` in the current report files._

### service

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | firecrawl | 2/2 runs | $0.000830 |
| 2 | spider | 2/2 runs | $0.001200 |
| 3 | zyte | 1/2 runs | $0.001600 |
| 4 | glm-reader | 2/2 runs | $0.010000 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | firecrawl | 2/2 runs | 1.380s |
| 2 | spider | 2/2 runs | 1.999s |
| 3 | glm-reader | 2/2 runs | 4.823s |
| 4 | zyte | 1/2 runs | 13.344s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | firecrawl | 2/2 runs | 94.85/100 |
| 2 | spider | 2/2 runs | 93.90/100 |
| 3 | glm-reader | 2/2 runs | 62.41/100 |
| 4 | zyte | 1/2 runs | 53.66/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `url/service` in the current report files._

## Video

### service

#### Cost Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | minimax/T2V-01 | 2/2 runs | $0.190000 |
| 2 | minimax/T2V-01-Director | 2/2 runs | $0.190000 |
| 3 | glm/cogvideox-3 | 2/2 runs | $0.200000 |
| 4 | gemini/veo-3.1-lite-generate-preview | 2/2 runs | $0.300000 |
| 5 | grok/grok-imagine-video | 2/2 runs | $0.300000 |
| 6 | glm/viduq1-text | 2/2 runs | $0.400000 |
| 7 | minimax/MiniMax-Hailuo-2.3 | 2/2 runs | $0.420000 |
| 8 | gemini/veo-3.1-fast-generate-preview | 2/2 runs | $0.600000 |
| 9 | gemini/veo-3.1-generate-preview | 1/2 runs | $3.200000 |

#### Speed Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | grok/grok-imagine-video | 2/2 runs | 31.314s |
| 2 | gemini/veo-3.1-lite-generate-preview | 2/2 runs | 51.728s |
| 3 | gemini/veo-3.1-fast-generate-preview | 2/2 runs | 56.776s |
| 4 | gemini/veo-3.1-generate-preview | 1/2 runs | 72.026s |
| 5 | minimax/MiniMax-Hailuo-2.3 | 2/2 runs | 97.972s |
| 6 | minimax/T2V-01-Director | 2/2 runs | 154.844s |
| 7 | glm/viduq1-text | 2/2 runs | 193.605s |
| 8 | glm/cogvideox-3 | 2/2 runs | 249.165s |
| 9 | minimax/T2V-01 | 2/2 runs | 283.097s |

#### Auto-Quality Ranking

| Rank | Provider/model | Runs | Average |
| ---: | --- | ---: | ---: |
| 1 | gemini/veo-3.1-generate-preview | 1/2 runs | 88.00/100 |
| 2 | minimax/MiniMax-Hailuo-2.3 | 1/2 runs | 88.00/100 |
| 3 | minimax/T2V-01-Director | 1/2 runs | 88.00/100 |
| 4 | grok/grok-imagine-video | 1/2 runs | 86.00/100 |
| 5 | gemini/veo-3.1-lite-generate-preview | 1/2 runs | 84.00/100 |
| 6 | gemini/veo-3.1-fast-generate-preview | 1/2 runs | 80.00/100 |
| 7 | glm/viduq1-text | 1/2 runs | 80.00/100 |
| 8 | minimax/T2V-01 | 1/2 runs | 80.00/100 |
| 9 | glm/cogvideox-3 | 1/2 runs | 78.00/100 |

#### Human Quality Ranking

_Unavailable: no humanQuality entries are present for `video/service` in the current report files._
