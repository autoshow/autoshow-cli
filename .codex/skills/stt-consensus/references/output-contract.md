# Output Contract

## Input Contract

Use this skill against an AutoShow STT run directory that contains:

1. `run.json`
2. `providers/*/result.json`
3. Optional `providers/*/transcription.txt`

Trust the provider directories that actually exist on disk. If an old report mentions providers that are missing from `providers/`, ignore the stale report and regenerate from the current files.

## Consensus Transcript Contract

Write `consensus-transcription.txt` in this exact line-oriented format:

```text
[00:00:10] [speaker-1] Welcome to the podcast.
[00:00:28] [speaker-2] Thanks for having me.
```

Rules:

1. Use one segment per line.
2. Use start timestamps only.
3. Use stable canonical speaker labels such as `speaker-1`, `speaker-2`, and so on.
4. Keep chronological order.
5. Do not add markdown, bullets, headings, or summaries.
6. Keep wording faithful to the strongest cross-provider reading; do not summarize.

## Comparison Report Contract

Generate both:

1. `reference-comparison-report.md`
2. `reference-comparison-report.json`

The ranking is based on strict speaker-aware WER against `consensus-transcription.txt`.

Scoring rules:

1. Text-only WER must compare the provider's full ordered word stream against the gold transcript word stream.
2. Speaker-aware WER must use that same ordered word stream after mapping provider speaker IDs onto canonical speakers and inserting synthetic speaker-change tokens.
3. Do not penalize providers for failing to match the gold segment boundaries exactly.
4. WER breakdown reports substitutions, deletions, and insertions separately: `WER = (S + D + I) / N`.
5. Text normalization expands contractions, abbreviations, and currency symbols, removes filler words, and strips punctuation before tokenization to avoid penalizing formatting differences as recognition errors.

The report script intentionally uses only:

1. `consensus-transcription.txt`
2. `providers/*/result.json`
3. `run.json` cost and timing metadata

It ignores:

1. `providers/*/transcription.txt`
2. Any pre-existing `reference-comparison-report.*` files

## Helper Artifact Guidance

`build_consensus_packet.ts` can emit a temporary evidence packet. Prefer writing that helper file outside the run directory or deleting it after use so the final directory only contains the three requested deliverables.
