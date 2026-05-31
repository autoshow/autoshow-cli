# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/stt/2026-05-21_06-13-39-577_2022-09-30-widgets-fsjam-40-minutes`
- Total providers: 30 (6 local, 24 third-party service)
- Local, third-party non-diarization, and third-party diarization providers are ranked separately for price, speed, and quality score.
- Quality score uses speaker-aware WER-derived transcript accuracy, with text-only WER retained as supporting evidence.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing speaker-aware WER-derived provider score from highest to lowest.
- Third-party service rankings are split by whether the normalized provider result supports diarization.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>reverb/reverb_asr_v1</code> | $0.00 local monetary cost | 88.97 | 11.03% | 10.15% | supported | 2829.31s | $0.00 |
| 2 | <code>whisper-base</code> | $0.00 local monetary cost | 93.11 | 6.89% | 6.16% | not-supported | 55.34s | $0.00 |
| 3 | <code>whisper-large-v3-turbo</code> | $0.00 local monetary cost | 96.08 | 3.92% | 3.13% | not-supported | 171.02s | $0.00 |
| 4 | <code>whisper-medium</code> | $0.00 local monetary cost | 94.70 | 5.30% | 4.55% | not-supported | 233.38s | $0.00 |
| 5 | <code>whisper-small</code> | $0.00 local monetary cost | 95.11 | 4.89% | 4.11% | not-supported | 99.11s | $0.00 |
| 6 | <code>whisper-tiny</code> | $0.00 local monetary cost | 90.54 | 9.46% | 8.75% | not-supported | 40.54s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>whisper-tiny</code> | 40.54s | 90.54 | 9.46% | 8.75% | not-supported | 40.54s | $0.00 |
| 2 | <code>whisper-base</code> | 55.34s | 93.11 | 6.89% | 6.16% | not-supported | 55.34s | $0.00 |
| 3 | <code>whisper-small</code> | 99.11s | 95.11 | 4.89% | 4.11% | not-supported | 99.11s | $0.00 |
| 4 | <code>whisper-large-v3-turbo</code> | 171.02s | 96.08 | 3.92% | 3.13% | not-supported | 171.02s | $0.00 |
| 5 | <code>whisper-medium</code> | 233.38s | 94.70 | 5.30% | 4.55% | not-supported | 233.38s | $0.00 |
| 6 | <code>reverb/reverb_asr_v1</code> | 2829.31s | 88.97 | 11.03% | 10.15% | supported | 2829.31s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>whisper-large-v3-turbo</code> | 96.08/100 quality score | 96.08 | 3.92% | 3.13% | not-supported | 171.02s | $0.00 |
| 2 | <code>whisper-small</code> | 95.11/100 quality score | 95.11 | 4.89% | 4.11% | not-supported | 99.11s | $0.00 |
| 3 | <code>whisper-medium</code> | 94.70/100 quality score | 94.70 | 5.30% | 4.55% | not-supported | 233.38s | $0.00 |
| 4 | <code>whisper-base</code> | 93.11/100 quality score | 93.11 | 6.89% | 6.16% | not-supported | 55.34s | $0.00 |
| 5 | <code>whisper-tiny</code> | 90.54/100 quality score | 90.54 | 9.46% | 8.75% | not-supported | 40.54s | $0.00 |
| 6 | <code>reverb/reverb_asr_v1</code> | 88.97/100 quality score | 88.97 | 11.03% | 10.15% | supported | 2829.31s | $0.00 |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>supadata-auto</code> | $0.00 | 95.85 | 4.15% | 3.34% | not-supported | 11.23s | $0.00 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0081 | 96.05 | 3.95% | 3.14% | not-supported | 32.83s | $0.0081 |
| 3 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0182 | 96.24 | 3.76% | 2.95% | not-supported | 38.54s | $0.0182 |
| 4 | <code>groq-whisper-large-v3-turbo</code> | $0.0269 | 96.07 | 3.93% | 3.13% | not-supported | 27.66s | $0.0269 |
| 5 | <code>together-openai_whisper-large-v3</code> | $0.0606 | 95.95 | 4.05% | 3.26% | not-supported | 5.52s | $0.0606 |
| 6 | <code>groq-whisper-large-v3</code> | $0.0747 | 95.78 | 4.22% | 3.42% | not-supported | 30.43s | $0.0747 |
| 7 | <code>gemini-stt-gemini-3-flash-preview</code> | $0.0775 | 0.00 | 125.13% | 125.49% | not-supported | 382.48s | $0.0775 |
| 8 | <code>glm-stt-glm-asr-2512</code> | $0.0969 | 93.95 | 6.05% | 5.25% | not-supported | 166.00s | $0.0969 |
| 9 | <code>openai-stt-gpt-4o-mini-transcribe</code> | $0.1212 | 86.59 | 13.41% | 12.68% | not-supported | 68.84s | $0.1212 |
| 10 | <code>openai-stt-gpt-4o-transcribe</code> | $0.2423 | 87.01 | 12.99% | 12.26% | not-supported | 104.08s | $0.2423 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>together-openai_whisper-large-v3</code> | 5.52s | 95.95 | 4.05% | 3.26% | not-supported | 5.52s | $0.0606 |
| 2 | <code>supadata-auto</code> | 11.23s | 95.85 | 4.15% | 3.34% | not-supported | 11.23s | $0.00 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 27.66s | 96.07 | 3.93% | 3.13% | not-supported | 27.66s | $0.0269 |
| 4 | <code>groq-whisper-large-v3</code> | 30.43s | 95.78 | 4.22% | 3.42% | not-supported | 30.43s | $0.0747 |
| 5 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 32.83s | 96.05 | 3.95% | 3.14% | not-supported | 32.83s | $0.0081 |
| 6 | <code>deepinfra-openai_whisper-large-v3</code> | 38.54s | 96.24 | 3.76% | 2.95% | not-supported | 38.54s | $0.0182 |
| 7 | <code>openai-stt-gpt-4o-mini-transcribe</code> | 68.84s | 86.59 | 13.41% | 12.68% | not-supported | 68.84s | $0.1212 |
| 8 | <code>openai-stt-gpt-4o-transcribe</code> | 104.08s | 87.01 | 12.99% | 12.26% | not-supported | 104.08s | $0.2423 |
| 9 | <code>glm-stt-glm-asr-2512</code> | 166.00s | 93.95 | 6.05% | 5.25% | not-supported | 166.00s | $0.0969 |
| 10 | <code>gemini-stt-gemini-3-flash-preview</code> | 382.48s | 0.00 | 125.13% | 125.49% | not-supported | 382.48s | $0.0775 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3</code> | 96.24/100 quality score | 96.24 | 3.76% | 2.95% | not-supported | 38.54s | $0.0182 |
| 2 | <code>groq-whisper-large-v3-turbo</code> | 96.07/100 quality score | 96.07 | 3.93% | 3.13% | not-supported | 27.66s | $0.0269 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 96.05/100 quality score | 96.05 | 3.95% | 3.14% | not-supported | 32.83s | $0.0081 |
| 4 | <code>together-openai_whisper-large-v3</code> | 95.95/100 quality score | 95.95 | 4.05% | 3.26% | not-supported | 5.52s | $0.0606 |
| 5 | <code>supadata-auto</code> | 95.85/100 quality score | 95.85 | 4.15% | 3.34% | not-supported | 11.23s | $0.00 |
| 6 | <code>groq-whisper-large-v3</code> | 95.78/100 quality score | 95.78 | 4.22% | 3.42% | not-supported | 30.43s | $0.0747 |
| 7 | <code>glm-stt-glm-asr-2512</code> | 93.95/100 quality score | 93.95 | 6.05% | 5.25% | not-supported | 166.00s | $0.0969 |
| 8 | <code>openai-stt-gpt-4o-transcribe</code> | 87.01/100 quality score | 87.01 | 12.99% | 12.26% | not-supported | 104.08s | $0.2423 |
| 9 | <code>openai-stt-gpt-4o-mini-transcribe</code> | 86.59/100 quality score | 86.59 | 13.41% | 12.68% | not-supported | 68.84s | $0.1212 |
| 10 | <code>gemini-stt-gemini-3-flash-preview</code> | 0.00/100 quality score | 0.00 | 125.13% | 125.49% | not-supported | 382.48s | $0.0775 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>happyscribe-auto</code> | $0.00 | 98.98 | 1.02% | 0.99% | supported | 95.74s | $0.00 |
| 2 | <code>grok-speech-to-text</code> | $0.0673 | 92.01 | 7.99% | 7.60% | supported | 41.36s | $0.0673 |
| 3 | <code>soniox-stt-async-v4</code> | $0.0673 | 96.20 | 3.80% | 3.68% | supported | 158.36s | $0.0673 |
| 4 | <code>rev-low_cost</code> | $0.0673 | 93.43 | 6.57% | 6.10% | supported | 209.12s | $0.0673 |
| 5 | <code>mistral-voxtral-mini-2602</code> | $0.1212 | 97.13 | 2.87% | 2.75% | supported | 28.38s | $0.1212 |
| 6 | <code>rev-machine</code> | $0.1347 | 94.09 | 5.91% | 5.45% | supported | 229.50s | $0.1347 |
| 7 | <code>assemblyai-universal-3-pro</code> | $0.1413 | 99.48 | 0.52% | 0.50% | supported | 39.60s | $0.1413 |
| 8 | <code>elevenlabs-scribe_v2</code> | $0.1481 | 96.12 | 3.88% | 3.10% | supported | 61.48s | $0.1481 |
| 9 | <code>speechmatics-standard</code> | $0.3029 | 95.12 | 4.88% | 4.71% | supported | 79.62s | $0.3029 |
| 10 | <code>deepgram-nova-3</code> | $0.3917 | 95.07 | 4.93% | 3.91% | supported | 11.51s | $0.3917 |
| 11 | <code>gladia-default</code> | $0.4106 | 96.58 | 3.42% | 3.19% | supported | 38.18s | $0.4106 |
| 12 | <code>speechmatics-enhanced</code> | $0.5048 | 96.40 | 3.60% | 3.45% | supported | 111.51s | $0.5048 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 11.51s | 95.07 | 4.93% | 3.91% | supported | 11.51s | $0.3917 |
| 2 | <code>mistral-voxtral-mini-2602</code> | 28.38s | 97.13 | 2.87% | 2.75% | supported | 28.38s | $0.1212 |
| 3 | <code>gladia-default</code> | 38.18s | 96.58 | 3.42% | 3.19% | supported | 38.18s | $0.4106 |
| 4 | <code>assemblyai-universal-3-pro</code> | 39.60s | 99.48 | 0.52% | 0.50% | supported | 39.60s | $0.1413 |
| 5 | <code>grok-speech-to-text</code> | 41.36s | 92.01 | 7.99% | 7.60% | supported | 41.36s | $0.0673 |
| 6 | <code>elevenlabs-scribe_v2</code> | 61.48s | 96.12 | 3.88% | 3.10% | supported | 61.48s | $0.1481 |
| 7 | <code>speechmatics-standard</code> | 79.62s | 95.12 | 4.88% | 4.71% | supported | 79.62s | $0.3029 |
| 8 | <code>happyscribe-auto</code> | 95.74s | 98.98 | 1.02% | 0.99% | supported | 95.74s | $0.00 |
| 9 | <code>speechmatics-enhanced</code> | 111.51s | 96.40 | 3.60% | 3.45% | supported | 111.51s | $0.5048 |
| 10 | <code>soniox-stt-async-v4</code> | 158.36s | 96.20 | 3.80% | 3.68% | supported | 158.36s | $0.0673 |
| 12 | <code>rev-low_cost</code> | 209.12s | 93.43 | 6.57% | 6.10% | supported | 209.12s | $0.0673 |
| 13 | <code>rev-machine</code> | 229.50s | 94.09 | 5.91% | 5.45% | supported | 229.50s | $0.1347 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>assemblyai-universal-3-pro</code> | 99.48/100 quality score | 99.48 | 0.52% | 0.50% | supported | 39.60s | $0.1413 |
| 2 | <code>happyscribe-auto</code> | 98.98/100 quality score | 98.98 | 1.02% | 0.99% | supported | 95.74s | $0.00 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 97.13/100 quality score | 97.13 | 2.87% | 2.75% | supported | 28.38s | $0.1212 |
| 4 | <code>gladia-default</code> | 96.58/100 quality score | 96.58 | 3.42% | 3.19% | supported | 38.18s | $0.4106 |
| 5 | <code>speechmatics-enhanced</code> | 96.40/100 quality score | 96.40 | 3.60% | 3.45% | supported | 111.51s | $0.5048 |
| 6 | <code>soniox-stt-async-v4</code> | 96.20/100 quality score | 96.20 | 3.80% | 3.68% | supported | 158.36s | $0.0673 |
| 7 | <code>elevenlabs-scribe_v2</code> | 96.12/100 quality score | 96.12 | 3.88% | 3.10% | supported | 61.48s | $0.1481 |
| 8 | <code>speechmatics-standard</code> | 95.12/100 quality score | 95.12 | 4.88% | 4.71% | supported | 79.62s | $0.3029 |
| 9 | <code>deepgram-nova-3</code> | 95.07/100 quality score | 95.07 | 4.93% | 3.91% | supported | 11.51s | $0.3917 |
| 12 | <code>rev-machine</code> | 94.09/100 quality score | 94.09 | 5.91% | 5.45% | supported | 229.50s | $0.1347 |
| 13 | <code>rev-low_cost</code> | 93.43/100 quality score | 93.43 | 6.57% | 6.10% | supported | 209.12s | $0.0673 |
| 14 | <code>grok-speech-to-text</code> | 92.01/100 quality score | 92.01 | 7.99% | 7.60% | supported | 41.36s | $0.0673 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | Local | supported | 88.97 | 11.03% | 10.15% | 2829.31s | $0.00 |
| <code>whisper-base</code> | Local | not-supported | 93.11 | 6.89% | 6.16% | 55.34s | $0.00 |
| <code>whisper-large-v3-turbo</code> | Local | not-supported | 96.08 | 3.92% | 3.13% | 171.02s | $0.00 |
| <code>whisper-medium</code> | Local | not-supported | 94.70 | 5.30% | 4.55% | 233.38s | $0.00 |
| <code>whisper-small</code> | Local | not-supported | 95.11 | 4.89% | 4.11% | 99.11s | $0.00 |
| <code>whisper-tiny</code> | Local | not-supported | 90.54 | 9.46% | 8.75% | 40.54s | $0.00 |
| <code>assemblyai-universal-3-pro</code> | Third-Party Service Diarization | supported | 99.48 | 0.52% | 0.50% | 39.60s | $0.1413 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 95.07 | 4.93% | 3.91% | 11.51s | $0.3917 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 96.24 | 3.76% | 2.95% | 38.54s | $0.0182 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 96.05 | 3.95% | 3.14% | 32.83s | $0.0081 |
| <code>elevenlabs-scribe_v2</code> | Third-Party Service Diarization | supported | 96.12 | 3.88% | 3.10% | 61.48s | $0.1481 |
| <code>gemini-stt-gemini-3-flash-preview</code> | Third-Party Service Non-Diarization | not-supported | 0.00 | 125.13% | 125.49% | 382.48s | $0.0775 |
| <code>gladia-default</code> | Third-Party Service Diarization | supported | 96.58 | 3.42% | 3.19% | 38.18s | $0.4106 |
| <code>glm-stt-glm-asr-2512</code> | Third-Party Service Non-Diarization | not-supported | 93.95 | 6.05% | 5.25% | 166.00s | $0.0969 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 92.01 | 7.99% | 7.60% | 41.36s | $0.0673 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.78 | 4.22% | 3.42% | 30.43s | $0.0747 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 96.07 | 3.93% | 3.13% | 27.66s | $0.0269 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 98.98 | 1.02% | 0.99% | 95.74s | $0.00 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 97.13 | 2.87% | 2.75% | 28.38s | $0.1212 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 86.59 | 13.41% | 12.68% | 68.84s | $0.1212 |
| <code>openai-stt-gpt-4o-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 87.01 | 12.99% | 12.26% | 104.08s | $0.2423 |
| <code>rev-low_cost</code> | Third-Party Service Diarization | supported | 93.43 | 6.57% | 6.10% | 209.12s | $0.0673 |
| <code>rev-machine</code> | Third-Party Service Diarization | supported | 94.09 | 5.91% | 5.45% | 229.50s | $0.1347 |
| <code>soniox-stt-async-v4</code> | Third-Party Service Diarization | supported | 96.20 | 3.80% | 3.68% | 158.36s | $0.0673 |
| <code>speechmatics-enhanced</code> | Third-Party Service Diarization | supported | 96.40 | 3.60% | 3.45% | 111.51s | $0.5048 |
| <code>speechmatics-standard</code> | Third-Party Service Diarization | supported | 95.12 | 4.88% | 4.71% | 79.62s | $0.3029 |
| <code>supadata-auto</code> | Third-Party Service Non-Diarization | not-supported | 95.85 | 4.15% | 3.34% | 11.23s | $0.00 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.95 | 4.05% | 3.26% | 5.52s | $0.0606 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | 433 | 223 | 251 | 8220 |
| <code>whisper-base</code> | 283 | 175 | 108 | 8220 |
| <code>whisper-large-v3-turbo</code> | 145 | 107 | 70 | 8220 |
| <code>whisper-medium</code> | 218 | 134 | 84 | 8220 |
| <code>whisper-small</code> | 183 | 152 | 67 | 8220 |
| <code>whisper-tiny</code> | 421 | 215 | 142 | 8220 |
| <code>assemblyai-universal-3-pro</code> | 22 | 11 | 10 | 8220 |
| <code>deepgram-nova-3</code> | 161 | 153 | 91 | 8220 |
| <code>deepinfra-openai_whisper-large-v3</code> | 126 | 125 | 58 | 8220 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 130 | 135 | 60 | 8220 |
| <code>elevenlabs-scribe_v2</code> | 134 | 92 | 93 | 8220 |
| <code>gemini-stt-gemini-3-flash-preview</code> | -1 | -1 | -1 | 8220 |
| <code>gladia-default</code> | 132 | 72 | 77 | 8220 |
| <code>glm-stt-glm-asr-2512</code> | 248 | 176 | 73 | 8220 |
| <code>grok-speech-to-text</code> | 206 | 366 | 85 | 8220 |
| <code>groq-whisper-large-v3</code> | 144 | 137 | 66 | 8220 |
| <code>groq-whisper-large-v3-turbo</code> | 138 | 126 | 59 | 8220 |
| <code>happyscribe-auto</code> | 44 | 17 | 23 | 8220 |
| <code>mistral-voxtral-mini-2602</code> | 121 | 42 | 73 | 8220 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | 120 | 926 | 56 | 8220 |
| <code>openai-stt-gpt-4o-transcribe</code> | 125 | 896 | 47 | 8220 |
| <code>rev-low_cost</code> | 316 | 99 | 125 | 8220 |
| <code>rev-machine</code> | 290 | 74 | 122 | 8220 |
| <code>soniox-stt-async-v4</code> | 154 | 47 | 111 | 8220 |
| <code>speechmatics-enhanced</code> | 152 | 72 | 72 | 8220 |
| <code>speechmatics-standard</code> | 216 | 78 | 107 | 8220 |
| <code>supadata-auto</code> | 143 | 120 | 78 | 8220 |
| <code>together-openai_whisper-large-v3</code> | 147 | 120 | 66 | 8220 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | 405 | 180 | 242 | 8149 |
| <code>whisper-base</code> | 271 | 114 | 117 | 8149 |
| <code>whisper-large-v3-turbo</code> | 138 | 42 | 75 | 8149 |
| <code>whisper-medium</code> | 205 | 73 | 93 | 8149 |
| <code>whisper-small</code> | 176 | 87 | 72 | 8149 |
| <code>whisper-tiny</code> | 410 | 153 | 150 | 8149 |
| <code>assemblyai-universal-3-pro</code> | 22 | 10 | 9 | 8149 |
| <code>deepgram-nova-3</code> | 156 | 94 | 69 | 8149 |
| <code>deepinfra-openai_whisper-large-v3</code> | 123 | 57 | 60 | 8149 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 127 | 67 | 62 | 8149 |
| <code>elevenlabs-scribe_v2</code> | 128 | 48 | 77 | 8149 |
| <code>gemini-stt-gemini-3-flash-preview</code> | -1 | -1 | -1 | 8149 |
| <code>gladia-default</code> | 131 | 58 | 71 | 8149 |
| <code>glm-stt-glm-asr-2512</code> | 241 | 110 | 77 | 8149 |
| <code>grok-speech-to-text</code> | 206 | 334 | 79 | 8149 |
| <code>groq-whisper-large-v3</code> | 136 | 72 | 71 | 8149 |
| <code>groq-whisper-large-v3-turbo</code> | 134 | 59 | 62 | 8149 |
| <code>happyscribe-auto</code> | 43 | 15 | 23 | 8149 |
| <code>mistral-voxtral-mini-2602</code> | 118 | 37 | 69 | 8149 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | 115 | 859 | 59 | 8149 |
| <code>openai-stt-gpt-4o-transcribe</code> | 118 | 830 | 51 | 8149 |
| <code>rev-low_cost</code> | 286 | 91 | 120 | 8149 |
| <code>rev-machine</code> | 263 | 65 | 116 | 8149 |
| <code>soniox-stt-async-v4</code> | 155 | 40 | 105 | 8149 |
| <code>speechmatics-enhanced</code> | 152 | 63 | 66 | 8149 |
| <code>speechmatics-standard</code> | 213 | 71 | 100 | 8149 |
| <code>supadata-auto</code> | 138 | 53 | 81 | 8149 |
| <code>together-openai_whisper-large-v3</code> | 140 | 55 | 71 | 8149 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>whisper-medium</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>glm-stt-glm-asr-2512</code> | GLM returned all-zero-duration segment timing. |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| <code>openai-stt-gpt-4o-transcribe</code> | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-universal-3-pro` was the most accurate provider on strict speaker-aware WER, scoring 99.48/100.
- `together-openai_whisper-large-v3` was the fastest provider in this set at 5.52s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 1.01 percentage-point gap between text-only and speaker-aware WER.
