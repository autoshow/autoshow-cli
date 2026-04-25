# Output Contract

## Input Contract

Use this skill against an AutoShow image run directory that contains:

1. `run.json` with `kind: "image"` and a `metadata.image[]` array listing each provider entry
2. Image files in the run directory matching `metadata.image[].imageFileNames`

The run directory does not use a `providers/` subdirectory. Each image entry is a flat file in the root of the run directory, identified by its `imageFileNames` field.

## Consensus Evaluation Contract

Write `consensus-evaluation.txt` as plain text with these sections:

1. **Run summary** -- provider count, prompt (if available from run.json)
2. **Per-provider analysis** -- for each provider, report available metrics (dimensions, file size, format, processing time, cost, file size efficiency)
3. **Recommendation** -- select best value, fastest provider, and best overall (if quality rankings provided)
4. **Caveats** -- state which metrics were and were not available; acknowledge that image quality cannot be directly assessed

Rules:

1. Do not claim to have viewed or assessed image quality.
2. Do not fabricate subjective quality assessments.
3. Base all claims on evidence packet data.
4. Plain text only, no markdown formatting.

## Comparison Report Contract

Generate both:

1. `provider-comparison-report.md`
2. `provider-comparison-report.json`

All image providers are cloud APIs. There is no local/cloud split. Providers are ranked in a single flat list.

Scoring rules:

1. Without user quality rankings, score using a composite: 33% cost efficiency, 33% processing speed, 34% file size efficiency (bytes per megapixel -- lower is better).
2. With user quality rankings, score using: 50% quality rank, 25% cost efficiency, 25% processing speed.
3. Cost and processing time are extracted from `run.json` metadata (actual if available, estimated as fallback).
4. File size efficiency uses bytes per pixel from probed image dimensions and file size. This measures compression, not visual quality.

The JSON report uses a flat `providers` array (no local/cloud grouping).

The report script uses only:

1. `run.json` metadata
2. Image files on disk (for dimension probing and file size verification)
3. Optional user quality rankings

## Helper Artifact Guidance

`build_evaluation_packet.ts` emits a temporary evidence packet. Prefer writing it outside the run directory or deleting it after use so the final directory contains only the three requested deliverables plus original image files.
