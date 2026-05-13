# Output Contract

## Input Contract

Use this skill against an AutoShow TTS run directory that contains:

1. `run.json` with `kind: "tts"` and a `metadata.tts[]` array listing each provider entry
2. Audio files in the run directory matching `metadata.tts[].audioFileName`
3. A path to the original input text that was synthesized

The run directory does not use a `providers/` subdirectory. Each TTS entry is a flat audio file in the root of the run directory, identified by its `audioFileName` field.

## Consensus Evaluation Contract

Write `consensus-evaluation.txt` as plain text with these sections:

1. **Input summary** -- character count, word count, source path
2. **Local models analysis** -- for each local provider, report available metrics (speaking rate, duration, file size, processing time, roundtrip WER if available)
3. **Cloud services analysis** -- for each cloud provider, report available metrics (speaking rate, duration, file size, cost, processing time, roundtrip WER if available)
4. **Recommendation** -- select best local model and best cloud service with justification
5. **Caveats** -- state which metrics were and were not available; acknowledge that audio quality cannot be directly assessed

Rules:

1. Do not claim to have listened to audio.
2. Do not fabricate subjective quality assessments.
3. Base all claims on evidence packet data.
4. Plain text only, no markdown formatting.

## Comparison Report Contract

Generate both:

1. `provider-comparison-report.md`
2. `provider-comparison-report.json`

Providers are separated into two comparison groups:

1. **Local models** -- providers that run locally (e.g. kitten). Ranked independently without a cost column since they are free.
2. **Cloud services** -- providers that use remote APIs. Ranked independently with cost as a factor.

Scoring rules:

1. If roundtrip STT transcriptions are available, score using `max(0, 100 * (1 - roundtripWER))`. Roundtrip WER is the most important signal.
2. Without roundtrip data, score using a composite: 60% speaking rate naturalness (120-180 c/s optimal for English), 20% cost efficiency, 20% processing speed.
3. Cost and processing time are extracted from `run.json` metadata (actual if available, estimated as fallback).
4. Each group is ranked independently so local and cloud providers are not mixed.
5. Overall score formula: `50% accuracy + 25% processing speed + 25% cost efficiency`, exposed as `overallMetric: "balanced-overall"` with `overallWeights: { accuracy: 0.5, processingSpeed: 0.25, costEfficiency: 0.25 }`.
6. Overall accuracy uses roundtrip WER when available; providers missing roundtrip accuracy receive a neutral 50/100 accuracy component marked as `missing-roundtrip-accuracy`.
7. Overall processing speed and cost are min/max normalized across available provider values with lower values better, local providers score as zero monetary cost, and missing timing or missing cloud cost receives a neutral 50/100 component score.
8. Overall ranking sorts by `overallScore` descending, then accuracy component, speed component, cost component, and provider key ascending. The markdown report identifies both best and worst overall providers.
9. Tier breakdown uses `tiering.metric: "balanced-overall"` and `tiering.method: "equal-thirds-by-group-overall-rank"` to split local and third-party overall rankings independently; if a group count is not divisible by three, the remainder is assigned to that group's Tier 3.

The JSON report uses `overall`, `local`, and `cloud` top-level keys instead of a flat `providers` array. It also includes a `tiering` top-level object with `local` and `thirdParty` groups. Each provider object includes backward-compatible `score` fields plus `overallScore`, `overallRank`, `overallComponents`, `tierGroup`, `groupOverallRank`, and `groupTier`.

The report script uses only:

1. `run.json` metadata
2. Audio files on disk (for ffprobe duration measurement)
3. Original input text (for character/word counts and roundtrip WER reference)
4. Optional roundtrip STT transcription files

## Helper Artifact Guidance

`build_evaluation_packet.ts` emits a temporary evidence packet. Prefer writing it outside the run directory or deleting it after use so the final directory contains only the three requested deliverables plus original audio files.
