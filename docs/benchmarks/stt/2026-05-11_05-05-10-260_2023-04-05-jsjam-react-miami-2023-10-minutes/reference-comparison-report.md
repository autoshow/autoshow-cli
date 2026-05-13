# Consensus Transcript Comparison Report

## Summary

- Reference transcript: `consensus-transcription.txt`
- Compared providers:
  - `mistral-voxtral-mini-2602`
  - `supadata-auto`
  - `deepinfra-openai_whisper-large-v3-turbo`
  - `openai-stt-gpt-4o-transcribe`
  - `happyscribe-auto`
  - `deepinfra-openai_whisper-large-v3`
  - `groq-whisper-large-v3`
  - `together-openai_whisper-large-v3`
  - `assemblyai-universal-3-pro`
  - `gladia-default`
  - `speechmatics-enhanced`
  - `groq-whisper-large-v3-turbo`
  - `whisper-medium`
  - `whisper-large-v3-turbo`
  - `reverb-reverb`
  - `speechmatics-standard`
  - `gcloud-chirp_3`
  - `glm-stt-glm-asr-2512`
  - `openai-stt-gpt-4o-mini-transcribe`
  - `rev-machine`
  - `soniox-stt-async-v4`
  - `gemini-stt-gemini-3-flash-preview`
  - `whisper-tiny`
  - `whisper-small`
  - `rev-low_cost`
  - `deepgram-nova-3`
  - `aws-standard`
  - `elevenlabs-scribe_v2`
  - `whisper-base`
  - `grok-speech-to-text`
  - `deapi-WhisperLargeV3`
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
| 1 | `deepinfra-openai_whisper-large-v3-turbo` | thirdPartyNonDiarization | 1 | 1 | not supported | 97.06 | 94.81 | 99.44 | 99.17 |
| 2 | `deepinfra-openai_whisper-large-v3` | thirdPartyNonDiarization | 2 | 1 | not supported | 96.20 | 94.03 | 98.62 | 98.13 |
| 3 | `groq-whisper-large-v3-turbo` | thirdPartyNonDiarization | 3 | 1 | not supported | 95.65 | 93.12 | 99.14 | 97.22 |
| 4 | `together-openai_whisper-large-v3` | thirdPartyNonDiarization | 4 | 2 | not supported | 95.32 | 93.97 | 99.61 | 93.75 |
| 5 | `whisper-tiny` | local | 1 | 1 | not supported | 95.19 | 90.83 | 99.08 | 100.00 |
| 6 | `mistral-voxtral-mini-2602` | thirdPartyDiarization | 1 | 1 | supported | 94.87 | 96.68 | 98.60 | 87.50 |
| 7 | `whisper-large-v3-turbo` | local | 2 | 1 | not supported | 94.80 | 92.34 | 94.52 | 100.00 |
| 8 | `groq-whisper-large-v3` | thirdPartyNonDiarization | 5 | 2 | not supported | 94.74 | 93.97 | 98.73 | 92.29 |
| 9 | `whisper-medium` | local | 3 | 2 | not supported | 94.68 | 92.88 | 92.95 | 100.00 |
| 10 | `whisper-small` | local | 4 | 2 | not supported | 94.67 | 90.77 | 97.13 | 100.00 |
| 11 | `happyscribe-auto` | thirdPartyDiarization | 2 | 1 | supported | 94.59 | 94.15 | 90.06 | 100.00 |
| 12 | `whisper-base` | local | 5 | 3 | not supported | 93.86 | 88.30 | 98.84 | 100.00 |
| 13 | `assemblyai-universal-3-pro` | thirdPartyDiarization | 3 | 1 | supported | 92.77 | 93.91 | 97.86 | 85.42 |
| 14 | `soniox-stt-async-v4` | thirdPartyDiarization | 4 | 1 | supported | 92.54 | 91.01 | 95.07 | 93.06 |
| 15 | `gemini-stt-gemini-3-flash-preview` | thirdPartyNonDiarization | 6 | 2 | not supported | 92.32 | 90.95 | 95.36 | 92.00 |
| 16 | `openai-stt-gpt-4o-mini-transcribe` | thirdPartyNonDiarization | 7 | 3 | not supported | 92.05 | 91.25 | 98.20 | 87.50 |
| 17 | `grok-speech-to-text` | thirdPartyDiarization | 5 | 2 | supported | 91.88 | 87.58 | 99.32 | 93.06 |
| 18 | `glm-stt-glm-asr-2512` | thirdPartyNonDiarization | 8 | 3 | not supported | 91.63 | 91.25 | 94.00 | 90.00 |
| 19 | `rev-low_cost` | thirdPartyDiarization | 6 | 2 | supported | 90.89 | 90.59 | 89.32 | 93.06 |
| 20 | `openai-stt-gpt-4o-transcribe` | thirdPartyNonDiarization | 9 | 3 | not supported | 90.11 | 94.39 | 96.67 | 75.00 |
| 21 | `deapi-WhisperLargeV3` | thirdPartyNonDiarization | 10 | 3 | not supported | 90.10 | 84.74 | 93.09 | 97.83 |
| 22 | `rev-machine` | thirdPartyDiarization | 7 | 2 | supported | 89.79 | 91.07 | 90.90 | 86.11 |
| 23 | `elevenlabs-scribe_v2` | thirdPartyDiarization | 8 | 2 | supported | 88.98 | 89.02 | 93.16 | 84.72 |
| 24 | `speechmatics-standard` | thirdPartyDiarization | 9 | 3 | supported | 87.56 | 91.86 | 97.76 | 68.75 |
| 25 | `gladia-default` | thirdPartyDiarization | 10 | 3 | supported | 85.50 | 93.61 | 97.14 | 57.64 |
| 26 | `deepgram-nova-3` | thirdPartyDiarization | 11 | 3 | supported | 85.01 | 90.23 | 100.00 | 59.58 |
| 27 | `speechmatics-enhanced` | thirdPartyDiarization | 12 | 3 | supported | 82.74 | 93.43 | 96.17 | 47.92 |
| 28 | `supadata-auto` | thirdPartyNonDiarization | 11 | 3 | not supported | 76.74 | 95.30 | 99.70 | 16.67 |
| 29 | `gcloud-chirp_3` | thirdPartyDiarization | 13 | 3 | supported | 74.84 | 91.68 | 82.67 | 33.33 |
| 30 | `reverb-reverb` | local | 6 | 3 | supported | 71.08 | 92.16 | 0.00 | 100.00 |
| 31 | `aws-standard` | thirdPartyDiarization | 14 | 3 | supported | 67.87 | 89.99 | 91.52 | 0.00 |

## Tier Breakdown

Tiers split local providers, diarization-capable third-party providers, and non-diarization third-party providers separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (6)

#### Tier 1 (group ranks 1-2)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 5 | `whisper-tiny` | 95.19 | 90.83 | 99.08 | 100.00 |
| 2 | 7 | `whisper-large-v3-turbo` | 94.80 | 92.34 | 94.52 | 100.00 |

#### Tier 2 (group ranks 3-4)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 9 | `whisper-medium` | 94.68 | 92.88 | 92.95 | 100.00 |
| 4 | 10 | `whisper-small` | 94.67 | 90.77 | 97.13 | 100.00 |

#### Tier 3 (group ranks 5-6)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 12 | `whisper-base` | 93.86 | 88.30 | 98.84 | 100.00 |
| 6 | 30 | `reverb-reverb` | 71.08 | 92.16 | 0.00 | 100.00 |


### Third-Party Diarization Group (14)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 6 | `mistral-voxtral-mini-2602` | 94.87 | 96.68 | 98.60 | 87.50 |
| 2 | 11 | `happyscribe-auto` | 94.59 | 94.15 | 90.06 | 100.00 |
| 3 | 13 | `assemblyai-universal-3-pro` | 92.77 | 93.91 | 97.86 | 85.42 |
| 4 | 14 | `soniox-stt-async-v4` | 92.54 | 91.01 | 95.07 | 93.06 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 17 | `grok-speech-to-text` | 91.88 | 87.58 | 99.32 | 93.06 |
| 6 | 19 | `rev-low_cost` | 90.89 | 90.59 | 89.32 | 93.06 |
| 7 | 22 | `rev-machine` | 89.79 | 91.07 | 90.90 | 86.11 |
| 8 | 23 | `elevenlabs-scribe_v2` | 88.98 | 89.02 | 93.16 | 84.72 |

#### Tier 3 (group ranks 9-14)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 24 | `speechmatics-standard` | 87.56 | 91.86 | 97.76 | 68.75 |
| 10 | 25 | `gladia-default` | 85.50 | 93.61 | 97.14 | 57.64 |
| 11 | 26 | `deepgram-nova-3` | 85.01 | 90.23 | 100.00 | 59.58 |
| 12 | 27 | `speechmatics-enhanced` | 82.74 | 93.43 | 96.17 | 47.92 |
| 13 | 29 | `gcloud-chirp_3` | 74.84 | 91.68 | 82.67 | 33.33 |
| 14 | 31 | `aws-standard` | 67.87 | 89.99 | 91.52 | 0.00 |


### Third-Party Non-Diarization Group (11)

#### Tier 1 (group ranks 1-3)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `deepinfra-openai_whisper-large-v3-turbo` | 97.06 | 94.81 | 99.44 | 99.17 |
| 2 | 2 | `deepinfra-openai_whisper-large-v3` | 96.20 | 94.03 | 98.62 | 98.13 |
| 3 | 3 | `groq-whisper-large-v3-turbo` | 95.65 | 93.12 | 99.14 | 97.22 |

#### Tier 2 (group ranks 4-6)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 4 | 4 | `together-openai_whisper-large-v3` | 95.32 | 93.97 | 99.61 | 93.75 |
| 5 | 8 | `groq-whisper-large-v3` | 94.74 | 93.97 | 98.73 | 92.29 |
| 6 | 15 | `gemini-stt-gemini-3-flash-preview` | 92.32 | 90.95 | 95.36 | 92.00 |

#### Tier 3 (group ranks 7-11)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 7 | 16 | `openai-stt-gpt-4o-mini-transcribe` | 92.05 | 91.25 | 98.20 | 87.50 |
| 8 | 18 | `glm-stt-glm-asr-2512` | 91.63 | 91.25 | 94.00 | 90.00 |
| 9 | 20 | `openai-stt-gpt-4o-transcribe` | 90.11 | 94.39 | 96.67 | 75.00 |
| 10 | 21 | `deapi-WhisperLargeV3` | 90.10 | 84.74 | 93.09 | 97.83 |
| 11 | 28 | `supadata-auto` | 76.74 | 95.30 | 99.70 | 16.67 |



## Ranking

| Rank | Provider | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `mistral-voxtral-mini-2602` | 96.68 | 3.32% | 3.05% | 12.07s | 3.0000¢ ($0.0300) |
| 2 | `supadata-auto` | 95.30 | 4.70% | 3.60% | 4.46s | 20.0000¢ ($0.2000) |
| 3 | `deepinfra-openai_whisper-large-v3-turbo` | 94.81 | 5.19% | 4.09% | 6.23s | 0.2000¢ ($0.0020) |
| 4 | `openai-stt-gpt-4o-transcribe` | 94.39 | 5.61% | 4.58% | 25.42s | 6.0000¢ ($0.0600) |
| 5 | `happyscribe-auto` | 94.15 | 5.85% | 5.31% | 71.09s | 0.0000¢ ($0.0000) |
| 6 | `deepinfra-openai_whisper-large-v3` | 94.03 | 5.97% | 4.88% | 11.90s | 0.4500¢ ($0.0045) |
| 7 | `groq-whisper-large-v3` | 93.97 | 6.03% | 4.94% | 11.18s | 1.8500¢ ($0.0185) |
| 8 | `together-openai_whisper-large-v3` | 93.97 | 6.03% | 4.94% | 5.12s | 1.5000¢ ($0.0150) |
| 9 | `assemblyai-universal-3-pro` | 93.91 | 6.09% | 5.55% | 17.16s | 3.5000¢ ($0.0350) |
| 10 | `gladia-default` | 93.61 | 6.39% | 5.98% | 22.14s | 10.1667¢ ($0.1017) |
| 11 | `speechmatics-enhanced` | 93.43 | 6.57% | 6.35% | 28.83s | 12.5000¢ ($0.1250) |
| 12 | `groq-whisper-large-v3-turbo` | 93.12 | 6.88% | 5.80% | 8.31s | 0.6667¢ ($0.0067) |
| 13 | `whisper-medium` | 92.88 | 7.12% | 6.10% | 51.08s | n/a |
| 14 | `whisper-large-v3-turbo` | 92.34 | 7.66% | 6.59% | 40.27s | n/a |
| 15 | `reverb-reverb` | 92.16 | 7.84% | 7.63% | 693.35s | 0.0000¢ ($0.0000) |
| 16 | `speechmatics-standard` | 91.86 | 8.14% | 7.75% | 17.89s | 7.5000¢ ($0.0750) |
| 17 | `gcloud-chirp_3` | 91.68 | 8.32% | 7.26% | 122.13s | 16.0000¢ ($0.1600) |
| 18 | `glm-stt-glm-asr-2512` | 91.25 | 8.75% | 7.69% | 43.85s | 2.4000¢ ($0.0240) |
| 19 | `openai-stt-gpt-4o-mini-transcribe` | 91.25 | 8.75% | 7.81% | 14.83s | 3.0000¢ ($0.0300) |
| 20 | `rev-machine` | 91.07 | 8.93% | 8.79% | 65.25s | 3.3333¢ ($0.0333) |
| 21 | `soniox-stt-async-v4` | 91.01 | 8.99% | 8.60% | 36.44s | 1.6667¢ ($0.0167) |
| 22 | `gemini-stt-gemini-3-flash-preview` | 90.95 | 9.05% | 8.30% | 34.43s | 1.9200¢ ($0.0192) |
| 23 | `whisper-tiny` | 90.83 | 9.17% | 8.24% | 8.75s | n/a |
| 24 | `whisper-small` | 90.77 | 9.23% | 8.30% | 22.25s | n/a |
| 25 | `rev-low_cost` | 90.59 | 9.41% | 9.27% | 76.21s | 1.6667¢ ($0.0167) |
| 26 | `deepgram-nova-3` | 90.23 | 9.77% | 9.40% | 2.39s | 9.7000¢ ($0.0970) |
| 27 | `aws-standard` | 89.99 | 10.01% | 9.03% | 61.02s | 24.0000¢ ($0.2400) |
| 28 | `elevenlabs-scribe_v2` | 89.02 | 10.98% | 9.76% | 49.67s | 3.6667¢ ($0.0367) |
| 29 | `whisper-base` | 88.30 | 11.70% | 10.86% | 10.38s | n/a |
| 30 | `grok-speech-to-text` | 87.58 | 12.42% | 12.26% | 7.08s | 1.6667¢ ($0.0167) |
| 31 | `deapi-WhisperLargeV3` | 84.74 | 15.26% | 14.34% | 50.16s | 0.5197¢ ($0.0052) |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `mistral-voxtral-mini-2602` | 20 | 8 | 22 | 1639 |
| `supadata-auto` | 24 | 16 | 19 | 1639 |
| `deepinfra-openai_whisper-large-v3-turbo` | 24 | 19 | 24 | 1639 |
| `openai-stt-gpt-4o-transcribe` | 24 | 21 | 30 | 1639 |
| `happyscribe-auto` | 27 | 19 | 41 | 1639 |
| `deepinfra-openai_whisper-large-v3` | 24 | 26 | 30 | 1639 |
| `groq-whisper-large-v3` | 20 | 26 | 35 | 1639 |
| `together-openai_whisper-large-v3` | 27 | 24 | 30 | 1639 |
| `assemblyai-universal-3-pro` | 31 | 19 | 41 | 1639 |
| `gladia-default` | 31 | 22 | 45 | 1639 |
| `speechmatics-enhanced` | 25 | 11 | 68 | 1639 |
| `groq-whisper-large-v3-turbo` | 29 | 29 | 37 | 1639 |
| `whisper-medium` | 30 | 33 | 37 | 1639 |
| `whisper-large-v3-turbo` | 31 | 21 | 56 | 1639 |
| `reverb-reverb` | 51 | 39 | 35 | 1639 |
| `speechmatics-standard` | 41 | 10 | 76 | 1639 |
| `gcloud-chirp_3` | 31 | 16 | 72 | 1639 |
| `glm-stt-glm-asr-2512` | 52 | 34 | 40 | 1639 |
| `openai-stt-gpt-4o-mini-transcribe` | 34 | 23 | 71 | 1639 |
| `rev-machine` | 47 | 22 | 75 | 1639 |
| `soniox-stt-async-v4` | 38 | 16 | 87 | 1639 |
| `gemini-stt-gemini-3-flash-preview` | 29 | 9 | 98 | 1639 |
| `whisper-tiny` | 72 | 36 | 27 | 1639 |
| `whisper-small` | 43 | 15 | 78 | 1639 |
| `rev-low_cost` | 52 | 28 | 72 | 1639 |
| `deepgram-nova-3` | 43 | 32 | 79 | 1639 |
| `aws-standard` | 49 | 22 | 77 | 1639 |
| `elevenlabs-scribe_v2` | 40 | 18 | 102 | 1639 |
| `whisper-base` | 82 | 23 | 73 | 1639 |
| `grok-speech-to-text` | 52 | 73 | 76 | 1639 |
| `deapi-WhisperLargeV3` | 28 | 71 | 136 | 1639 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| `openai-stt-gpt-4o-transcribe` | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| `whisper-medium` | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| `glm-stt-glm-asr-2512` | GLM returned all-zero-duration segment timing. |
| `openai-stt-gpt-4o-mini-transcribe` | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| `gemini-stt-gemini-3-flash-preview` | Gemini generated compressed timestamps relative to the known audio duration; timing should be treated as coarse/unreliable.<br>All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| `whisper-tiny` | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| `deapi-WhisperLargeV3` | deAPI raw response used bracket timestamp blocks; report uses cleaned parsed transcript text. |

## Notes

- `mistral-voxtral-mini-2602` was the most accurate provider on strict speaker-aware WER, scoring 96.68/100.
- Best overall provider: `deepinfra-openai_whisper-large-v3-turbo` scored 97.06/100 using balanced overall weighting.
- Worst overall provider: `aws-standard` scored 67.87/100 using balanced overall weighting.
- The cheapest providers were `happyscribe-auto` and `reverb-reverb` at 0.0000¢ ($0.0000).
- `deepgram-nova-3` was the fastest provider in this set at 2.39s.
- `elevenlabs-scribe_v2` lost the most ground once speaker changes were counted, with 1.22 percentage-point gap between text-only and speaker-aware WER.
