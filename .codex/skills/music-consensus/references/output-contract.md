# Output Contract

## Input Contract

Use this skill against one AutoShow music run directory that contains:

1. `run.json` with `kind: "music"` and a `metadata.music[]` array listing each provider entry
2. Music files in the run directory matching `metadata.music[].musicFileName`

The run directory does not use a `providers/` subdirectory. Each music entry is a flat file in the root of the run directory, identified by its `musicFileName` field.

## Consensus Evaluation Contract

Write `consensus-evaluation.txt` as plain text with these sections:

1. **Run summary** -- provider count, prompt/input if available from `run.json`
2. **Per-provider analysis** -- for each provider, report available metrics (artifact existence, file size, duration metadata, processing time, cost)
3. **Recommendation** -- select cheapest provider, fastest provider, and best overall by price-speed score
4. **Caveats** -- state which metrics were and were not available; acknowledge that audio/music quality cannot be directly assessed

Rules:

1. Do not claim to have listened to audio.
2. Do not fabricate subjective audio or music quality assessments.
3. Base all claims on evidence packet data.
4. Plain text only, no markdown formatting.

## Comparison Report Contract

Generate both:

1. `provider-comparison-report.md`
2. `provider-comparison-report.json`

Providers are ranked in a single flat list.

Scoring rules:

1. Score using price-speed only: 50% cost efficiency and 50% processing speed.
2. Cost is extracted from `metadata.cost.actual.steps`, falling back to `metadata.cost.estimated.steps`.
3. Processing time is extracted from `metadata.timing.actual.steps`, falling back to `metadata.timing.estimated.steps`, then entry `processingTime`.
4. Lower cost and lower processing time are better.
5. Missing cost or timing receives a neutral component score of 50.
6. If all available values for a metric are equal, providers with that metric receive 100 for that component.
7. Artifact files are verified and listed, but file size, duration, format, bitrate, lyrics, and quality are not scoring inputs.

The JSON report uses a flat `providers` array (no local/cloud grouping).

The report script uses only:

1. `run.json` metadata
2. Music files on disk (for existence and file size context)

## Helper Artifact Guidance

`build_evaluation_packet.ts` emits a temporary evidence packet. Prefer writing it outside the run directory or deleting it after use so the final directory contains only the three requested deliverables plus original music files.
