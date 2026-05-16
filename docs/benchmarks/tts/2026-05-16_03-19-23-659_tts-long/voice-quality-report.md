# TTS Voice Quality Report

## Summary

- Input text: `metadata.input` (286 characters, 60 words)
- Total providers: 29 (4 local, 25 cloud)
- Mode: full
- Human speech score: 55% naturalnessScore + 45% speechQualityScore
- Naturalness score target weights: 45% UTMOSv2 MOS, 25% NISQA-TTS naturalness MOS, 20% paid audio-judge rubric, 10% prosody heuristics
- Speech quality score target weights: 35% NISQA quality MOS, 25% DNSMOS, 25% roundtrip STT intelligibility, 15% signal hygiene

## Method

- Audio files are normalized to temporary 16 kHz mono WAV for scoring. Original files are not modified.
- MOS-style 1-5 metrics are converted with `(mos - 1) / 4 * 100`.
- Missing components are omitted from that score's denominator and listed per provider.
- Cost, provider processing speed, and provider latency are not included in human-speech scoring.
- Full mode treats attempted paid scoring failures as fatal when credentials are configured.
- Local mode never starts paid STT or audio-judge calls.

## Overall Ranking

| Rank | Provider | Group | Human / 100 | Naturalness | Speech Quality | Nat/Qual Coverage | Missing | Listen |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | `minimax/speech-02-hd` | cloud | 93.70 | 88.57 | 99.98 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-minimax-speech-02-hd.wav) |
| 2 | `elevenlabs/eleven_v3` | cloud | 92.76 | 86.85 | 99.98 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-elevenlabs-eleven_v3.wav) |
| 3 | `kitten/kitten-tts-nano-0.8-int8` | local | 92.44 | 87.48 | 98.49 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-kitten-kitten-tts-nano-0.8-int8.wav) |
| 4 | `openai/gpt-4o-mini-tts` | cloud | 92.39 | 87.12 | 98.82 | 30% / 40% | [*] | — |
| 5 | `kitten/kitten-tts-nano` | local | 92.15 | 87.19 | 98.22 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-kitten-kitten-tts-nano.wav) |
| 6 | `minimax/speech-2.6-turbo` | cloud | 91.43 | 84.43 | 100.00 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-minimax-speech-2.6-turbo.wav) |
| 7 | `kitten/kitten-tts-micro` | local | 91.28 | 85.39 | 98.47 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-kitten-kitten-tts-micro.wav) |
| 8 | `minimax/speech-02-turbo` | cloud | 91.11 | 83.83 | 100.00 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-minimax-speech-02-turbo.wav) |
| 9 | `minimax/speech-2.8-turbo` | cloud | 91.09 | 83.80 | 100.00 | 30% / 40% | [*] | — |
| 10 | `gemini/gemini-3.1-flash-tts-preview` | cloud | 90.23 | 84.99 | 96.64 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-gemini-gemini-3.1-flash-tts-preview.wav) |
| 11 | `gemini/gemini-2.5-flash-preview-tts` | cloud | 90.04 | 86.49 | 94.37 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-gemini-gemini-2.5-flash-preview-tts.wav) |
| 12 | `minimax/speech-2.8-hd` | cloud | 90.01 | 86.45 | 94.36 | 30% / 40% | [*] | — |
| 13 | `gcloud/wavenet` | cloud | 89.78 | 82.26 | 98.96 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-gcloud-wavenet.wav) |
| 14 | `elevenlabs/eleven_turbo_v2_5` | cloud | 89.69 | 82.92 | 97.96 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-elevenlabs-eleven_turbo_v2_5.wav) |
| 15 | `deepgram/aura-2-thalia-en` | cloud | 89.53 | 81.32 | 99.57 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-deepgram-aura-2-thalia-en.wav) |
| 16 | `elevenlabs/eleven_flash_v2_5` | cloud | 89.45 | 82.62 | 97.80 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-elevenlabs-eleven_flash_v2_5.wav) |
| 17 | `gcloud/chirp3-hd` | cloud | 88.73 | 81.06 | 98.10 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-gcloud-chirp3-hd.wav) |
| 18 | `runway/eleven_multilingual_v2` | cloud | 88.66 | 82.22 | 96.53 | 30% / 40% | [*] | — |
| 19 | `deapi/Kokoro` | cloud | 88.21 | 79.83 | 98.46 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-deapi-Kokoro.wav) |
| 20 | `gcloud/neural2` | cloud | 87.68 | 78.45 | 98.96 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-gcloud-neural2.wav) |
| 21 | `gcloud/standard` | cloud | 87.68 | 78.45 | 98.96 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-gcloud-standard.wav) |
| 22 | `grok/grok-tts` | cloud | 86.88 | 79.12 | 96.36 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-grok-grok-tts.wav) |
| 23 | `gcloud/studio` | cloud | 86.71 | 75.85 | 99.99 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-gcloud-studio.wav) |
| 24 | `minimax/speech-2.6-hd` | cloud | 86.61 | 79.58 | 95.20 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-minimax-speech-2.6-hd.wav) |
| 25 | `kitten/kitten-tts-mini` | local | 85.97 | 75.72 | 98.49 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-kitten-kitten-tts-mini.wav) |
| 26 | `deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice` | cloud | 84.92 | 77.39 | 94.11 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-deapi-Qwen3_TTS_12Hz_1_7B_CustomVoice.wav) |
| 27 | `gemini/gemini-2.5-pro-preview-tts` | cloud | 82.80 | 74.04 | 93.50 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-gemini-gemini-2.5-pro-preview-tts.wav) |
| 28 | `deapi/Chatterbox` | cloud | 80.97 | 70.00 | 94.37 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-deapi-Chatterbox.wav) |
| 29 | `groq/canopylabs/orpheus-v1-english` | cloud | 80.71 | 69.99 | 93.81 | 30% / 40% | [*] | [▶](https://ajc.pics/autoshow/benchmarks/tts/2026-05-16_03-19-23-659_tts-long/speech-groq-canopylabs-orpheus-v1-english.wav) |

> **[*] Missing metrics (all providers):** `naturalness.utmosv2Mos`, `naturalness.nisqaTtsNaturalnessMos`, `speechQuality.nisqaQualityMos`, `speechQuality.dnsmos`

## Best By Group

- Best local model: `kitten/kitten-tts-nano-0.8-int8` (92.44/100)
- Best cloud service: `minimax/speech-02-hd` (93.70/100)

## Warnings

- minimax/speech-2.8-hd: Abrupt waveform discontinuities detected
- gemini/gemini-3.1-flash-tts-preview: Abrupt waveform discontinuities detected
- gemini/gemini-2.5-flash-preview-tts: Abrupt waveform discontinuities detected
- deapi/Chatterbox: Abrupt waveform discontinuities detected
