# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/stt/2026-05-21_05-43-53-081_2023-04-05-jsjam-react-miami-2023-10-minutes`
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
| 1 | <code>reverb/reverb_asr_v1</code> | $0.00 local monetary cost | 91.46 | 8.54% | 8.32% | supported | 714.68s | $0.00 |
| 2 | <code>whisper-base</code> | $0.00 local monetary cost | 88.38 | 11.62% | 10.95% | not-supported | 11.74s | $0.00 |
| 3 | <code>whisper-large-v3-turbo</code> | $0.00 local monetary cost | 94.07 | 5.93% | 4.95% | not-supported | 38.74s | $0.00 |
| 4 | <code>whisper-medium</code> | $0.00 local monetary cost | 94.79 | 5.21% | 4.28% | not-supported | 50.31s | $0.00 |
| 5 | <code>whisper-small</code> | $0.00 local monetary cost | 90.80 | 9.20% | 8.44% | not-supported | 23.77s | $0.00 |
| 6 | <code>whisper-tiny</code> | $0.00 local monetary cost | 91.28 | 8.72% | 7.89% | not-supported | 9.92s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>whisper-tiny</code> | 9.92s | 91.28 | 8.72% | 7.89% | not-supported | 9.92s | $0.00 |
| 2 | <code>whisper-base</code> | 11.74s | 88.38 | 11.62% | 10.95% | not-supported | 11.74s | $0.00 |
| 3 | <code>whisper-small</code> | 23.77s | 90.80 | 9.20% | 8.44% | not-supported | 23.77s | $0.00 |
| 4 | <code>whisper-large-v3-turbo</code> | 38.74s | 94.07 | 5.93% | 4.95% | not-supported | 38.74s | $0.00 |
| 5 | <code>whisper-medium</code> | 50.31s | 94.79 | 5.21% | 4.28% | not-supported | 50.31s | $0.00 |
| 6 | <code>reverb/reverb_asr_v1</code> | 714.68s | 91.46 | 8.54% | 8.32% | supported | 714.68s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>whisper-medium</code> | 94.79/100 quality score | 94.79 | 5.21% | 4.28% | not-supported | 50.31s | $0.00 |
| 2 | <code>whisper-large-v3-turbo</code> | 94.07/100 quality score | 94.07 | 5.93% | 4.95% | not-supported | 38.74s | $0.00 |
| 3 | <code>reverb/reverb_asr_v1</code> | 91.46/100 quality score | 91.46 | 8.54% | 8.32% | supported | 714.68s | $0.00 |
| 4 | <code>whisper-tiny</code> | 91.28/100 quality score | 91.28 | 8.72% | 7.89% | not-supported | 9.92s | $0.00 |
| 5 | <code>whisper-small</code> | 90.80/100 quality score | 90.80 | 9.20% | 8.44% | not-supported | 23.77s | $0.00 |
| 6 | <code>whisper-base</code> | 88.38/100 quality score | 88.38 | 11.62% | 10.95% | not-supported | 11.74s | $0.00 |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0020 | 95.10 | 4.90% | 3.98% | not-supported | 6.74s | $0.0020 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0045 | 95.46 | 4.54% | 3.61% | not-supported | 7.40s | $0.0045 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0067 | 95.58 | 4.42% | 3.55% | not-supported | 8.59s | $0.0067 |
| 4 | <code>together-openai_whisper-large-v3</code> | $0.0150 | 93.95 | 6.05% | 5.08% | not-supported | 2.46s | $0.0150 |
| 5 | <code>groq-whisper-large-v3</code> | $0.0185 | 95.52 | 4.48% | 3.49% | not-supported | 8.34s | $0.0185 |
| 6 | <code>gemini-stt-gemini-3-flash-preview</code> | $0.0192 | 87.29 | 12.71% | 12.11% | not-supported | 132.60s | $0.0192 |
| 7 | <code>glm-stt-glm-asr-2512</code> | $0.0240 | 91.10 | 8.90% | 8.01% | not-supported | 57.81s | $0.0240 |
| 8 | <code>openai-stt-gpt-4o-mini-transcribe</code> | $0.0300 | 93.16 | 6.84% | 5.99% | not-supported | 14.68s | $0.0300 |
| 9 | <code>openai-stt-gpt-4o-transcribe</code> | $0.0600 | 95.22 | 4.78% | 3.91% | not-supported | 24.23s | $0.0600 |
| 10 | <code>supadata-auto</code> | $0.2000 | 95.40 | 4.60% | 3.67% | not-supported | 6.26s | $0.2000 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>together-openai_whisper-large-v3</code> | 2.46s | 93.95 | 6.05% | 5.08% | not-supported | 2.46s | $0.0150 |
| 2 | <code>supadata-auto</code> | 6.26s | 95.40 | 4.60% | 3.67% | not-supported | 6.26s | $0.2000 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 6.74s | 95.10 | 4.90% | 3.98% | not-supported | 6.74s | $0.0020 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | 7.40s | 95.46 | 4.54% | 3.61% | not-supported | 7.40s | $0.0045 |
| 5 | <code>groq-whisper-large-v3</code> | 8.34s | 95.52 | 4.48% | 3.49% | not-supported | 8.34s | $0.0185 |
| 6 | <code>groq-whisper-large-v3-turbo</code> | 8.59s | 95.58 | 4.42% | 3.55% | not-supported | 8.59s | $0.0067 |
| 7 | <code>openai-stt-gpt-4o-mini-transcribe</code> | 14.68s | 93.16 | 6.84% | 5.99% | not-supported | 14.68s | $0.0300 |
| 8 | <code>openai-stt-gpt-4o-transcribe</code> | 24.23s | 95.22 | 4.78% | 3.91% | not-supported | 24.23s | $0.0600 |
| 9 | <code>glm-stt-glm-asr-2512</code> | 57.81s | 91.10 | 8.90% | 8.01% | not-supported | 57.81s | $0.0240 |
| 10 | <code>gemini-stt-gemini-3-flash-preview</code> | 132.60s | 87.29 | 12.71% | 12.11% | not-supported | 132.60s | $0.0192 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>groq-whisper-large-v3-turbo</code> | 95.58/100 quality score | 95.58 | 4.42% | 3.55% | not-supported | 8.59s | $0.0067 |
| 2 | <code>groq-whisper-large-v3</code> | 95.52/100 quality score | 95.52 | 4.48% | 3.49% | not-supported | 8.34s | $0.0185 |
| 3 | <code>deepinfra-openai_whisper-large-v3</code> | 95.46/100 quality score | 95.46 | 4.54% | 3.61% | not-supported | 7.40s | $0.0045 |
| 4 | <code>supadata-auto</code> | 95.40/100 quality score | 95.40 | 4.60% | 3.67% | not-supported | 6.26s | $0.2000 |
| 5 | <code>openai-stt-gpt-4o-transcribe</code> | 95.22/100 quality score | 95.22 | 4.78% | 3.91% | not-supported | 24.23s | $0.0600 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 95.10/100 quality score | 95.10 | 4.90% | 3.98% | not-supported | 6.74s | $0.0020 |
| 7 | <code>together-openai_whisper-large-v3</code> | 93.95/100 quality score | 93.95 | 6.05% | 5.08% | not-supported | 2.46s | $0.0150 |
| 8 | <code>openai-stt-gpt-4o-mini-transcribe</code> | 93.16/100 quality score | 93.16 | 6.84% | 5.99% | not-supported | 14.68s | $0.0300 |
| 9 | <code>glm-stt-glm-asr-2512</code> | 91.10/100 quality score | 91.10 | 8.90% | 8.01% | not-supported | 57.81s | $0.0240 |
| 10 | <code>gemini-stt-gemini-3-flash-preview</code> | 87.29/100 quality score | 87.29 | 12.71% | 12.11% | not-supported | 132.60s | $0.0192 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>happyscribe-auto</code> | $0.00 | 94.25 | 5.75% | 5.32% | supported | 61.69s | $0.00 |
| 2 | <code>grok-speech-to-text</code> | $0.0167 | 87.41 | 12.59% | 12.54% | supported | 9.19s | $0.0167 |
| 3 | <code>rev-low_cost</code> | $0.0167 | 90.13 | 9.87% | 9.72% | supported | 66.05s | $0.0167 |
| 4 | <code>soniox-stt-async-v4</code> | $0.0167 | 90.68 | 9.32% | 8.87% | supported | 46.76s | $0.0167 |
| 5 | <code>mistral-voxtral-mini-2602</code> | $0.0300 | 96.37 | 3.63% | 3.43% | supported | 12.06s | $0.0300 |
| 6 | <code>rev-machine</code> | $0.0333 | 90.68 | 9.32% | 9.17% | supported | 85.17s | $0.0333 |
| 7 | <code>assemblyai-universal-3-pro</code> | $0.0350 | 93.58 | 6.42% | 5.81% | supported | 17.43s | $0.0350 |
| 8 | <code>elevenlabs-scribe_v2</code> | $0.0367 | 88.86 | 11.14% | 10.15% | supported | 24.57s | $0.0367 |
| 9 | <code>speechmatics-standard</code> | $0.0750 | 91.46 | 8.54% | 8.13% | supported | 17.66s | $0.0750 |
| 10 | <code>deepgram-nova-3</code> | $0.0970 | 90.01 | 9.99% | 9.54% | supported | 2.84s | $0.0970 |
| 11 | <code>gladia-default</code> | $0.1017 | 94.79 | 5.21% | 4.83% | supported | 21.07s | $0.1017 |
| 12 | <code>speechmatics-enhanced</code> | $0.1250 | 92.86 | 7.14% | 6.79% | supported | 30.05s | $0.1250 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 2.84s | 90.01 | 9.99% | 9.54% | supported | 2.84s | $0.0970 |
| 2 | <code>grok-speech-to-text</code> | 9.19s | 87.41 | 12.59% | 12.54% | supported | 9.19s | $0.0167 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 12.06s | 96.37 | 3.63% | 3.43% | supported | 12.06s | $0.0300 |
| 4 | <code>assemblyai-universal-3-pro</code> | 17.43s | 93.58 | 6.42% | 5.81% | supported | 17.43s | $0.0350 |
| 5 | <code>speechmatics-standard</code> | 17.66s | 91.46 | 8.54% | 8.13% | supported | 17.66s | $0.0750 |
| 6 | <code>gladia-default</code> | 21.07s | 94.79 | 5.21% | 4.83% | supported | 21.07s | $0.1017 |
| 7 | <code>elevenlabs-scribe_v2</code> | 24.57s | 88.86 | 11.14% | 10.15% | supported | 24.57s | $0.0367 |
| 8 | <code>speechmatics-enhanced</code> | 30.05s | 92.86 | 7.14% | 6.79% | supported | 30.05s | $0.1250 |
| 9 | <code>soniox-stt-async-v4</code> | 46.76s | 90.68 | 9.32% | 8.87% | supported | 46.76s | $0.0167 |
| 11 | <code>happyscribe-auto</code> | 61.69s | 94.25 | 5.75% | 5.32% | supported | 61.69s | $0.00 |
| 12 | <code>rev-low_cost</code> | 66.05s | 90.13 | 9.87% | 9.72% | supported | 66.05s | $0.0167 |
| 13 | <code>rev-machine</code> | 85.17s | 90.68 | 9.32% | 9.17% | supported | 85.17s | $0.0333 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>mistral-voxtral-mini-2602</code> | 96.37/100 quality score | 96.37 | 3.63% | 3.43% | supported | 12.06s | $0.0300 |
| 2 | <code>gladia-default</code> | 94.79/100 quality score | 94.79 | 5.21% | 4.83% | supported | 21.07s | $0.1017 |
| 3 | <code>happyscribe-auto</code> | 94.25/100 quality score | 94.25 | 5.75% | 5.32% | supported | 61.69s | $0.00 |
| 4 | <code>assemblyai-universal-3-pro</code> | 93.58/100 quality score | 93.58 | 6.42% | 5.81% | supported | 17.43s | $0.0350 |
| 5 | <code>speechmatics-enhanced</code> | 92.86/100 quality score | 92.86 | 7.14% | 6.79% | supported | 30.05s | $0.1250 |
| 6 | <code>speechmatics-standard</code> | 91.46/100 quality score | 91.46 | 8.54% | 8.13% | supported | 17.66s | $0.0750 |
| 8 | <code>soniox-stt-async-v4</code> | 90.68/100 quality score | 90.68 | 9.32% | 8.87% | supported | 46.76s | $0.0167 |
| 9 | <code>rev-machine</code> | 90.68/100 quality score | 90.68 | 9.32% | 9.17% | supported | 85.17s | $0.0333 |
| 10 | <code>rev-low_cost</code> | 90.13/100 quality score | 90.13 | 9.87% | 9.72% | supported | 66.05s | $0.0167 |
| 11 | <code>deepgram-nova-3</code> | 90.01/100 quality score | 90.01 | 9.99% | 9.54% | supported | 2.84s | $0.0970 |
| 13 | <code>elevenlabs-scribe_v2</code> | 88.86/100 quality score | 88.86 | 11.14% | 10.15% | supported | 24.57s | $0.0367 |
| 14 | <code>grok-speech-to-text</code> | 87.41/100 quality score | 87.41 | 12.59% | 12.54% | supported | 9.19s | $0.0167 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | Local | supported | 91.46 | 8.54% | 8.32% | 714.68s | $0.00 |
| <code>whisper-base</code> | Local | not-supported | 88.38 | 11.62% | 10.95% | 11.74s | $0.00 |
| <code>whisper-large-v3-turbo</code> | Local | not-supported | 94.07 | 5.93% | 4.95% | 38.74s | $0.00 |
| <code>whisper-medium</code> | Local | not-supported | 94.79 | 5.21% | 4.28% | 50.31s | $0.00 |
| <code>whisper-small</code> | Local | not-supported | 90.80 | 9.20% | 8.44% | 23.77s | $0.00 |
| <code>whisper-tiny</code> | Local | not-supported | 91.28 | 8.72% | 7.89% | 9.92s | $0.00 |
| <code>assemblyai-universal-3-pro</code> | Third-Party Service Diarization | supported | 93.58 | 6.42% | 5.81% | 17.43s | $0.0350 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 90.01 | 9.99% | 9.54% | 2.84s | $0.0970 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.46 | 4.54% | 3.61% | 7.40s | $0.0045 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 95.10 | 4.90% | 3.98% | 6.74s | $0.0020 |
| <code>elevenlabs-scribe_v2</code> | Third-Party Service Diarization | supported | 88.86 | 11.14% | 10.15% | 24.57s | $0.0367 |
| <code>gemini-stt-gemini-3-flash-preview</code> | Third-Party Service Non-Diarization | not-supported | 87.29 | 12.71% | 12.11% | 132.60s | $0.0192 |
| <code>gladia-default</code> | Third-Party Service Diarization | supported | 94.79 | 5.21% | 4.83% | 21.07s | $0.1017 |
| <code>glm-stt-glm-asr-2512</code> | Third-Party Service Non-Diarization | not-supported | 91.10 | 8.90% | 8.01% | 57.81s | $0.0240 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 87.41 | 12.59% | 12.54% | 9.19s | $0.0167 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.52 | 4.48% | 3.49% | 8.34s | $0.0185 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 95.58 | 4.42% | 3.55% | 8.59s | $0.0067 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 94.25 | 5.75% | 5.32% | 61.69s | $0.00 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 96.37 | 3.63% | 3.43% | 12.06s | $0.0300 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 93.16 | 6.84% | 5.99% | 14.68s | $0.0300 |
| <code>openai-stt-gpt-4o-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 95.22 | 4.78% | 3.91% | 24.23s | $0.0600 |
| <code>rev-low_cost</code> | Third-Party Service Diarization | supported | 90.13 | 9.87% | 9.72% | 66.05s | $0.0167 |
| <code>rev-machine</code> | Third-Party Service Diarization | supported | 90.68 | 9.32% | 9.17% | 85.17s | $0.0333 |
| <code>soniox-stt-async-v4</code> | Third-Party Service Diarization | supported | 90.68 | 9.32% | 8.87% | 46.76s | $0.0167 |
| <code>speechmatics-enhanced</code> | Third-Party Service Diarization | supported | 92.86 | 7.14% | 6.79% | 30.05s | $0.1250 |
| <code>speechmatics-standard</code> | Third-Party Service Diarization | supported | 91.46 | 8.54% | 8.13% | 17.66s | $0.0750 |
| <code>supadata-auto</code> | Third-Party Service Non-Diarization | not-supported | 95.40 | 4.60% | 3.67% | 6.26s | $0.2000 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.95 | 6.05% | 5.08% | 2.46s | $0.0150 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | 55 | 44 | 42 | 1652 |
| <code>whisper-base</code> | 84 | 35 | 73 | 1652 |
| <code>whisper-large-v3-turbo</code> | 33 | 21 | 44 | 1652 |
| <code>whisper-medium</code> | 30 | 32 | 24 | 1652 |
| <code>whisper-small</code> | 45 | 28 | 79 | 1652 |
| <code>whisper-tiny</code> | 75 | 45 | 24 | 1652 |
| <code>assemblyai-universal-3-pro</code> | 38 | 18 | 50 | 1652 |
| <code>deepgram-nova-3</code> | 43 | 34 | 88 | 1652 |
| <code>deepinfra-openai_whisper-large-v3</code> | 25 | 29 | 21 | 1652 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 27 | 31 | 23 | 1652 |
| <code>elevenlabs-scribe_v2</code> | 46 | 27 | 111 | 1652 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 31 | 102 | 77 | 1652 |
| <code>gladia-default</code> | 29 | 19 | 38 | 1652 |
| <code>glm-stt-glm-asr-2512</code> | 56 | 51 | 40 | 1652 |
| <code>grok-speech-to-text</code> | 50 | 76 | 82 | 1652 |
| <code>groq-whisper-large-v3</code> | 21 | 28 | 25 | 1652 |
| <code>groq-whisper-large-v3-turbo</code> | 25 | 28 | 20 | 1652 |
| <code>happyscribe-auto</code> | 28 | 17 | 50 | 1652 |
| <code>mistral-voxtral-mini-2602</code> | 20 | 11 | 29 | 1652 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | 33 | 28 | 52 | 1652 |
| <code>openai-stt-gpt-4o-transcribe</code> | 27 | 25 | 27 | 1652 |
| <code>rev-low_cost</code> | 57 | 29 | 77 | 1652 |
| <code>rev-machine</code> | 51 | 23 | 80 | 1652 |
| <code>soniox-stt-async-v4</code> | 41 | 15 | 98 | 1652 |
| <code>speechmatics-enhanced</code> | 33 | 10 | 75 | 1652 |
| <code>speechmatics-standard</code> | 45 | 11 | 85 | 1652 |
| <code>supadata-auto</code> | 27 | 29 | 20 | 1652 |
| <code>together-openai_whisper-large-v3</code> | 28 | 35 | 37 | 1652 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | 54 | 41 | 41 | 1635 |
| <code>whisper-base</code> | 79 | 23 | 77 | 1635 |
| <code>whisper-large-v3-turbo</code> | 32 | 5 | 44 | 1635 |
| <code>whisper-medium</code> | 28 | 17 | 25 | 1635 |
| <code>whisper-small</code> | 41 | 15 | 82 | 1635 |
| <code>whisper-tiny</code> | 72 | 31 | 26 | 1635 |
| <code>assemblyai-universal-3-pro</code> | 32 | 18 | 45 | 1635 |
| <code>deepgram-nova-3</code> | 40 | 32 | 84 | 1635 |
| <code>deepinfra-openai_whisper-large-v3</code> | 23 | 14 | 22 | 1635 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 25 | 16 | 24 | 1635 |
| <code>elevenlabs-scribe_v2</code> | 43 | 19 | 104 | 1635 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 25 | 91 | 82 | 1635 |
| <code>gladia-default</code> | 26 | 18 | 35 | 1635 |
| <code>glm-stt-glm-asr-2512</code> | 50 | 38 | 43 | 1635 |
| <code>grok-speech-to-text</code> | 51 | 74 | 80 | 1635 |
| <code>groq-whisper-large-v3</code> | 20 | 12 | 25 | 1635 |
| <code>groq-whisper-large-v3-turbo</code> | 22 | 14 | 22 | 1635 |
| <code>happyscribe-auto</code> | 24 | 16 | 47 | 1635 |
| <code>mistral-voxtral-mini-2602</code> | 20 | 9 | 27 | 1635 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | 28 | 15 | 55 | 1635 |
| <code>openai-stt-gpt-4o-transcribe</code> | 24 | 11 | 29 | 1635 |
| <code>rev-low_cost</code> | 55 | 28 | 76 | 1635 |
| <code>rev-machine</code> | 49 | 22 | 79 | 1635 |
| <code>soniox-stt-async-v4</code> | 42 | 14 | 89 | 1635 |
| <code>speechmatics-enhanced</code> | 30 | 10 | 71 | 1635 |
| <code>speechmatics-standard</code> | 41 | 11 | 81 | 1635 |
| <code>supadata-auto</code> | 23 | 15 | 22 | 1635 |
| <code>together-openai_whisper-large-v3</code> | 27 | 19 | 37 | 1635 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>whisper-medium</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>whisper-tiny</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>glm-stt-glm-asr-2512</code> | GLM returned all-zero-duration segment timing. |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| <code>openai-stt-gpt-4o-transcribe</code> | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `mistral-voxtral-mini-2602` was the most accurate provider on strict speaker-aware WER, scoring 96.37/100.
- The cheapest providers were `happyscribe-auto` and `reverb-reverb` at 0.0000¢ ($0.0000).
- `together-openai_whisper-large-v3` was the fastest provider in this set at 2.46s.
