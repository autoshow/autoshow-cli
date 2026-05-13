# Consensus Transcript Comparison Report

## Summary

- Reference transcript: `consensus-transcription.txt`
- Compared providers:
  - `assemblyai-universal-3-pro`
  - `speechmatics-enhanced`
  - `speechmatics-standard`
  - `gladia-default`
  - `gcloud-chirp_3`
  - `soniox-stt-async-v4`
  - `mistral-voxtral-mini-2602`
  - `groq-whisper-large-v3`
  - `openai-stt-gpt-4o-mini-transcribe`
  - `elevenlabs-scribe_v2`
  - `gemini-stt-gemini-3-flash-preview`
  - `groq-whisper-large-v3-turbo`
  - `supadata-auto`
  - `supadata-generate`
  - `supadata-native`
  - `aws-standard`
  - `deepinfra-openai_whisper-large-v3`
  - `deepinfra-openai_whisper-large-v3-turbo`
  - `openai-stt-gpt-4o-transcribe`
  - `together-openai_whisper-large-v3`
  - `whisper-medium`
  - `rev-low_cost`
  - `rev-machine`
  - `glm-stt-glm-asr-2512`
  - `whisper-large-v3-turbo`
  - `whisper-base`
  - `deepgram-nova-3`
  - `reverb-reverb`
  - `whisper-small`
  - `whisper-tiny`
  - `grok-speech-to-text`
  - `deapi-WhisperLargeV3`
  - `happyscribe-auto`
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
- Tier breakdown assigns local providers, diarization-capable third-party providers, and non-diarization third-party providers independently using balanced overall group rank.

## Overall Ranking

| Rank | Provider | Tier Group | Group Rank | Group Tier | Diarization | Overall / 100 | Accuracy | Speed | Cost |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `assemblyai-universal-3-pro` | thirdPartyDiarization | 1 | 1 | supported | 97.11 | 97.30 | 93.84 | 100.00 |
| 2 | `openai-stt-gpt-4o-mini-transcribe` | thirdPartyNonDiarization | 1 | 1 | not supported | 96.44 | 93.24 | 99.27 | 100.00 |
| 3 | `groq-whisper-large-v3` | thirdPartyNonDiarization | 2 | 1 | not supported | 96.34 | 93.24 | 98.86 | 100.00 |
| 4 | `speechmatics-standard` | thirdPartyDiarization | 2 | 1 | supported | 96.33 | 95.95 | 93.44 | 100.00 |
| 5 | `mistral-voxtral-mini-2602` | thirdPartyDiarization | 3 | 1 | supported | 96.21 | 93.69 | 97.44 | 100.00 |
| 6 | `groq-whisper-large-v3-turbo` | thirdPartyNonDiarization | 3 | 1 | not supported | 96.13 | 92.79 | 98.92 | 100.00 |
| 7 | `gladia-default` | thirdPartyDiarization | 4 | 1 | supported | 95.86 | 95.50 | 92.47 | 100.00 |
| 8 | `deepinfra-openai_whisper-large-v3-turbo` | thirdPartyNonDiarization | 4 | 1 | not supported | 95.65 | 91.44 | 99.73 | 100.00 |
| 9 | `soniox-stt-async-v4` | thirdPartyDiarization | 5 | 2 | supported | 95.64 | 94.14 | 94.25 | 100.00 |
| 10 | `together-openai_whisper-large-v3` | thirdPartyNonDiarization | 5 | 2 | not supported | 95.32 | 91.44 | 98.42 | 100.00 |
| 11 | `elevenlabs-scribe_v2` | thirdPartyDiarization | 6 | 2 | supported | 95.22 | 92.79 | 95.29 | 100.00 |
| 12 | `deepinfra-openai_whisper-large-v3` | thirdPartyNonDiarization | 6 | 2 | not supported | 95.17 | 91.89 | 96.90 | 100.00 |
| 13 | `gemini-stt-gemini-3-flash-preview` | thirdPartyNonDiarization | 7 | 2 | not supported | 95.12 | 92.79 | 94.90 | 100.00 |
| 14 | `openai-stt-gpt-4o-transcribe` | thirdPartyNonDiarization | 8 | 2 | not supported | 95.08 | 91.44 | 97.44 | 100.00 |
| 15 | `whisper-base` | local | 1 | 1 | not supported | 94.76 | 89.64 | 99.76 | 100.00 |
| 16 | `deepgram-nova-3` | thirdPartyDiarization | 7 | 2 | supported | 94.75 | 89.64 | 99.72 | 100.00 |
| 17 | `whisper-medium` | local | 2 | 1 | not supported | 94.39 | 90.99 | 95.58 | 100.00 |
| 18 | `whisper-large-v3-turbo` | local | 3 | 2 | not supported | 94.29 | 90.09 | 96.98 | 100.00 |
| 19 | `glm-stt-glm-asr-2512` | thirdPartyNonDiarization | 9 | 3 | not supported | 94.11 | 90.54 | 95.38 | 100.00 |
| 20 | `whisper-small` | local | 4 | 2 | not supported | 93.46 | 87.39 | 99.06 | 100.00 |
| 21 | `speechmatics-enhanced` | thirdPartyDiarization | 8 | 2 | supported | 92.83 | 96.40 | 78.51 | 100.00 |
| 22 | `whisper-tiny` | local | 5 | 3 | not supported | 92.12 | 84.23 | 100.00 | 100.00 |
| 23 | `grok-speech-to-text` | thirdPartyDiarization | 9 | 3 | supported | 91.88 | 83.78 | 99.95 | 100.00 |
| 24 | `rev-machine` | thirdPartyDiarization | 10 | 3 | supported | 90.77 | 90.99 | 81.08 | 100.00 |
| 25 | `aws-standard` | thirdPartyDiarization | 11 | 3 | supported | 90.62 | 91.89 | 78.69 | 100.00 |
| 26 | `rev-low_cost` | thirdPartyDiarization | 12 | 3 | supported | 88.62 | 90.99 | 72.48 | 100.00 |
| 27 | `reverb-reverb` | local | 6 | 3 | supported | 81.38 | 89.19 | 47.16 | 100.00 |
| 28 | `deapi-WhisperLargeV3` | thirdPartyNonDiarization | 10 | 3 | not supported | 79.97 | 69.82 | 91.97 | 88.29 |
| 29 | `gcloud-chirp_3` | thirdPartyDiarization | 13 | 3 | supported | 72.75 | 95.50 | 0.00 | 100.00 |
| 30 | `supadata-generate` | thirdPartyNonDiarization | 11 | 3 | not supported | 71.04 | 92.34 | 99.46 | 0.00 |
| 31 | `supadata-auto` | thirdPartyNonDiarization | 12 | 3 | not supported | 70.84 | 92.34 | 98.66 | 0.00 |
| 32 | `supadata-native` | thirdPartyNonDiarization | 13 | 3 | not supported | 70.37 | 92.34 | 96.78 | 0.00 |
| 33 | `happyscribe-auto` | thirdPartyDiarization | 14 | 3 | supported | 62.64 | 40.99 | 68.58 | 100.00 |

## Tier Breakdown

Tiers split local providers, diarization-capable third-party providers, and non-diarization third-party providers separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (6)

#### Tier 1 (group ranks 1-2)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 15 | `whisper-base` | 94.76 | 89.64 | 99.76 | 100.00 |
| 2 | 17 | `whisper-medium` | 94.39 | 90.99 | 95.58 | 100.00 |

#### Tier 2 (group ranks 3-4)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 18 | `whisper-large-v3-turbo` | 94.29 | 90.09 | 96.98 | 100.00 |
| 4 | 20 | `whisper-small` | 93.46 | 87.39 | 99.06 | 100.00 |

#### Tier 3 (group ranks 5-6)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 22 | `whisper-tiny` | 92.12 | 84.23 | 100.00 | 100.00 |
| 6 | 27 | `reverb-reverb` | 81.38 | 89.19 | 47.16 | 100.00 |


### Third-Party Diarization Group (14)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `assemblyai-universal-3-pro` | 97.11 | 97.30 | 93.84 | 100.00 |
| 2 | 4 | `speechmatics-standard` | 96.33 | 95.95 | 93.44 | 100.00 |
| 3 | 5 | `mistral-voxtral-mini-2602` | 96.21 | 93.69 | 97.44 | 100.00 |
| 4 | 7 | `gladia-default` | 95.86 | 95.50 | 92.47 | 100.00 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 9 | `soniox-stt-async-v4` | 95.64 | 94.14 | 94.25 | 100.00 |
| 6 | 11 | `elevenlabs-scribe_v2` | 95.22 | 92.79 | 95.29 | 100.00 |
| 7 | 16 | `deepgram-nova-3` | 94.75 | 89.64 | 99.72 | 100.00 |
| 8 | 21 | `speechmatics-enhanced` | 92.83 | 96.40 | 78.51 | 100.00 |

#### Tier 3 (group ranks 9-14)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 23 | `grok-speech-to-text` | 91.88 | 83.78 | 99.95 | 100.00 |
| 10 | 24 | `rev-machine` | 90.77 | 90.99 | 81.08 | 100.00 |
| 11 | 25 | `aws-standard` | 90.62 | 91.89 | 78.69 | 100.00 |
| 12 | 26 | `rev-low_cost` | 88.62 | 90.99 | 72.48 | 100.00 |
| 13 | 29 | `gcloud-chirp_3` | 72.75 | 95.50 | 0.00 | 100.00 |
| 14 | 33 | `happyscribe-auto` | 62.64 | 40.99 | 68.58 | 100.00 |


### Third-Party Non-Diarization Group (13)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 2 | `openai-stt-gpt-4o-mini-transcribe` | 96.44 | 93.24 | 99.27 | 100.00 |
| 2 | 3 | `groq-whisper-large-v3` | 96.34 | 93.24 | 98.86 | 100.00 |
| 3 | 6 | `groq-whisper-large-v3-turbo` | 96.13 | 92.79 | 98.92 | 100.00 |
| 4 | 8 | `deepinfra-openai_whisper-large-v3-turbo` | 95.65 | 91.44 | 99.73 | 100.00 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 10 | `together-openai_whisper-large-v3` | 95.32 | 91.44 | 98.42 | 100.00 |
| 6 | 12 | `deepinfra-openai_whisper-large-v3` | 95.17 | 91.89 | 96.90 | 100.00 |
| 7 | 13 | `gemini-stt-gemini-3-flash-preview` | 95.12 | 92.79 | 94.90 | 100.00 |
| 8 | 14 | `openai-stt-gpt-4o-transcribe` | 95.08 | 91.44 | 97.44 | 100.00 |

#### Tier 3 (group ranks 9-13)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 19 | `glm-stt-glm-asr-2512` | 94.11 | 90.54 | 95.38 | 100.00 |
| 10 | 28 | `deapi-WhisperLargeV3` | 79.97 | 69.82 | 91.97 | 88.29 |
| 11 | 30 | `supadata-generate` | 71.04 | 92.34 | 99.46 | 0.00 |
| 12 | 31 | `supadata-auto` | 70.84 | 92.34 | 98.66 | 0.00 |
| 13 | 32 | `supadata-native` | 70.37 | 92.34 | 96.78 | 0.00 |



## Ranking

| Rank | Provider | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `assemblyai-universal-3-pro` | 97.30 | 2.70% | 2.75% | 8.77s | 0.0000¢ ($0.0000) |
| 2 | `speechmatics-enhanced` | 96.40 | 3.60% | 3.67% | 27.89s | 0.0000¢ ($0.0000) |
| 3 | `speechmatics-standard` | 95.95 | 4.05% | 4.13% | 9.28s | 0.0000¢ ($0.0000) |
| 4 | `gladia-default` | 95.50 | 4.50% | 3.67% | 10.49s | 0.0000¢ ($0.0000) |
| 5 | `gcloud-chirp_3` | 95.50 | 4.50% | 4.59% | 125.79s | 0.0000¢ ($0.0000) |
| 6 | `soniox-stt-async-v4` | 94.14 | 5.86% | 5.96% | 8.26s | 0.0000¢ ($0.0000) |
| 7 | `mistral-voxtral-mini-2602` | 93.69 | 6.31% | 6.42% | 4.28s | 0.0000¢ ($0.0000) |
| 8 | `groq-whisper-large-v3` | 93.24 | 6.76% | 5.05% | 2.52s | 0.0000¢ ($0.0000) |
| 9 | `openai-stt-gpt-4o-mini-transcribe` | 93.24 | 6.76% | 5.05% | 2.01s | 0.0000¢ ($0.0000) |
| 10 | `elevenlabs-scribe_v2` | 92.79 | 7.21% | 4.59% | 6.97s | 0.0000¢ ($0.0000) |
| 11 | `gemini-stt-gemini-3-flash-preview` | 92.79 | 7.21% | 5.50% | 7.46s | 0.0000¢ ($0.0000) |
| 12 | `groq-whisper-large-v3-turbo` | 92.79 | 7.21% | 5.50% | 2.45s | 0.0000¢ ($0.0000) |
| 13 | `supadata-auto` | 92.34 | 7.66% | 5.96% | 2.77s | 2.0000¢ ($0.0200) |
| 14 | `supadata-generate` | 92.34 | 7.66% | 5.96% | 1.77s | 2.0000¢ ($0.0200) |
| 15 | `supadata-native` | 92.34 | 7.66% | 5.96% | 5.12s | 2.0000¢ ($0.0200) |
| 16 | `aws-standard` | 91.89 | 8.11% | 5.50% | 27.66s | 0.0000¢ ($0.0000) |
| 17 | `deepinfra-openai_whisper-large-v3` | 91.89 | 8.11% | 6.42% | 4.96s | 0.0000¢ ($0.0000) |
| 18 | `deepinfra-openai_whisper-large-v3-turbo` | 91.44 | 8.56% | 6.88% | 1.43s | 0.0000¢ ($0.0000) |
| 19 | `openai-stt-gpt-4o-transcribe` | 91.44 | 8.56% | 6.88% | 4.29s | 0.0000¢ ($0.0000) |
| 20 | `together-openai_whisper-large-v3` | 91.44 | 8.56% | 6.88% | 3.07s | 0.0000¢ ($0.0000) |
| 21 | `whisper-medium` | 90.99 | 9.01% | 7.34% | 6.61s | n/a |
| 22 | `rev-low_cost` | 90.99 | 9.01% | 8.26% | 35.41s | 0.0000¢ ($0.0000) |
| 23 | `rev-machine` | 90.99 | 9.01% | 8.26% | 24.68s | 0.0000¢ ($0.0000) |
| 24 | `glm-stt-glm-asr-2512` | 90.54 | 9.46% | 7.80% | 6.86s | 0.0000¢ ($0.0000) |
| 25 | `whisper-large-v3-turbo` | 90.09 | 9.91% | 8.26% | 4.86s | n/a |
| 26 | `whisper-base` | 89.64 | 10.36% | 8.72% | 1.40s | n/a |
| 27 | `deepgram-nova-3` | 89.64 | 10.36% | 9.17% | 1.44s | 0.0000¢ ($0.0000) |
| 28 | `reverb-reverb` | 89.19 | 10.81% | 10.09% | 66.99s | 0.0000¢ ($0.0000) |
| 29 | `whisper-small` | 87.39 | 12.61% | 11.01% | 2.27s | n/a |
| 30 | `whisper-tiny` | 84.23 | 15.77% | 14.22% | 1.10s | n/a |
| 31 | `grok-speech-to-text` | 83.78 | 16.22% | 16.51% | 1.16s | 0.0000¢ ($0.0000) |
| 32 | `deapi-WhisperLargeV3` | 69.82 | 30.18% | 29.36% | 11.12s | 0.2343¢ ($0.0023) |
| 33 | `happyscribe-auto` | 40.99 | 59.01% | 58.26% | 40.27s | 0.0000¢ ($0.0000) |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `assemblyai-universal-3-pro` | 3 | 1 | 2 | 215 |
| `speechmatics-enhanced` | 4 | 3 | 1 | 215 |
| `speechmatics-standard` | 5 | 2 | 2 | 215 |
| `gladia-default` | 3 | 3 | 2 | 215 |
| `gcloud-chirp_3` | 2 | 1 | 4 | 215 |
| `soniox-stt-async-v4` | 3 | 6 | 1 | 215 |
| `mistral-voxtral-mini-2602` | 3 | 7 | 1 | 215 |
| `groq-whisper-large-v3` | 4 | 4 | 3 | 215 |
| `openai-stt-gpt-4o-mini-transcribe` | 3 | 4 | 1 | 215 |
| `elevenlabs-scribe_v2` | 6 | 1 | 3 | 215 |
| `gemini-stt-gemini-3-flash-preview` | 2 | 4 | 3 | 215 |
| `groq-whisper-large-v3-turbo` | 4 | 4 | 4 | 215 |
| `supadata-auto` | 4 | 4 | 5 | 215 |
| `supadata-generate` | 4 | 4 | 5 | 215 |
| `supadata-native` | 4 | 4 | 5 | 215 |
| `aws-standard` | 6 | 2 | 4 | 215 |
| `deepinfra-openai_whisper-large-v3` | 3 | 7 | 1 | 215 |
| `deepinfra-openai_whisper-large-v3-turbo` | 3 | 7 | 2 | 215 |
| `openai-stt-gpt-4o-transcribe` | 3 | 8 | 1 | 215 |
| `together-openai_whisper-large-v3` | 3 | 8 | 1 | 215 |
| `whisper-medium` | 7 | 3 | 3 | 215 |
| `rev-low_cost` | 9 | 2 | 4 | 215 |
| `rev-machine` | 8 | 2 | 5 | 215 |
| `glm-stt-glm-asr-2512` | 9 | 6 | 2 | 215 |
| `whisper-large-v3-turbo` | 4 | 8 | 3 | 215 |
| `whisper-base` | 6 | 8 | 2 | 215 |
| `deepgram-nova-3` | 7 | 8 | 2 | 215 |
| `reverb-reverb` | 12 | 7 | 0 | 215 |
| `whisper-small` | 15 | 5 | 1 | 215 |
| `whisper-tiny` | 17 | 5 | 6 | 215 |
| `grok-speech-to-text` | 8 | 19 | 6 | 215 |
| `deapi-WhisperLargeV3` | 8 | 3 | 50 | 215 |
| `happyscribe-auto` | 1 | 126 | 0 | 215 |

## Notes

- `assemblyai-universal-3-pro` was the most accurate provider on strict speaker-aware WER, scoring 97.30/100.
- Best overall provider: `assemblyai-universal-3-pro` scored 97.11/100 using balanced overall weighting.
- Worst overall provider: `happyscribe-auto` scored 62.64/100 using balanced overall weighting.
- The cheapest providers were `assemblyai-universal-3-pro`, `speechmatics-enhanced`, `speechmatics-standard`, `gladia-default`, `gcloud-chirp_3`, `soniox-stt-async-v4`, `mistral-voxtral-mini-2602`, `groq-whisper-large-v3`, `openai-stt-gpt-4o-mini-transcribe`, `elevenlabs-scribe_v2`, `gemini-stt-gemini-3-flash-preview`, `groq-whisper-large-v3-turbo`, `aws-standard`, `deepinfra-openai_whisper-large-v3`, `deepinfra-openai_whisper-large-v3-turbo`, `openai-stt-gpt-4o-transcribe`, `together-openai_whisper-large-v3`, `rev-low_cost`, `rev-machine`, `glm-stt-glm-asr-2512`, `deepgram-nova-3`, `reverb-reverb`, `grok-speech-to-text`, and `happyscribe-auto` at 0.0000¢ ($0.0000).
- `whisper-tiny` was the fastest provider in this set at 1.10s.
- `elevenlabs-scribe_v2` lost the most ground once speaker changes were counted, with 2.62 percentage-point gap between text-only and speaker-aware WER.
