---
name: url-consensus
description: Use this skill when the user needs a gold-reference article extraction or provider comparison reports from a multi-provider AutoShow URL article run. Apply it to reconcile URL backend outputs such as defuddle, firecrawl, glm-reader, spider, and zyte, generate comparison reports, or evaluate URL extraction quality across local and hosted providers.
compatibility: Requires Bun
allowed-tools: Bash Read Edit Write Glob Grep
metadata:
  short-description: Build URL article consensus extraction and provider reports
  author: autoshow
  version: "1.0"
---

# Build URL Consensus Report

## Overview

Turn a multi-provider AutoShow URL article run into three deliverables:

1. `consensus-extraction.txt`
2. `provider-comparison-report.md`
3. `provider-comparison-report.json`

Use the scripts in `scripts/` for provider discovery, scoring, and reports. Use agent judgment only for the consensus-writing pass.

Read `references/output-contract.md` before writing outputs.

## Workflow

Progress:

- [ ] Set the run directory.
- [ ] Verify providers from `providers/*/result.json`.
- [ ] Build a temporary consensus-evidence packet.
- [ ] Write `consensus-extraction.txt`.
- [ ] Generate both comparison reports from the consensus extraction.
- [ ] Run a final sanity pass on provider count, URL metadata, and output paths.

## Commands

Run commands from the skill directory so script paths stay relative to the skill root.

```bash
RUN_DIR="/absolute/path/to/url-run"
SKILL_DIR="/absolute/path/to/url-consensus"
TMP_PACKET="$(mktemp -t url-consensus-packet.XXXXXX.json)"

cd "$SKILL_DIR"
bun scripts/build_consensus_packet.ts "$RUN_DIR" --out "$TMP_PACKET"
```

Generate reports only after `consensus-extraction.txt` exists:

```bash
cd "$SKILL_DIR"
bun scripts/build_comparison_report.ts "$RUN_DIR"
```

## Consensus Pass

Use the evidence packet first, then inspect raw `providers/*/result.json` when provider outputs disagree.

Rules for `consensus-extraction.txt`:

1. Start from the baseline provider suggested by `build_consensus_packet.ts`.
2. Preserve article content and article structure. Headings and list markers are acceptable when they represent the source article.
3. Prefer the reading that best matches cross-provider agreement plus article context; do not summarize or paraphrase.
4. Remove extraction boilerplate, duplicated navigation text, cookie banners, paywall snippets, and unrelated page chrome when other providers agree it is not article content.
5. Keep useful article links only when they are part of the article text; remove tracking-only or UI-only links.
6. If only one provider has a plausible reading and it clearly fits the surrounding context, use it.
7. Do not copy stale text from old reports. Treat provider `result.json` files and the evidence packet as source material.
8. Do not add helper sections, scoring notes, or commentary to the extraction file.

## Report Generation

The report script:

1. Parses `consensus-extraction.txt` as the gold reference.
2. Uses each provider's `result.text` from `providers/*/result.json`.
3. Converts Markdown-like article text to plain text for scoring.
4. Computes word error rate, character error rate, and content-token coverage.
5. Separates local (`defuddle`) and hosted providers for group rankings.
6. Pulls actual cost and processing time from `run.json` when available, falling back to provider metadata timing.
7. Adds a combined leaderboard with `overallScore = 50% accuracy + 25% processing speed + 25% cost efficiency`.
8. Ignores root `extraction.txt`, root `result.json`, and pre-existing comparison reports.

## Validation Checklist

1. Confirm `consensus-extraction.txt` exists and contains only reconciled article extraction content.
2. Confirm providers in the report match `providers/*/result.json` on disk.
3. Confirm `provider-comparison-report.md` and `.json` were regenerated after consensus changed.
4. Confirm local and hosted providers are ranked separately and together.
5. Confirm markdown report contains `Overall Ranking` and `Tier Breakdown`.
6. Confirm JSON report contains `overallMetric`, `overallWeights`, `overall`, `tiering`, and per-provider `overallComponents`.
7. Delete temporary packet files unless the user explicitly wants to keep them.
8. If a script fails, report the command, run directory, and first actionable error line.

## Gotchas

1. Trust provider directories on disk; ignore stale provider names in older reports.
2. URL provider directories are named by backend only, such as `providers/defuddle` and `providers/firecrawl`.
3. In local HTML all-url runs, hosted providers may be marked skipped in `run.json` and have no provider directory. Do not score skipped providers.
4. Some hosted providers can include boilerplate or metadata-like text. Consensus should reflect the article, not a majority vote for boilerplate.
5. Use agent judgment only for writing the consensus extraction. Provider discovery, packet creation, and report generation belong to the bundled scripts.

## Reporting

When finished, report:

1. Which run directory was processed.
2. Which providers were discovered on disk.
3. Whether any skipped or stale provider state was ignored.
4. Where the three final deliverables were written.
