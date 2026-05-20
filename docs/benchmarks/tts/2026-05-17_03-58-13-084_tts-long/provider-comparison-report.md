# TTS Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/tts/2026-05-17_03-58-13-084_tts-long`
- Total providers: 20 (4 local, 16 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose separate fastest, cheapest, and highest-quality surfaces for each group.

## Method

- Fastest rankings use processing time when present.
- Cheapest local rankings use zero monetary cost and compare only local providers.
- Cheapest service rankings use reported monetary cost when present.
- Highest-quality rankings use only explicit quality evidence for the category.

## Local Providers

### Top 3 Fastest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `kitten/kitten-tts-nano` | 6.08s |
| 2 | `kitten/kitten-tts-nano-0.8-int8` | 7.84s |
| 3 | `kitten/kitten-tts-micro` | 7.84s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `kitten/kitten-tts-micro` | $0.00 local monetary cost |
| 2 | `kitten/kitten-tts-mini` | $0.00 local monetary cost |
| 3 | `kitten/kitten-tts-nano` | $0.00 local monetary cost |

### Top 3 Highest Quality

Unavailable: No roundtrip WER or explicit voice-quality metric was available for local providers. Duration, bitrate, and file size are not used as quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `kitten/kitten-tts-micro` | n/a | 7.84s | $0.00 |
| `kitten/kitten-tts-mini` | n/a | 9.04s | $0.00 |
| `kitten/kitten-tts-nano` | n/a | 6.08s | $0.00 |
| `kitten/kitten-tts-nano-0.8-int8` | n/a | 7.84s | $0.00 |

## Service Providers

### Top 3 Fastest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `gcloud/studio` | 1.80s |
| 2 | `gcloud/chirp3-hd` | 2.75s |
| 3 | `cartesia/sonic-3.5` | 2.92s |

### Top 3 Cheapest

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `deapi/Chatterbox` | $0.0002 |
| 2 | `deapi/Kokoro` | $0.0002 |
| 3 | `deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice` | $0.0002 |

### Top 3 Highest Quality

Unavailable: No roundtrip WER or explicit voice-quality metric was available for service providers. Duration, bitrate, and file size are not used as quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| `cartesia/sonic-3` | n/a | 7.56s | $0.0107 |
| `cartesia/sonic-3.5` | n/a | 2.92s | $0.0107 |
| `deapi/Chatterbox` | n/a | 16.03s | $0.0002 |
| `deapi/Kokoro` | n/a | 4.94s | $0.0002 |
| `deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice` | n/a | 64.95s | $0.0002 |
| `deepgram/aura-2-thalia-en` | n/a | 9.43s | $0.0086 |
| `elevenlabs/eleven_v3` | n/a | 11.41s | $0.0286 |
| `gcloud/chirp3-hd` | n/a | 2.75s | $0.0086 |
| `gcloud/studio` | n/a | 1.80s | $0.0458 |
| `gemini/gemini-3.1-flash-tts-preview` | n/a | 14.13s | $0.0060 |
| `grok/grok-tts` | n/a | 4.86s | $0.0012 |
| `groq/canopylabs/orpheus-v1-english` | n/a | 4.16s | $0.0092 |
| `hume/octave-2` | n/a | 3.96s | $0.0429 |
| `minimax/speech-2.8-hd` | n/a | 80.86s | $0.0286 |
| `minimax/speech-2.8-turbo` | n/a | 11.58s | $0.0172 |
| `openai/gpt-4o-mini-tts` | n/a | 5.11s | $0.0036 |

## Notes

- Best local model: `kitten/kitten-tts-nano` scored 37.97/100.
- Best cloud service: `deapi/Kokoro` scored 38.33/100.
- The cheapest cloud providers were `deapi/Kokoro`, `deapi/Chatterbox`, and `deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice` at 0.0220¢ ($0.0002).
- Fastest local model: `kitten/kitten-tts-nano` at 6.08s.
- Fastest cloud service: `gcloud/studio` at 1.80s.
- No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.
