# Output Contract

## Input Contract

Use this skill against an AutoShow OCR run directory that contains:

1. `run.json` with `kind: "ocr"` or `kind: "extract"` and `metadata.step2[]` array
2. `providers/*/result.json` with `schemaVersion: 2` and `kind: "provider-result"`
3. Optional `providers/*/extraction.txt`

Trust the provider directories that actually exist on disk. If an old report mentions providers that are missing from `providers/`, ignore the stale report and regenerate from the current files.

## Consensus Extraction Contract

Write `consensus-extraction.txt` as plain text.

For multi-page documents, use `--- Page N ---` delimiters between pages:

```text
--- Page 0 ---
First page text here.

--- Page 1 ---
Second page text here.
```

For single-page documents, omit the delimiter and write the text directly.

Rules:

1. Keep wording faithful to the strongest cross-provider reading; do not summarize or paraphrase.
2. Resolve obvious OCR errors using cross-provider evidence and surrounding context.
3. Do not add markdown, bullets, headings, or summaries.
4. Plain text only.

## Comparison Report Contract

Generate both:

1. `provider-comparison-report.md`
2. `provider-comparison-report.json`

The ranking is based on word error rate (WER) against `consensus-extraction.txt`.

Scoring rules:

1. WER compares the provider's full word stream against the gold extraction word stream after text normalization.
2. CER compares normalized character sequences for finer-grained accuracy measurement.
3. Score formula: `max(0, 100 * (1 - WER))`.
4. Overall score formula: `50% accuracy + 25% processing speed + 25% cost efficiency`, exposed as `overallMetric: "balanced-overall"` with `overallWeights: { accuracy: 0.5, processingSpeed: 0.25, costEfficiency: 0.25 }`.
5. Overall accuracy uses the WER-derived score, processing speed and cost are min/max normalized across available provider values with lower values better, local providers score as zero monetary cost, and missing timing or missing cloud cost receives a neutral 50/100 component score.
6. Overall ranking sorts by `overallScore` descending, then accuracy component, speed component, cost component, and provider key ascending. The markdown report identifies both best and worst overall providers.
7. Tier breakdown uses `tiering.metric: "balanced-overall"` and `tiering.method: "equal-thirds-by-group-overall-rank"` to split local and third-party overall rankings independently; if a group count is not divisible by three, the remainder is assigned to that group's Tier 3.
8. Providers are separated into local models (tesseract, ocrmypdf, paddle-ocr) and cloud services for independent ranking.
9. The local provider table does not include a Cost column.
10. WER and CER breakdowns report substitutions, deletions, and insertions separately: `WER = (S + D + I) / N`.
11. Text normalization expands contractions, abbreviations, and currency symbols, and strips punctuation before comparison to avoid penalizing formatting differences as recognition errors.

The report script uses only:

1. `consensus-extraction.txt`
2. `providers/*/result.json`
3. `run.json` cost and timing metadata

It ignores:

1. `providers/*/extraction.txt`
2. Any pre-existing `provider-comparison-report.*` files

JSON report uses `overall`, `local`, and `cloud` top-level keys, each containing `count` and `providers` arrays. It also includes a `tiering` top-level object with `local` and `thirdParty` groups. Each provider object includes backward-compatible `score` fields plus `overallScore`, `overallRank`, `overallComponents`, `tierGroup`, `groupOverallRank`, and `groupTier`.

## Helper Artifact Guidance

`build_consensus_packet.ts` can emit a temporary evidence packet. Prefer writing that helper file outside the run directory or deleting it after use so the final directory only contains the three requested deliverables plus the original run files.
