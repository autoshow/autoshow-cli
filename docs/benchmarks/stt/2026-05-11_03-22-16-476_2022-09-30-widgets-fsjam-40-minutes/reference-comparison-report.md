# Consensus Transcript Comparison Report

## Summary

- Reference transcript: `consensus-transcription.txt`
- Compared providers:
  - `assemblyai-universal-3-pro`
  - `happyscribe-auto`
  - `mistral-voxtral-mini-2602`
  - `gladia-default`
  - `soniox-stt-async-v4`
  - `speechmatics-enhanced`
  - `elevenlabs-scribe_v2`
  - `deepinfra-openai_whisper-large-v3`
  - `whisper-large-v3-turbo`
  - `groq-whisper-large-v3-turbo`
  - `deepinfra-openai_whisper-large-v3-turbo`
  - `supadata-auto`
  - `groq-whisper-large-v3`
  - `deepgram-nova-3`
  - `speechmatics-standard`
  - `gcloud-chirp_3`
  - `together-openai_whisper-large-v3`
  - `whisper-small`
  - `whisper-medium`
  - `aws-standard`
  - `rev-machine`
  - `glm-stt-glm-asr-2512`
  - `rev-low_cost`
  - `whisper-base`
  - `grok-speech-to-text`
  - `whisper-tiny`
  - `reverb-reverb`
  - `openai-stt-gpt-4o-transcribe`
  - `openai-stt-gpt-4o-mini-transcribe`
  - `deapi-WhisperLargeV3`
  - `gemini-stt-gemini-3-flash-preview`
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
| 1 | `happyscribe-auto` | thirdPartyDiarization | 1 | 1 | supported | 98.38 | 98.85 | 95.82 | 100.00 |
| 2 | `supadata-auto` | thirdPartyNonDiarization | 1 | 1 | not supported | 97.83 | 95.73 | 99.84 | 100.00 |
| 3 | `deepinfra-openai_whisper-large-v3-turbo` | thirdPartyNonDiarization | 2 | 1 | not supported | 97.54 | 95.94 | 99.12 | 99.17 |
| 4 | `deepinfra-openai_whisper-large-v3` | thirdPartyNonDiarization | 3 | 1 | not supported | 97.12 | 96.20 | 97.97 | 98.13 |
| 5 | `groq-whisper-large-v3-turbo` | thirdPartyNonDiarization | 4 | 2 | not supported | 97.07 | 95.99 | 99.07 | 97.22 |
| 6 | `whisper-small` | local | 1 | 1 | not supported | 96.62 | 94.91 | 96.67 | 100.00 |
| 7 | `whisper-large-v3-turbo` | local | 2 | 1 | not supported | 96.55 | 96.00 | 94.19 | 100.00 |
| 8 | `whisper-base` | local | 3 | 2 | not supported | 96.10 | 93.06 | 98.29 | 100.00 |
| 9 | `together-openai_whisper-large-v3` | thirdPartyNonDiarization | 5 | 2 | not supported | 95.92 | 94.96 | 100.00 | 93.75 |
| 10 | `groq-whisper-large-v3` | thirdPartyNonDiarization | 6 | 2 | not supported | 95.80 | 95.73 | 99.45 | 92.29 |
| 11 | `soniox-stt-async-v4` | thirdPartyDiarization | 2 | 1 | supported | 95.68 | 96.45 | 96.74 | 93.06 |
| 12 | `assemblyai-universal-3-pro` | thirdPartyDiarization | 3 | 1 | supported | 95.54 | 98.94 | 98.85 | 85.42 |
| 13 | `whisper-medium` | local | 4 | 2 | not supported | 95.31 | 94.67 | 91.91 | 100.00 |
| 14 | `mistral-voxtral-mini-2602` | thirdPartyDiarization | 4 | 1 | supported | 95.20 | 97.17 | 98.97 | 87.50 |
| 15 | `whisper-tiny` | local | 5 | 3 | not supported | 94.90 | 90.39 | 98.83 | 100.00 |
| 16 | `rev-low_cost` | thirdPartyDiarization | 5 | 2 | supported | 93.17 | 93.39 | 92.83 | 93.06 |
| 17 | `elevenlabs-scribe_v2` | thirdPartyDiarization | 6 | 2 | supported | 93.07 | 96.29 | 94.96 | 84.73 |
| 18 | `rev-machine` | thirdPartyDiarization | 7 | 2 | supported | 92.96 | 94.11 | 97.53 | 86.11 |
| 19 | `glm-stt-glm-asr-2512` | thirdPartyNonDiarization | 7 | 3 | not supported | 92.95 | 93.90 | 93.99 | 90.00 |
| 20 | `openai-stt-gpt-4o-mini-transcribe` | thirdPartyNonDiarization | 8 | 3 | not supported | 89.69 | 86.63 | 98.00 | 87.50 |
| 21 | `deapi-WhisperLargeV3` | thirdPartyNonDiarization | 9 | 3 | not supported | 89.37 | 81.59 | 95.84 | 98.47 |
| 22 | `speechmatics-standard` | thirdPartyDiarization | 8 | 2 | supported | 89.04 | 95.16 | 97.05 | 68.76 |
| 23 | `deepgram-nova-3` | thirdPartyDiarization | 9 | 3 | supported | 87.48 | 95.19 | 99.95 | 59.60 |
| 24 | `gladia-default` | thirdPartyDiarization | 10 | 3 | supported | 87.17 | 96.56 | 97.92 | 57.66 |
| 25 | `openai-stt-gpt-4o-transcribe` | thirdPartyNonDiarization | 10 | 3 | not supported | 86.94 | 88.14 | 96.48 | 75.01 |
| 26 | `speechmatics-enhanced` | thirdPartyDiarization | 11 | 3 | supported | 84.16 | 96.38 | 95.94 | 47.94 |
| 27 | `grok-speech-to-text` | thirdPartyDiarization | 12 | 3 | supported | 83.77 | 92.82 | 99.45 | 50.00 |
| 28 | `gemini-stt-gemini-3-flash-preview` | thirdPartyNonDiarization | 11 | 3 | not supported | 79.50 | 68.57 | 88.84 | 92.00 |
| 29 | `gcloud-chirp_3` | thirdPartyDiarization | 13 | 3 | supported | 75.31 | 95.01 | 77.86 | 33.36 |
| 30 | `aws-standard` | thirdPartyDiarization | 14 | 3 | supported | 70.78 | 94.63 | 93.87 | 0.00 |
| 31 | `reverb-reverb` | local | 6 | 3 | supported | 69.53 | 89.05 | 0.00 | 100.00 |

## Tier Breakdown

Tiers split local providers, diarization-capable third-party providers, and non-diarization third-party providers separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.

### Local Group (6)

#### Tier 1 (group ranks 1-2)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 6 | `whisper-small` | 96.62 | 94.91 | 96.67 | 100.00 |
| 2 | 7 | `whisper-large-v3-turbo` | 96.55 | 96.00 | 94.19 | 100.00 |

#### Tier 2 (group ranks 3-4)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 3 | 8 | `whisper-base` | 96.10 | 93.06 | 98.29 | 100.00 |
| 4 | 13 | `whisper-medium` | 95.31 | 94.67 | 91.91 | 100.00 |

#### Tier 3 (group ranks 5-6)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 15 | `whisper-tiny` | 94.90 | 90.39 | 98.83 | 100.00 |
| 6 | 31 | `reverb-reverb` | 69.53 | 89.05 | 0.00 | 100.00 |


### Third-Party Diarization Group (14)

#### Tier 1 (group ranks 1-4)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 1 | `happyscribe-auto` | 98.38 | 98.85 | 95.82 | 100.00 |
| 2 | 11 | `soniox-stt-async-v4` | 95.68 | 96.45 | 96.74 | 93.06 |
| 3 | 12 | `assemblyai-universal-3-pro` | 95.54 | 98.94 | 98.85 | 85.42 |
| 4 | 14 | `mistral-voxtral-mini-2602` | 95.20 | 97.17 | 98.97 | 87.50 |

#### Tier 2 (group ranks 5-8)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 5 | 16 | `rev-low_cost` | 93.17 | 93.39 | 92.83 | 93.06 |
| 6 | 17 | `elevenlabs-scribe_v2` | 93.07 | 96.29 | 94.96 | 84.73 |
| 7 | 18 | `rev-machine` | 92.96 | 94.11 | 97.53 | 86.11 |
| 8 | 22 | `speechmatics-standard` | 89.04 | 95.16 | 97.05 | 68.76 |

#### Tier 3 (group ranks 9-14)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 9 | 23 | `deepgram-nova-3` | 87.48 | 95.19 | 99.95 | 59.60 |
| 10 | 24 | `gladia-default` | 87.17 | 96.56 | 97.92 | 57.66 |
| 11 | 26 | `speechmatics-enhanced` | 84.16 | 96.38 | 95.94 | 47.94 |
| 12 | 27 | `grok-speech-to-text` | 83.77 | 92.82 | 99.45 | 50.00 |
| 13 | 29 | `gcloud-chirp_3` | 75.31 | 95.01 | 77.86 | 33.36 |
| 14 | 30 | `aws-standard` | 70.78 | 94.63 | 93.87 | 0.00 |


### Third-Party Non-Diarization Group (11)

#### Tier 1 (group ranks 1-3)

Best balanced options across accuracy, processing speed, and cost efficiency.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1 | 2 | `supadata-auto` | 97.83 | 95.73 | 99.84 | 100.00 |
| 2 | 3 | `deepinfra-openai_whisper-large-v3-turbo` | 97.54 | 95.94 | 99.12 | 99.17 |
| 3 | 4 | `deepinfra-openai_whisper-large-v3` | 97.12 | 96.20 | 97.97 | 98.13 |

#### Tier 2 (group ranks 4-6)

Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 4 | 5 | `groq-whisper-large-v3-turbo` | 97.07 | 95.99 | 99.07 | 97.22 |
| 5 | 9 | `together-openai_whisper-large-v3` | 95.92 | 94.96 | 100.00 | 93.75 |
| 6 | 10 | `groq-whisper-large-v3` | 95.80 | 95.73 | 99.45 | 92.29 |

#### Tier 3 (group ranks 7-11)

Lowest balanced options, generally weaker across the combined benchmark categories.

| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 7 | 19 | `glm-stt-glm-asr-2512` | 92.95 | 93.90 | 93.99 | 90.00 |
| 8 | 20 | `openai-stt-gpt-4o-mini-transcribe` | 89.69 | 86.63 | 98.00 | 87.50 |
| 9 | 21 | `deapi-WhisperLargeV3` | 89.37 | 81.59 | 95.84 | 98.47 |
| 10 | 25 | `openai-stt-gpt-4o-transcribe` | 86.94 | 88.14 | 96.48 | 75.01 |
| 11 | 28 | `gemini-stt-gemini-3-flash-preview` | 79.50 | 68.57 | 88.84 | 92.00 |



## Ranking

| Rank | Provider | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `assemblyai-universal-3-pro` | 98.94 | 1.06% | 1.04% | 39.06s | 14.1344¢ ($0.1413) |
| 2 | `happyscribe-auto` | 98.85 | 1.15% | 1.14% | 123.92s | 0.0000¢ ($0.0000) |
| 3 | `mistral-voxtral-mini-2602` | 97.17 | 2.83% | 2.71% | 35.79s | 12.1152¢ ($0.1212) |
| 4 | `gladia-default` | 96.56 | 3.44% | 3.29% | 65.11s | 41.0571¢ ($0.4106) |
| 5 | `soniox-stt-async-v4` | 96.45 | 3.55% | 3.43% | 98.17s | 6.7307¢ ($0.0673) |
| 6 | `speechmatics-enhanced` | 96.38 | 3.62% | 3.47% | 120.76s | 50.4800¢ ($0.5048) |
| 7 | `elevenlabs-scribe_v2` | 96.29 | 3.71% | 2.87% | 148.07s | 14.8075¢ ($0.1481) |
| 8 | `deepinfra-openai_whisper-large-v3` | 96.20 | 3.80% | 2.98% | 63.78s | 1.8173¢ ($0.0182) |
| 9 | `whisper-large-v3-turbo` | 96.00 | 4.00% | 3.20% | 169.61s | n/a |
| 10 | `groq-whisper-large-v3-turbo` | 95.99 | 4.01% | 3.20% | 32.99s | 2.6923¢ ($0.0269) |
| 11 | `deepinfra-openai_whisper-large-v3-turbo` | 95.94 | 4.06% | 3.24% | 31.63s | 0.8077¢ ($0.0081) |
| 12 | `supadata-auto` | 95.73 | 4.27% | 3.44% | 11.29s | 0.0000¢ ($0.0000) |
| 13 | `groq-whisper-large-v3` | 95.73 | 4.27% | 3.46% | 22.40s | 7.4710¢ ($0.0747) |
| 14 | `deepgram-nova-3` | 95.19 | 4.81% | 3.78% | 8.35s | 39.1725¢ ($0.3917) |
| 15 | `speechmatics-standard` | 95.16 | 4.84% | 4.67% | 89.48s | 30.2880¢ ($0.3029) |
| 16 | `gcloud-chirp_3` | 95.01 | 4.99% | 4.20% | 627.41s | 64.6144¢ ($0.6461) |
| 17 | `together-openai_whisper-large-v3` | 94.96 | 5.04% | 4.25% | 6.88s | 6.0576¢ ($0.0606) |
| 18 | `whisper-small` | 94.91 | 5.09% | 4.30% | 100.25s | n/a |
| 19 | `whisper-medium` | 94.67 | 5.33% | 4.57% | 233.65s | n/a |
| 20 | `aws-standard` | 94.63 | 5.37% | 4.49% | 178.82s | 96.9600¢ ($0.9696) |
| 21 | `rev-machine` | 94.11 | 5.89% | 5.43% | 76.17s | 13.4667¢ ($0.1347) |
| 22 | `glm-stt-glm-asr-2512` | 93.90 | 6.10% | 5.30% | 175.30s | 9.6922¢ ($0.0969) |
| 23 | `rev-low_cost` | 93.39 | 6.61% | 6.14% | 207.78s | 6.7333¢ ($0.0673) |
| 24 | `whisper-base` | 93.06 | 6.94% | 6.20% | 54.87s | n/a |
| 25 | `grok-speech-to-text` | 92.82 | 7.18% | 6.80% | 22.41s | n/a |
| 26 | `whisper-tiny` | 90.39 | 9.61% | 8.89% | 39.63s | n/a |
| 27 | `reverb-reverb` | 89.05 | 10.95% | 10.06% | 2809.75s | 0.0000¢ ($0.0000) |
| 28 | `openai-stt-gpt-4o-transcribe` | 88.14 | 11.86% | 11.12% | 105.57s | 24.2304¢ ($0.2423) |
| 29 | `openai-stt-gpt-4o-mini-transcribe` | 86.63 | 13.37% | 12.63% | 62.96s | 12.1152¢ ($0.1212) |
| 30 | `deapi-WhisperLargeV3` | 81.59 | 18.41% | 17.74% | 123.47s | 1.4826¢ ($0.0148) |
| 31 | `gemini-stt-gemini-3-flash-preview` | 68.57 | 31.43% | 30.85% | 319.60s | 7.7537¢ ($0.0775) |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| `assemblyai-universal-3-pro` | 34 | 32 | 19 | 8158 |
| `happyscribe-auto` | 38 | 33 | 22 | 8158 |
| `mistral-voxtral-mini-2602` | 115 | 41 | 65 | 8158 |
| `gladia-default` | 129 | 75 | 64 | 8158 |
| `soniox-stt-async-v4` | 154 | 36 | 90 | 8158 |
| `speechmatics-enhanced` | 161 | 63 | 59 | 8158 |
| `elevenlabs-scribe_v2` | 119 | 50 | 65 | 8158 |
| `deepinfra-openai_whisper-large-v3` | 121 | 64 | 58 | 8158 |
| `whisper-large-v3-turbo` | 137 | 50 | 74 | 8158 |
| `groq-whisper-large-v3-turbo` | 135 | 66 | 60 | 8158 |
| `deepinfra-openai_whisper-large-v3-turbo` | 128 | 75 | 61 | 8158 |
| `supadata-auto` | 144 | 59 | 78 | 8158 |
| `groq-whisper-large-v3` | 141 | 75 | 66 | 8158 |
| `deepgram-nova-3` | 156 | 92 | 60 | 8158 |
| `speechmatics-standard` | 220 | 71 | 90 | 8158 |
| `gcloud-chirp_3` | 183 | 59 | 101 | 8158 |
| `together-openai_whisper-large-v3` | 147 | 129 | 71 | 8158 |
| `whisper-small` | 185 | 95 | 71 | 8158 |
| `whisper-medium` | 206 | 78 | 89 | 8158 |
| `aws-standard` | 218 | 48 | 100 | 8158 |
| `rev-machine` | 261 | 70 | 112 | 8158 |
| `glm-stt-glm-asr-2512` | 240 | 121 | 71 | 8158 |
| `rev-low_cost` | 289 | 96 | 116 | 8158 |
| `whisper-base` | 276 | 118 | 112 | 8158 |
| `grok-speech-to-text` | 174 | 321 | 60 | 8158 |
| `whisper-tiny` | 419 | 159 | 147 | 8158 |
| `reverb-reverb` | 396 | 186 | 239 | 8158 |
| `openai-stt-gpt-4o-transcribe` | 128 | 729 | 50 | 8158 |
| `openai-stt-gpt-4o-mini-transcribe` | 127 | 843 | 60 | 8158 |
| `deapi-WhisperLargeV3` | 329 | 434 | 684 | 8158 |
| `gemini-stt-gemini-3-flash-preview` | 95 | 2375 | 47 | 8158 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| `whisper-medium` | Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts. |
| `glm-stt-glm-asr-2512` | GLM returned all-zero-duration segment timing. |
| `openai-stt-gpt-4o-transcribe` | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| `openai-stt-gpt-4o-mini-transcribe` | OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels. |
| `deapi-WhisperLargeV3` | deAPI raw response used bracket timestamp blocks; report uses cleaned parsed transcript text. |

## Notes

- `assemblyai-universal-3-pro` was the most accurate provider on strict speaker-aware WER, scoring 98.94/100.
- Best overall provider: `happyscribe-auto` scored 98.38/100 using balanced overall weighting.
- Worst overall provider: `reverb-reverb` scored 69.53/100 using balanced overall weighting.
- The cheapest providers were `happyscribe-auto`, `supadata-auto`, and `reverb-reverb` at 0.0000¢ ($0.0000).
- `together-openai_whisper-large-v3` was the fastest provider in this set at 6.88s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 1.04 percentage-point gap between text-only and speaker-aware WER.
