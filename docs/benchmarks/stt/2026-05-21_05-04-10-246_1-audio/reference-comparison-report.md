# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/stt/2026-05-21_05-04-10-246_1-audio`
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
| 1 | <code>reverb/reverb_asr_v1</code> | $0.00 local monetary cost | 89.55 | 10.45% | 9.72% | supported | 89.89s | $0.00 |
| 2 | <code>whisper-base</code> | $0.00 local monetary cost | 92.73 | 7.27% | 5.56% | not-supported | 1.43s | $0.00 |
| 3 | <code>whisper-large-v3-turbo</code> | $0.00 local monetary cost | 92.27 | 7.73% | 6.02% | not-supported | 5.11s | $0.00 |
| 4 | <code>whisper-medium</code> | $0.00 local monetary cost | 93.64 | 6.36% | 4.63% | not-supported | 7.06s | $0.00 |
| 5 | <code>whisper-small</code> | $0.00 local monetary cost | 90.00 | 10.00% | 8.33% | not-supported | 2.37s | $0.00 |
| 6 | <code>whisper-tiny</code> | $0.00 local monetary cost | 86.36 | 13.64% | 12.04% | not-supported | 12.02s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>whisper-base</code> | 1.43s | 92.73 | 7.27% | 5.56% | not-supported | 1.43s | $0.00 |
| 2 | <code>whisper-small</code> | 2.37s | 90.00 | 10.00% | 8.33% | not-supported | 2.37s | $0.00 |
| 3 | <code>whisper-large-v3-turbo</code> | 5.11s | 92.27 | 7.73% | 6.02% | not-supported | 5.11s | $0.00 |
| 4 | <code>whisper-medium</code> | 7.06s | 93.64 | 6.36% | 4.63% | not-supported | 7.06s | $0.00 |
| 5 | <code>whisper-tiny</code> | 12.02s | 86.36 | 13.64% | 12.04% | not-supported | 12.02s | $0.00 |
| 6 | <code>reverb/reverb_asr_v1</code> | 89.89s | 89.55 | 10.45% | 9.72% | supported | 89.89s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>whisper-medium</code> | 93.64/100 quality score | 93.64 | 6.36% | 4.63% | not-supported | 7.06s | $0.00 |
| 2 | <code>whisper-base</code> | 92.73/100 quality score | 92.73 | 7.27% | 5.56% | not-supported | 1.43s | $0.00 |
| 3 | <code>whisper-large-v3-turbo</code> | 92.27/100 quality score | 92.27 | 7.73% | 6.02% | not-supported | 5.11s | $0.00 |
| 4 | <code>whisper-small</code> | 90.00/100 quality score | 90.00 | 10.00% | 8.33% | not-supported | 2.37s | $0.00 |
| 5 | <code>reverb/reverb_asr_v1</code> | 89.55/100 quality score | 89.55 | 10.45% | 9.72% | supported | 89.89s | $0.00 |
| 6 | <code>whisper-tiny</code> | 86.36/100 quality score | 86.36 | 13.64% | 12.04% | not-supported | 12.02s | $0.00 |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0002 | 93.18 | 6.82% | 5.09% | not-supported | 1.90s | $0.0002 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0004 | 93.64 | 6.36% | 4.63% | not-supported | 2.12s | $0.0004 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0007 | 92.73 | 7.27% | 5.56% | not-supported | 1.60s | $0.0007 |
| 4 | <code>together-openai_whisper-large-v3</code> | $0.0015 | 93.18 | 6.82% | 5.09% | not-supported | 1.81s | $0.0015 |
| 5 | <code>groq-whisper-large-v3</code> | $0.0018 | 93.18 | 6.82% | 5.09% | not-supported | 2.02s | $0.0018 |
| 6 | <code>gemini-stt-gemini-3-flash-preview</code> | $0.0019 | 91.82 | 8.18% | 6.48% | not-supported | 48.73s | $0.0019 |
| 7 | <code>glm-stt-glm-asr-2512</code> | $0.0024 | 91.36 | 8.64% | 6.94% | not-supported | 8.23s | $0.0024 |
| 8 | <code>openai-stt-gpt-4o-mini-transcribe</code> | $0.0030 | 94.09 | 5.91% | 4.17% | not-supported | 3.71s | $0.0030 |
| 9 | <code>openai-stt-gpt-4o-transcribe</code> | $0.0060 | 94.09 | 5.91% | 4.17% | not-supported | 3.82s | $0.0060 |
| 10 | <code>supadata-auto</code> | $0.0200 | 92.27 | 7.73% | 6.02% | not-supported | 4.01s | $0.0200 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>groq-whisper-large-v3-turbo</code> | 1.60s | 92.73 | 7.27% | 5.56% | not-supported | 1.60s | $0.0007 |
| 2 | <code>together-openai_whisper-large-v3</code> | 1.81s | 93.18 | 6.82% | 5.09% | not-supported | 1.81s | $0.0015 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 1.90s | 93.18 | 6.82% | 5.09% | not-supported | 1.90s | $0.0002 |
| 4 | <code>groq-whisper-large-v3</code> | 2.02s | 93.18 | 6.82% | 5.09% | not-supported | 2.02s | $0.0018 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | 2.12s | 93.64 | 6.36% | 4.63% | not-supported | 2.12s | $0.0004 |
| 6 | <code>openai-stt-gpt-4o-mini-transcribe</code> | 3.71s | 94.09 | 5.91% | 4.17% | not-supported | 3.71s | $0.0030 |
| 7 | <code>openai-stt-gpt-4o-transcribe</code> | 3.82s | 94.09 | 5.91% | 4.17% | not-supported | 3.82s | $0.0060 |
| 8 | <code>supadata-auto</code> | 4.01s | 92.27 | 7.73% | 6.02% | not-supported | 4.01s | $0.0200 |
| 9 | <code>glm-stt-glm-asr-2512</code> | 8.23s | 91.36 | 8.64% | 6.94% | not-supported | 8.23s | $0.0024 |
| 10 | <code>gemini-stt-gemini-3-flash-preview</code> | 48.73s | 91.82 | 8.18% | 6.48% | not-supported | 48.73s | $0.0019 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>openai-stt-gpt-4o-mini-transcribe</code> | 94.09/100 quality score | 94.09 | 5.91% | 4.17% | not-supported | 3.71s | $0.0030 |
| 2 | <code>openai-stt-gpt-4o-transcribe</code> | 94.09/100 quality score | 94.09 | 5.91% | 4.17% | not-supported | 3.82s | $0.0060 |
| 3 | <code>deepinfra-openai_whisper-large-v3</code> | 93.64/100 quality score | 93.64 | 6.36% | 4.63% | not-supported | 2.12s | $0.0004 |
| 4 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 1.90s | $0.0002 |
| 5 | <code>groq-whisper-large-v3</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 2.02s | $0.0018 |
| 6 | <code>together-openai_whisper-large-v3</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 1.81s | $0.0015 |
| 7 | <code>groq-whisper-large-v3-turbo</code> | 92.73/100 quality score | 92.73 | 7.27% | 5.56% | not-supported | 1.60s | $0.0007 |
| 8 | <code>supadata-auto</code> | 92.27/100 quality score | 92.27 | 7.73% | 6.02% | not-supported | 4.01s | $0.0200 |
| 9 | <code>gemini-stt-gemini-3-flash-preview</code> | 91.82/100 quality score | 91.82 | 8.18% | 6.48% | not-supported | 48.73s | $0.0019 |
| 10 | <code>glm-stt-glm-asr-2512</code> | 91.36/100 quality score | 91.36 | 8.64% | 6.94% | not-supported | 8.23s | $0.0024 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>happyscribe-auto</code> | $0.00 | 99.55 | 0.45% | 0.46% | supported | 60.19s | $0.00 |
| 2 | <code>grok-speech-to-text</code> | $0.0017 | 85.91 | 14.09% | 14.35% | supported | 1.71s | $0.0017 |
| 3 | <code>soniox-stt-async-v4</code> | $0.0017 | 96.36 | 3.64% | 3.70% | supported | 7.69s | $0.0017 |
| 4 | <code>rev-low_cost</code> | $0.0017 | 92.27 | 7.73% | 6.94% | supported | 25.24s | $0.0017 |
| 5 | <code>mistral-voxtral-mini-2602</code> | $0.0030 | 95.91 | 4.09% | 4.17% | supported | 4.40s | $0.0030 |
| 6 | <code>rev-machine</code> | $0.0033 | 93.18 | 6.82% | 6.02% | supported | 24.64s | $0.0033 |
| 7 | <code>assemblyai-universal-3-pro</code> | $0.0035 | 100.00 | 0.00% | 0.00% | supported | 8.72s | $0.0035 |
| 8 | <code>elevenlabs-scribe_v2</code> | $0.0036 | 91.82 | 8.18% | 5.56% | supported | 5.18s | $0.0036 |
| 9 | <code>speechmatics-standard</code> | $0.0074 | 96.82 | 3.18% | 3.24% | supported | 8.34s | $0.0074 |
| 10 | <code>deepgram-nova-3</code> | $0.0096 | 92.27 | 7.73% | 6.02% | supported | 1.87s | $0.0096 |
| 11 | <code>gladia-default</code> | $0.0101 | 95.00 | 5.00% | 4.17% | supported | 18.71s | $0.0101 |
| 12 | <code>speechmatics-enhanced</code> | $0.0124 | 97.27 | 2.73% | 2.78% | supported | 9.58s | $0.0124 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>grok-speech-to-text</code> | 1.71s | 85.91 | 14.09% | 14.35% | supported | 1.71s | $0.0017 |
| 2 | <code>deepgram-nova-3</code> | 1.87s | 92.27 | 7.73% | 6.02% | supported | 1.87s | $0.0096 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 4.40s | 95.91 | 4.09% | 4.17% | supported | 4.40s | $0.0030 |
| 4 | <code>elevenlabs-scribe_v2</code> | 5.18s | 91.82 | 8.18% | 5.56% | supported | 5.18s | $0.0036 |
| 5 | <code>soniox-stt-async-v4</code> | 7.69s | 96.36 | 3.64% | 3.70% | supported | 7.69s | $0.0017 |
| 6 | <code>speechmatics-standard</code> | 8.34s | 96.82 | 3.18% | 3.24% | supported | 8.34s | $0.0074 |
| 7 | <code>assemblyai-universal-3-pro</code> | 8.72s | 100.00 | 0.00% | 0.00% | supported | 8.72s | $0.0035 |
| 8 | <code>speechmatics-enhanced</code> | 9.58s | 97.27 | 2.73% | 2.78% | supported | 9.58s | $0.0124 |
| 10 | <code>gladia-default</code> | 18.71s | 95.00 | 5.00% | 4.17% | supported | 18.71s | $0.0101 |
| 11 | <code>rev-machine</code> | 24.64s | 93.18 | 6.82% | 6.02% | supported | 24.64s | $0.0033 |
| 12 | <code>rev-low_cost</code> | 25.24s | 92.27 | 7.73% | 6.94% | supported | 25.24s | $0.0017 |
| 14 | <code>happyscribe-auto</code> | 60.19s | 99.55 | 0.45% | 0.46% | supported | 60.19s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>assemblyai-universal-3-pro</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | supported | 8.72s | $0.0035 |
| 2 | <code>happyscribe-auto</code> | 99.55/100 quality score | 99.55 | 0.45% | 0.46% | supported | 60.19s | $0.00 |
| 3 | <code>speechmatics-enhanced</code> | 97.27/100 quality score | 97.27 | 2.73% | 2.78% | supported | 9.58s | $0.0124 |
| 4 | <code>speechmatics-standard</code> | 96.82/100 quality score | 96.82 | 3.18% | 3.24% | supported | 8.34s | $0.0074 |
| 5 | <code>soniox-stt-async-v4</code> | 96.36/100 quality score | 96.36 | 3.64% | 3.70% | supported | 7.69s | $0.0017 |
| 7 | <code>mistral-voxtral-mini-2602</code> | 95.91/100 quality score | 95.91 | 4.09% | 4.17% | supported | 4.40s | $0.0030 |
| 8 | <code>gladia-default</code> | 95.00/100 quality score | 95.00 | 5.00% | 4.17% | supported | 18.71s | $0.0101 |
| 9 | <code>rev-machine</code> | 93.18/100 quality score | 93.18 | 6.82% | 6.02% | supported | 24.64s | $0.0033 |
| 11 | <code>deepgram-nova-3</code> | 92.27/100 quality score | 92.27 | 7.73% | 6.02% | supported | 1.87s | $0.0096 |
| 12 | <code>rev-low_cost</code> | 92.27/100 quality score | 92.27 | 7.73% | 6.94% | supported | 25.24s | $0.0017 |
| 13 | <code>elevenlabs-scribe_v2</code> | 91.82/100 quality score | 91.82 | 8.18% | 5.56% | supported | 5.18s | $0.0036 |
| 14 | <code>grok-speech-to-text</code> | 85.91/100 quality score | 85.91 | 14.09% | 14.35% | supported | 1.71s | $0.0017 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | Local | supported | 89.55 | 10.45% | 9.72% | 89.89s | $0.00 |
| <code>whisper-base</code> | Local | not-supported | 92.73 | 7.27% | 5.56% | 1.43s | $0.00 |
| <code>whisper-large-v3-turbo</code> | Local | not-supported | 92.27 | 7.73% | 6.02% | 5.11s | $0.00 |
| <code>whisper-medium</code> | Local | not-supported | 93.64 | 6.36% | 4.63% | 7.06s | $0.00 |
| <code>whisper-small</code> | Local | not-supported | 90.00 | 10.00% | 8.33% | 2.37s | $0.00 |
| <code>whisper-tiny</code> | Local | not-supported | 86.36 | 13.64% | 12.04% | 12.02s | $0.00 |
| <code>assemblyai-universal-3-pro</code> | Third-Party Service Diarization | supported | 100.00 | 0.00% | 0.00% | 8.72s | $0.0035 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 92.27 | 7.73% | 6.02% | 1.87s | $0.0096 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.64 | 6.36% | 4.63% | 2.12s | $0.0004 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 93.18 | 6.82% | 5.09% | 1.90s | $0.0002 |
| <code>elevenlabs-scribe_v2</code> | Third-Party Service Diarization | supported | 91.82 | 8.18% | 5.56% | 5.18s | $0.0036 |
| <code>gemini-stt-gemini-3-flash-preview</code> | Third-Party Service Non-Diarization | not-supported | 91.82 | 8.18% | 6.48% | 48.73s | $0.0019 |
| <code>gladia-default</code> | Third-Party Service Diarization | supported | 95.00 | 5.00% | 4.17% | 18.71s | $0.0101 |
| <code>glm-stt-glm-asr-2512</code> | Third-Party Service Non-Diarization | not-supported | 91.36 | 8.64% | 6.94% | 8.23s | $0.0024 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 85.91 | 14.09% | 14.35% | 1.71s | $0.0017 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.18 | 6.82% | 5.09% | 2.02s | $0.0018 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 92.73 | 7.27% | 5.56% | 1.60s | $0.0007 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 99.55 | 0.45% | 0.46% | 60.19s | $0.00 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 95.91 | 4.09% | 4.17% | 4.40s | $0.0030 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 94.09 | 5.91% | 4.17% | 3.71s | $0.0030 |
| <code>openai-stt-gpt-4o-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 94.09 | 5.91% | 4.17% | 3.82s | $0.0060 |
| <code>rev-low_cost</code> | Third-Party Service Diarization | supported | 92.27 | 7.73% | 6.94% | 25.24s | $0.0017 |
| <code>rev-machine</code> | Third-Party Service Diarization | supported | 93.18 | 6.82% | 6.02% | 24.64s | $0.0033 |
| <code>soniox-stt-async-v4</code> | Third-Party Service Diarization | supported | 96.36 | 3.64% | 3.70% | 7.69s | $0.0017 |
| <code>speechmatics-enhanced</code> | Third-Party Service Diarization | supported | 97.27 | 2.73% | 2.78% | 9.58s | $0.0124 |
| <code>speechmatics-standard</code> | Third-Party Service Diarization | supported | 96.82 | 3.18% | 3.24% | 8.34s | $0.0074 |
| <code>supadata-auto</code> | Third-Party Service Non-Diarization | not-supported | 92.27 | 7.73% | 6.02% | 4.01s | $0.0200 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.18 | 6.82% | 5.09% | 1.81s | $0.0015 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | 11 | 10 | 2 | 220 |
| <code>whisper-base</code> | 4 | 11 | 1 | 220 |
| <code>whisper-large-v3-turbo</code> | 2 | 12 | 3 | 220 |
| <code>whisper-medium</code> | 6 | 6 | 2 | 220 |
| <code>whisper-small</code> | 14 | 8 | 0 | 220 |
| <code>whisper-tiny</code> | 17 | 8 | 5 | 220 |
| <code>assemblyai-universal-3-pro</code> | 0 | 0 | 0 | 220 |
| <code>deepgram-nova-3</code> | 4 | 11 | 2 | 220 |
| <code>deepinfra-openai_whisper-large-v3</code> | 2 | 11 | 1 | 220 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 2 | 11 | 2 | 220 |
| <code>elevenlabs-scribe_v2</code> | 4 | 6 | 8 | 220 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 8 | 7 | 3 | 220 |
| <code>gladia-default</code> | 2 | 5 | 4 | 220 |
| <code>glm-stt-glm-asr-2512</code> | 8 | 11 | 0 | 220 |
| <code>grok-speech-to-text</code> | 7 | 19 | 5 | 220 |
| <code>groq-whisper-large-v3</code> | 4 | 8 | 3 | 220 |
| <code>groq-whisper-large-v3-turbo</code> | 4 | 8 | 4 | 220 |
| <code>happyscribe-auto</code> | 1 | 0 | 0 | 220 |
| <code>mistral-voxtral-mini-2602</code> | 0 | 8 | 1 | 220 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | 2 | 11 | 0 | 220 |
| <code>openai-stt-gpt-4o-transcribe</code> | 2 | 10 | 1 | 220 |
| <code>rev-low_cost</code> | 10 | 3 | 4 | 220 |
| <code>rev-machine</code> | 7 | 3 | 5 | 220 |
| <code>soniox-stt-async-v4</code> | 0 | 7 | 1 | 220 |
| <code>speechmatics-enhanced</code> | 1 | 4 | 1 | 220 |
| <code>speechmatics-standard</code> | 2 | 3 | 2 | 220 |
| <code>supadata-auto</code> | 4 | 8 | 5 | 220 |
| <code>together-openai_whisper-large-v3</code> | 2 | 12 | 1 | 220 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>reverb/reverb_asr_v1</code> | 11 | 9 | 1 | 216 |
| <code>whisper-base</code> | 3 | 8 | 1 | 216 |
| <code>whisper-large-v3-turbo</code> | 1 | 9 | 3 | 216 |
| <code>whisper-medium</code> | 5 | 3 | 2 | 216 |
| <code>whisper-small</code> | 13 | 5 | 0 | 216 |
| <code>whisper-tiny</code> | 16 | 5 | 5 | 216 |
| <code>assemblyai-universal-3-pro</code> | 0 | 0 | 0 | 216 |
| <code>deepgram-nova-3</code> | 4 | 8 | 1 | 216 |
| <code>deepinfra-openai_whisper-large-v3</code> | 1 | 8 | 1 | 216 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 1 | 8 | 2 | 216 |
| <code>elevenlabs-scribe_v2</code> | 4 | 3 | 5 | 216 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 7 | 4 | 3 | 216 |
| <code>gladia-default</code> | 2 | 4 | 3 | 216 |
| <code>glm-stt-glm-asr-2512</code> | 7 | 8 | 0 | 216 |
| <code>grok-speech-to-text</code> | 7 | 19 | 5 | 216 |
| <code>groq-whisper-large-v3</code> | 3 | 5 | 3 | 216 |
| <code>groq-whisper-large-v3-turbo</code> | 3 | 5 | 4 | 216 |
| <code>happyscribe-auto</code> | 1 | 0 | 0 | 216 |
| <code>mistral-voxtral-mini-2602</code> | 0 | 8 | 1 | 216 |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | 1 | 8 | 0 | 216 |
| <code>openai-stt-gpt-4o-transcribe</code> | 1 | 7 | 1 | 216 |
| <code>rev-low_cost</code> | 8 | 3 | 4 | 216 |
| <code>rev-machine</code> | 5 | 3 | 5 | 216 |
| <code>soniox-stt-async-v4</code> | 0 | 7 | 1 | 216 |
| <code>speechmatics-enhanced</code> | 1 | 4 | 1 | 216 |
| <code>speechmatics-standard</code> | 2 | 3 | 2 | 216 |
| <code>supadata-auto</code> | 3 | 5 | 5 | 216 |
| <code>together-openai_whisper-large-v3</code> | 1 | 9 | 1 | 216 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>whisper-base</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>whisper-medium</code> | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| <code>glm-stt-glm-asr-2512</code> | GLM returned all-zero-duration segment timing. |
| <code>openai-stt-gpt-4o-mini-transcribe</code> | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| <code>openai-stt-gpt-4o-transcribe</code> | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-universal-3-pro` was the most accurate provider on strict speaker-aware WER, scoring 100.00/100.
- The cheapest providers were `happyscribe-auto` and `reverb-reverb` at 0.0000¢ ($0.0000).
- `whisper-base` was the fastest provider in this set at 1.43s.
