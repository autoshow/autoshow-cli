---
name: ocr-consensus
description: Use this skill when the user needs a gold-reference text extraction or provider comparison reports from a multi-provider AutoShow OCR run. Apply it to reconcile provider extractions into a consensus text, generate accuracy comparison reports, or evaluate OCR quality across providers for PDFs, images, or other document types.
compatibility: Requires Bun
allowed-tools: Bash Read Edit Write Glob Grep
metadata:
  short-description: Build OCR consensus extraction and provider reports
  author: autoshow
  version: "1.0"
---

# Build OCR Consensus Report

## Overview

Turn a multi-provider AutoShow OCR run into three deliverables:

1. `consensus-extraction.txt`
2. `provider-comparison-report.md`
3. `provider-comparison-report.json`

Use the scripts in `scripts/` for the deterministic parts. Use agent judgment only for the consensus-writing pass.

Read `references/output-contract.md` before writing outputs.

## Workflow

Progress:

- [ ] Set the run directory.
- [ ] Verify the actual provider set from `providers/*/result.json`.
- [ ] Build a temporary consensus-evidence packet.
- [ ] Write `consensus-extraction.txt`.
- [ ] Generate both comparison reports from the consensus extraction.
- [ ] Run a final sanity pass on provider count, page count, and output paths.

## Commands

Run commands from the skill directory so script paths stay relative to the skill root. The skill directory is the directory containing this SKILL.md file.

```bash
RUN_DIR="/absolute/path/to/document-run"
SKILL_DIR="/absolute/path/to/ocr-consensus"
TMP_PACKET="$(mktemp -t ocr-consensus-packet.XXXXXX.json)"

cd "$SKILL_DIR"
bun scripts/build_consensus_packet.ts "$RUN_DIR" --out "$TMP_PACKET"
```

This prepares evidence for the consensus pass. Generate reports only after `consensus-extraction.txt` exists.

## Consensus Pass

Use the evidence packet as the primary navigation layer, then fall back to raw `providers/*/result.json` when a page is still ambiguous.

Rules for `consensus-extraction.txt`:

1. Start from the baseline provider suggested by `build_consensus_packet.ts`.
2. For multi-page documents, use `--- Page N ---` delimiters between pages.
3. Prefer the reading that best matches cross-provider agreement plus local context; do not summarize or paraphrase.
4. Resolve obvious OCR-specific mistakes such as garbled characters, wrong words, broken line breaks, misrecognized punctuation, and mangled proper nouns.
5. If only one provider has a plausible reading and it clearly fits the surrounding context, use it.
6. Do not copy stale text from existing reports. Treat `providers/*/result.json` and the evidence packet as the source of truth.
7. Do not add helper sections, notes, markdown formatting, or commentary to the extraction file.
8. Plain text only. No markdown, bullets, headings, or summaries.

## Report Generation

After the consensus extraction is complete, run:

```bash
cd "$SKILL_DIR"
bun scripts/build_comparison_report.ts "$RUN_DIR"
```

This writes:

1. `provider-comparison-report.md`
2. `provider-comparison-report.json`

The report script:

1. Parses `consensus-extraction.txt` as the gold reference.
2. Uses the provider's full extracted text from `result.json` for scoring.
3. Normalizes text before comparison: expands contractions (it's -> it is), abbreviations (mr. -> mister), currency symbols ($50 -> 50 dollars), and strips remaining punctuation.
4. Computes word error rate (WER) and character error rate (CER) against the consensus.
5. Reports WER and CER breakdowns with substitutions, deletions, and insertions: `WER = (S + D + I) / N`.
6. Ranks providers by WER within separate local and cloud groups.
7. Pulls actual cost and processing time from `run.json` when available.
8. Adds a combined overall leaderboard using `overallScore = 50% accuracy + 25% processing speed + 25% cost efficiency`, and reports the best and worst overall providers.
9. Ignores `extraction.txt` files and any pre-existing comparison reports.

## Validation Checklist

1. Confirm `consensus-extraction.txt` exists and is plain text without markdown formatting.
2. Confirm the providers counted in the report match the providers that actually exist under `providers/`.
3. Confirm `provider-comparison-report.md` and `.json` were regenerated after the consensus extraction changed.
4. Confirm local and cloud providers are ranked in separate groups.
5. Confirm the markdown report contains `Overall Ranking` and `Tier Breakdown` sections with best and worst overall notes.
6. Confirm the JSON report contains `overallMetric`, `overallWeights`, `overall`, `tiering`, and per-provider `overallComponents`, `tierGroup`, `groupOverallRank`, and `groupTier`.
7. Confirm the local provider table does not include a Cost column.
8. Delete temporary helper files such as the consensus packet unless the user explicitly wants to keep them.
9. If a script fails, report the exact command, the run directory, and the first actionable error line.

## Gotchas

1. Trust the provider directories currently present on disk; ignore stale provider names in older reports.
2. Treat `providers/*/result.json` and the consensus evidence packet as source material, not `extraction.txt` or old comparison reports.
3. Provider directories use `service-model` naming (e.g., `mistral-mistral-ocr-2512`, `tesseract-tesseract`).
4. Local providers (tesseract, ocrmypdf, paddle-ocr) have no cost data. Cloud providers (mistral, glm, openai, anthropic, gemini) have cost in `run.json`.
5. Some providers may have failed (check `providerStates` in `run.json`); only providers with `result.json` on disk are scored.
6. Page numbers may be 0-based or 1-based depending on the provider. The scripts handle normalization.
7. Use agent judgment only for writing the consensus extraction. Provider discovery, packet creation, and report generation belong to the bundled scripts.

## Reporting

When you finish, report:

1. Which run directory was processed.
2. Which providers were discovered on disk.
3. Whether any run/report inconsistency was ignored as stale input.
4. Where the three final deliverables were written.
