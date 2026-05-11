# Consensus Transcript Comparison Report

## Summary

- Reference transcript: `consensus-transcription.txt`
- Compared providers:
  - `assemblyai-universal-3-pro`
  - `happyscribe-auto`
  - `mistral-voxtral-mini-2602`
  - `gemini-stt-gemini-3-flash-preview`
  - `openai-stt-gpt-4o-transcribe`
  - `openai-stt-gpt-4o-mini-transcribe`
  - `supadata-auto`
  - `supadata-generate`
  - `supadata-native`
  - `together-openai_whisper-large-v3`
  - `deepinfra-openai_whisper-large-v3-turbo`
  - `groq-whisper-large-v3`
  - `deepinfra-openai_whisper-large-v3`
  - `soniox-stt-async-v4`
  - `reverb-reverb`
  - `whisper-medium`
  - `gladia-default`
  - `speechmatics-enhanced`
  - `groq-whisper-large-v3-turbo`
  - `rev-machine`
  - `whisper-large-v3-turbo`
  - `rev-low_cost`
  - `speechmatics-standard`
  - `deepgram-nova-3`
  - `aws-standard`
  - `whisper-small`
  - `gcloud-chirp_3`
  - `elevenlabs-scribe_v2`
  - `glm-stt-glm-asr-2512`
  - `whisper-tiny`
  - `deapi-WhisperLargeV3`
  - `whisper-base`
  - `grok-speech-to-text`
- Ranking metric: strict speaker-aware word error rate (WER)
- Score formula: `max(0, 100 * (1 - speakerAwareWER))`
- Overall metric: balanced-overall (50% accuracy, 25% processing speed, 25% cost efficiency)
- WER formula: `(Substitutions + Deletions + Insertions) / Reference Word Count`
- Cost and processing time source: actual per-provider billing and timing data from `run.json` when available

## Method

- The consolidated transcript in `consensus-transcription.txt` was treated as the gold reference.
- Timestamps were used to map provider speaker labels onto canonical gold speakers by segment overlap.
- Gold segment end times were derived from the next gold segment start, with the final segment ending at the run duration from `run.json`.
- Provider scoring used `result.json.result.segments` for all discovered providers under `providers/`; `transcription.txt` and any pre-existing comparison reports were ignored.
- Text normalization applied before tokenization: lowercasing, curly quote/dash normalization, contraction expansion (it's -> it is), abbreviation expansion (mr. -> mister), currency symbol conversion ($50 -> 50 dollars), filler word removal (um, uh, etc.), and remaining punctuation stripping.
- Tokenization used a word/number regex, so punctuation-only tokens were ignored.
- Text-only WER compares the provider's full ordered word stream against the gold transcript word stream.
- Speaker-aware WER compares those same ordered word streams after inserting synthetic speaker-change tokens and mapping provider speaker IDs onto canonical gold speakers by overlap.
- Ranking uses exact unrounded speaker-aware WER, with text-only WER included for context.
- Overall ranking combines all providers using accuracy score, normalized processing speed, and normalized cost efficiency. Missing timing or missing cloud cost receives a neutral 50/100 component score; whisper and reverb are treated as local zero-cost providers.

## Overall Ranking

| Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | `deepinfra-openai_whisper-large-v3-turbo` | 96.41 | 93.56 | 99.35 | 99.17 |
| 2 | `happyscribe-auto` | 96.29 | 95.36 | 94.42 | 100.00 |
| 3 | `deepinfra-openai_whisper-large-v3` | 95.83 | 93.20 | 98.79 | 98.13 |
| 4 | `together-openai_whisper-large-v3` | 95.43 | 93.98 | 100.00 | 93.75 |
| 5 | `groq-whisper-large-v3-turbo` | 95.31 | 92.53 | 98.95 | 97.22 |
| 6 | `whisper-small` | 94.75 | 90.91 | 97.19 | 100.00 |
| 7 | `whisper-large-v3-turbo` | 94.66 | 91.99 | 94.65 | 100.00 |
| 8 | `whisper-medium` | 94.63 | 92.84 | 92.87 | 100.00 |
| 9 | `groq-whisper-large-v3` | 94.51 | 93.38 | 99.01 | 92.29 |
| 10 | `whisper-tiny` | 94.25 | 88.92 | 99.14 | 100.00 |
| 11 | `whisper-base` | 94.14 | 88.86 | 98.86 | 100.00 |
| 12 | `mistral-voxtral-mini-2602` | 93.95 | 94.70 | 98.88 | 87.50 |
| 13 | `openai-stt-gpt-4o-mini-transcribe` | 93.57 | 94.22 | 98.34 | 87.50 |
| 14 | `soniox-stt-async-v4` | 93.55 | 93.08 | 94.98 | 93.06 |
| 15 | `assemblyai-universal-3-pro` | 93.51 | 95.36 | 97.90 | 85.42 |
| 16 | `gemini-stt-gemini-3-flash-preview` | 92.73 | 94.34 | 90.22 | 92.00 |
| 17 | `deapi-WhisperLargeV3` | 92.49 | 88.86 | 94.40 | 97.83 |
| 18 | `grok-speech-to-text` | 92.41 | 88.62 | 99.34 | 93.06 |
| 19 | `rev-low_cost` | 91.91 | 91.99 | 90.61 | 93.06 |
| 20 | `glm-stt-glm-asr-2512` | 91.29 | 90.13 | 94.92 | 90.00 |
| 21 | `elevenlabs-scribe_v2` | 90.54 | 90.73 | 95.98 | 84.72 |
| 22 | `rev-machine` | 90.49 | 92.53 | 90.77 | 86.11 |
| 23 | `openai-stt-gpt-4o-transcribe` | 90.09 | 94.34 | 96.69 | 75.00 |
| 24 | `speechmatics-standard` | 86.48 | 91.21 | 94.75 | 68.75 |
| 25 | `deepgram-nova-3` | 85.32 | 91.15 | 99.40 | 59.58 |
| 26 | `gladia-default` | 85.10 | 92.72 | 97.34 | 57.64 |
| 27 | `speechmatics-enhanced` | 81.95 | 92.59 | 94.69 | 47.92 |
| 28 | `supadata-native` | 76.17 | 94.16 | 99.70 | 16.67 |
| 29 | `supadata-generate` | 76.10 | 94.16 | 99.41 | 16.67 |
| 30 | `supadata-auto` | 75.93 | 94.16 | 98.73 | 16.67 |
| 31 | `gcloud-chirp_3` | 74.78 | 90.79 | 84.21 | 33.33 |
| 32 | `reverb-reverb` | 71.48 | 92.96 | 0.00 | 100.00 |
| 33 | `aws-standard` | 68.30 | 90.91 | 91.40 | 0.00 |

## Ranking

| Rank | Provider | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `assemblyai-universal-3-pro` | 95.36 | 4.64% | 4.45% | 17.05s | 3.5000¢ ($0.0350) |
| 2 | `happyscribe-auto` | 95.36 | 4.64% | 4.45% | 40.58s | 0.0000¢ ($0.0000) |
| 3 | `mistral-voxtral-mini-2602` | 94.70 | 5.30% | 4.94% | 10.47s | 3.0000¢ ($0.0300) |
| 4 | `gemini-stt-gemini-3-flash-preview` | 94.34 | 5.66% | 4.63% | 68.96s | 1.9200¢ ($0.0192) |
| 5 | `openai-stt-gpt-4o-transcribe` | 94.34 | 5.66% | 4.63% | 25.26s | 6.0000¢ ($0.0600) |
| 6 | `openai-stt-gpt-4o-mini-transcribe` | 94.22 | 5.78% | 4.81% | 14.12s | 3.0000¢ ($0.0300) |
| 7 | `supadata-auto` | 94.16 | 5.84% | 4.94% | 11.43s | 20.0000¢ ($0.2000) |
| 8 | `supadata-generate` | 94.16 | 5.84% | 4.94% | 6.88s | 20.0000¢ ($0.2000) |
| 9 | `supadata-native` | 94.16 | 5.84% | 4.94% | 4.90s | 20.0000¢ ($0.2000) |
| 10 | `together-openai_whisper-large-v3` | 93.98 | 6.02% | 4.94% | 2.88s | 1.5000¢ ($0.0150) |
| 11 | `deepinfra-openai_whisper-large-v3-turbo` | 93.56 | 6.44% | 5.48% | 7.27s | 0.2000¢ ($0.0020) |
| 12 | `groq-whisper-large-v3` | 93.38 | 6.62% | 5.61% | 9.59s | 1.8500¢ ($0.0185) |
| 13 | `deepinfra-openai_whisper-large-v3` | 93.20 | 6.80% | 5.85% | 11.05s | 0.4500¢ ($0.0045) |
| 14 | `soniox-stt-async-v4` | 93.08 | 6.92% | 6.70% | 36.79s | 1.6667¢ ($0.0167) |
| 15 | `reverb-reverb` | 92.96 | 7.04% | 6.89% | 678.85s | 0.0000¢ ($0.0000) |
| 16 | `whisper-medium` | 92.84 | 7.16% | 6.22% | 51.09s | n/a |
| 17 | `gladia-default` | 92.72 | 7.28% | 6.89% | 20.89s | 10.1667¢ ($0.1017) |
| 18 | `speechmatics-enhanced` | 92.59 | 7.41% | 7.25% | 38.78s | 12.5000¢ ($0.1250) |
| 19 | `groq-whisper-large-v3-turbo` | 92.53 | 7.47% | 6.52% | 9.95s | 0.6667¢ ($0.0067) |
| 20 | `rev-machine` | 92.53 | 7.47% | 7.37% | 65.28s | 3.3333¢ ($0.0333) |
| 21 | `whisper-large-v3-turbo` | 91.99 | 8.01% | 7.01% | 39.01s | n/a |
| 22 | `rev-low_cost` | 91.99 | 8.01% | 7.86% | 66.36s | 1.6667¢ ($0.0167) |
| 23 | `speechmatics-standard` | 91.21 | 8.79% | 8.71% | 38.36s | 7.5000¢ ($0.0750) |
| 24 | `deepgram-nova-3` | 91.15 | 8.85% | 8.47% | 6.93s | 9.7000¢ ($0.0970) |
| 25 | `aws-standard` | 90.91 | 9.09% | 8.04% | 61.02s | 24.0000¢ ($0.2400) |
| 26 | `whisper-small` | 90.91 | 9.09% | 8.23% | 21.88s | n/a |
| 27 | `gcloud-chirp_3` | 90.79 | 9.21% | 8.10% | 109.62s | 16.0000¢ ($0.1600) |
| 28 | `elevenlabs-scribe_v2` | 90.73 | 9.27% | 8.10% | 30.06s | 3.6667¢ ($0.0367) |
| 29 | `glm-stt-glm-asr-2512` | 90.13 | 9.87% | 9.02% | 37.22s | 2.4000¢ ($0.0240) |
| 30 | `whisper-tiny` | 88.92 | 11.08% | 10.24% | 8.70s | n/a |
| 31 | `deapi-WhisperLargeV3` | 88.86 | 11.14% | 10.30% | 40.71s | 0.5197¢ ($0.0052) |
| 32 | `whisper-base` | 88.86 | 11.14% | 10.42% | 10.61s | n/a |
| 33 | `grok-speech-to-text` | 88.62 | 11.38% | 11.27% | 7.33s | 1.6667¢ ($0.0167) |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `assemblyai-universal-3-pro` | 23 | 15 | 35 | 1641 |
| `happyscribe-auto` | 23 | 15 | 35 | 1641 |
| `mistral-voxtral-mini-2602` | 33 | 18 | 30 | 1641 |
| `gemini-stt-gemini-3-flash-preview` | 28 | 12 | 36 | 1641 |
| `openai-stt-gpt-4o-transcribe` | 29 | 22 | 25 | 1641 |
| `openai-stt-gpt-4o-mini-transcribe` | 34 | 13 | 32 | 1641 |
| `supadata-auto` | 32 | 24 | 25 | 1641 |
| `supadata-generate` | 32 | 24 | 25 | 1641 |
| `supadata-native` | 32 | 24 | 25 | 1641 |
| `together-openai_whisper-large-v3` | 31 | 23 | 27 | 1641 |
| `deepinfra-openai_whisper-large-v3-turbo` | 33 | 27 | 30 | 1641 |
| `groq-whisper-large-v3` | 31 | 27 | 34 | 1641 |
| `deepinfra-openai_whisper-large-v3` | 35 | 28 | 33 | 1641 |
| `soniox-stt-async-v4` | 25 | 8 | 77 | 1641 |
| `reverb-reverb` | 39 | 40 | 34 | 1641 |
| `whisper-medium` | 38 | 31 | 33 | 1641 |
| `gladia-default` | 42 | 25 | 46 | 1641 |
| `speechmatics-enhanced` | 40 | 12 | 67 | 1641 |
| `groq-whisper-large-v3-turbo` | 39 | 31 | 37 | 1641 |
| `rev-machine` | 34 | 18 | 69 | 1641 |
| `whisper-large-v3-turbo` | 42 | 20 | 53 | 1641 |
| `rev-low_cost` | 39 | 24 | 66 | 1641 |
| `speechmatics-standard` | 53 | 13 | 77 | 1641 |
| `deepgram-nova-3` | 37 | 28 | 74 | 1641 |
| `aws-standard` | 43 | 18 | 71 | 1641 |
| `whisper-small` | 44 | 15 | 76 | 1641 |
| `gcloud-chirp_3` | 37 | 21 | 75 | 1641 |
| `elevenlabs-scribe_v2` | 27 | 14 | 92 | 1641 |
| `glm-stt-glm-asr-2512` | 65 | 41 | 42 | 1641 |
| `whisper-tiny` | 81 | 49 | 38 | 1641 |
| `deapi-WhisperLargeV3` | 38 | 61 | 70 | 1641 |
| `whisper-base` | 81 | 21 | 69 | 1641 |
| `grok-speech-to-text` | 40 | 71 | 74 | 1641 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| `gemini-stt-gemini-3-flash-preview` | Gemini generated compressed timestamps relative to the known audio duration; timing should be treated as coarse/unreliable.<br>All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| `openai-stt-gpt-4o-transcribe` | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| `openai-stt-gpt-4o-mini-transcribe` | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| `supadata-auto` | Supadata output duplicates another provider artifact in duplicate-1; ranking is unchanged. |
| `supadata-generate` | Supadata output duplicates another provider artifact in duplicate-1; ranking is unchanged. |
| `supadata-native` | Supadata output duplicates another provider artifact in duplicate-1; ranking is unchanged. |
| `whisper-medium` | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| `glm-stt-glm-asr-2512` | GLM segment timing is model-generated; zero-duration output is repaired with adjacent starts when detected, but no native word timing or speaker labels are available. |
| `whisper-tiny` | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| `deapi-WhisperLargeV3` | deAPI raw response used bracket timestamp blocks; report uses cleaned parsed transcript text. |

## Notes

- `assemblyai-universal-3-pro` was the most accurate provider on strict speaker-aware WER, scoring 95.36/100.
- Best overall provider: `deepinfra-openai_whisper-large-v3-turbo` scored 96.41/100 using balanced overall weighting.
- Worst overall provider: `aws-standard` scored 68.30/100 using balanced overall weighting.
- The cheapest providers were `happyscribe-auto` and `reverb-reverb` at 0.0000¢ ($0.0000).
- `together-openai_whisper-large-v3` was the fastest provider in this set at 2.88s.
- `elevenlabs-scribe_v2` lost the most ground once speaker changes were counted, with 1.17 percentage-point gap between text-only and speaker-aware WER.
