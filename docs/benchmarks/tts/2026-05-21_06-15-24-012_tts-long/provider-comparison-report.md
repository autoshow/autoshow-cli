# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/tts/2026-05-21_06-15-24-012_tts-long`
- Total providers: 19 (4 local, 15 service)
- Local models and third-party service models are intentionally not ranked against each other.
- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.

## Method

- Price rankings use zero monetary cost for local models and reported monetary cost for services.
- Speed rankings use processing time when present.
- Automated quality rankings use roundtrip WER-derived accuracy when present.
- Human quality rankings use manually supplied humanSpeechScore values from voice-quality-report.json when present.
- Duration, bitrate, file size, and subjective judgment are not used as quality proxies.

## Local Models

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>kitten/kitten-tts-micro</code> | $0.00 local monetary cost |
| 2 | <code>kitten/kitten-tts-mini</code> | $0.00 local monetary cost |
| 3 | <code>kitten/kitten-tts-nano</code> | $0.00 local monetary cost |
| 4 | <code>kitten/kitten-tts-nano-0.8-int8</code> | $0.00 local monetary cost |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>kitten/kitten-tts-nano</code> | 5.13s |
| 2 | <code>kitten/kitten-tts-micro</code> | 7.87s |
| 3 | <code>kitten/kitten-tts-nano-0.8-int8</code> | 10.89s |
| 4 | <code>kitten/kitten-tts-mini</code> | 12.90s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>kitten/kitten-tts-mini</code> | 96.07 accuracy (3.93% roundtrip WER) |
| 2 | <code>kitten/kitten-tts-nano-0.8-int8</code> | 96.07 accuracy (3.93% roundtrip WER) |
| 3 | <code>kitten/kitten-tts-nano</code> | 91.01 accuracy (8.99% roundtrip WER) |
| 4 | <code>kitten/kitten-tts-micro</code> | 85.96 accuracy (14.04% roundtrip WER) |

### Human Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>kitten/kitten-tts-micro</code> | 40.00 humanSpeechScore |
| 2 | <code>kitten/kitten-tts-mini</code> | 40.00 humanSpeechScore |
| 3 | <code>kitten/kitten-tts-nano</code> | 40.00 humanSpeechScore |
| 4 | <code>kitten/kitten-tts-nano-0.8-int8</code> | 40.00 humanSpeechScore |

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>kitten/kitten-tts-micro</code> | 40.00 humanSpeechScore | 7.87s | $0.00 |
| <code>kitten/kitten-tts-mini</code> | 40.00 humanSpeechScore | 12.90s | $0.00 |
| <code>kitten/kitten-tts-nano</code> | 40.00 humanSpeechScore | 5.13s | $0.00 |
| <code>kitten/kitten-tts-nano-0.8-int8</code> | 40.00 humanSpeechScore | 10.89s | $0.00 |

## Third-Party Service Models

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>grok/grok-tts</code> | $0.0022 |
| 2 | <code>speechify/simba-english</code> | $0.0054 |
| 3 | <code>speechify/simba-multilingual</code> | $0.0054 |
| 4 | <code>openai/gpt-4o-mini-tts</code> | $0.0067 |
| 5 | <code>gemini/gemini-3.1-flash-tts-preview</code> | $0.0112 |
| 6 | <code>deepgram/aura-2-thalia-en</code> | $0.0160 |
| 8 | <code>groq/canopylabs/orpheus-v1-english</code> | $0.0171 |
| 9 | <code>cartesia/sonic-3</code> | $0.0200 |
| 10 | <code>cartesia/sonic-3.5</code> | $0.0200 |
| 11 | <code>minimax/speech-2.8-turbo</code> | $0.0321 |
| 12 | <code>elevenlabs/eleven_v3</code> | $0.0535 |
| 13 | <code>minimax/speech-2.8-hd</code> | $0.0535 |
| 14 | <code>hume/octave-2</code> | $0.0803 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 3 | <code>cartesia/sonic-3.5</code> | 5.83s |
| 4 | <code>speechify/simba-multilingual</code> | 6.12s |
| 5 | <code>hume/octave-2</code> | 6.32s |
| 6 | <code>speechify/simba-english</code> | 6.70s |
| 7 | <code>groq/canopylabs/orpheus-v1-english</code> | 7.45s |
| 8 | <code>cartesia/sonic-3</code> | 7.97s |
| 9 | <code>openai/gpt-4o-mini-tts</code> | 8.98s |
| 10 | <code>grok/grok-tts</code> | 9.28s |
| 11 | <code>deepgram/aura-2-thalia-en</code> | 17.72s |
| 12 | <code>elevenlabs/eleven_v3</code> | 19.14s |
| 13 | <code>minimax/speech-2.8-turbo</code> | 27.15s |
| 14 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 31.18s |
| 15 | <code>minimax/speech-2.8-hd</code> | 109.59s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>minimax/speech-2.8-hd</code> | 98.31 accuracy (1.69% roundtrip WER) |
| 2 | <code>groq/canopylabs/orpheus-v1-english</code> | 97.19 accuracy (2.81% roundtrip WER) |
| 3 | <code>openai/gpt-4o-mini-tts</code> | 96.07 accuracy (3.93% roundtrip WER) |
| 4 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 95.51 accuracy (4.49% roundtrip WER) |
| 5 | <code>grok/grok-tts</code> | 95.51 accuracy (4.49% roundtrip WER) |
| 6 | <code>speechify/simba-multilingual</code> | 94.94 accuracy (5.06% roundtrip WER) |
| 7 | <code>elevenlabs/eleven_v3</code> | 94.38 accuracy (5.62% roundtrip WER) |
| 9 | <code>deepgram/aura-2-thalia-en</code> | 93.26 accuracy (6.74% roundtrip WER) |
| 10 | <code>hume/octave-2</code> | 92.70 accuracy (7.30% roundtrip WER) |
| 12 | <code>speechify/simba-english</code> | 90.45 accuracy (9.55% roundtrip WER) |
| 13 | <code>cartesia/sonic-3</code> | 87.64 accuracy (12.36% roundtrip WER) |
| 14 | <code>cartesia/sonic-3.5</code> | 87.64 accuracy (12.36% roundtrip WER) |
| 15 | <code>minimax/speech-2.8-turbo</code> | 87.64 accuracy (12.36% roundtrip WER) |

### Human Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>elevenlabs/eleven_v3</code> | 80.00 humanSpeechScore |
| 3 | <code>grok/grok-tts</code> | 80.00 humanSpeechScore |
| 4 | <code>minimax/speech-2.8-turbo</code> | 80.00 humanSpeechScore |
| 5 | <code>openai/gpt-4o-mini-tts</code> | 80.00 humanSpeechScore |
| 6 | <code>deepgram/aura-2-thalia-en</code> | 70.00 humanSpeechScore |
| 8 | <code>gemini/gemini-3.1-flash-tts-preview</code> | 70.00 humanSpeechScore |
| 9 | <code>hume/octave-2</code> | 70.00 humanSpeechScore |
| 10 | <code>minimax/speech-2.8-hd</code> | 70.00 humanSpeechScore |
| 11 | <code>speechify/simba-english</code> | 70.00 humanSpeechScore |
| 12 | <code>cartesia/sonic-3.5</code> | 60.00 humanSpeechScore |
| 13 | <code>groq/canopylabs/orpheus-v1-english</code> | 60.00 humanSpeechScore |
| 14 | <code>cartesia/sonic-3</code> | 50.00 humanSpeechScore |
| 15 | <code>speechify/simba-multilingual</code> | 50.00 humanSpeechScore |

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>cartesia/sonic-3</code> | 50.00 humanSpeechScore | 7.97s | $0.0200 |
| <code>cartesia/sonic-3.5</code> | 60.00 humanSpeechScore | 5.83s | $0.0200 |
| <code>deepgram/aura-2-thalia-en</code> | 70.00 humanSpeechScore | 17.72s | $0.0160 |
| <code>elevenlabs/eleven_v3</code> | 80.00 humanSpeechScore | 19.14s | $0.0535 |
| <code>gemini/gemini-3.1-flash-tts-preview</code> | 70.00 humanSpeechScore | 31.18s | $0.0112 |
| <code>grok/grok-tts</code> | 80.00 humanSpeechScore | 9.28s | $0.0022 |
| <code>groq/canopylabs/orpheus-v1-english</code> | 60.00 humanSpeechScore | 7.45s | $0.0171 |
| <code>hume/octave-2</code> | 70.00 humanSpeechScore | 6.32s | $0.0803 |
| <code>minimax/speech-2.8-hd</code> | 70.00 humanSpeechScore | 109.59s | $0.0535 |
| <code>minimax/speech-2.8-turbo</code> | 80.00 humanSpeechScore | 27.15s | $0.0321 |
| <code>openai/gpt-4o-mini-tts</code> | 80.00 humanSpeechScore | 8.98s | $0.0067 |
| <code>speechify/simba-english</code> | 70.00 humanSpeechScore | 6.70s | $0.0054 |
| <code>speechify/simba-multilingual</code> | 50.00 humanSpeechScore | 6.12s | $0.0054 |

## Notes

- Local human-quality scores were tied at 40.00 humanSpeechScore for all local Kitten models.
- The cheapest cloud provider was `grok/grok-tts` at 0.2247¢ ($0.0022).
- Fastest local model: `kitten/kitten-tts-nano` at 5.13s.
- Manual human quality ratings supplied on 2026-05-21 were mapped from a 1-10 scale to 0-100 humanSpeechScore values.
