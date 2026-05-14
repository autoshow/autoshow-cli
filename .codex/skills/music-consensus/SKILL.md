---
name: music-consensus
description: Use this skill when the user needs to compare and evaluate multiple music generation providers from one AutoShow music run directory. Apply it to rank providers by price and processing speed only, and produce a consensus evaluation with comparison reports.
compatibility: Requires Bun
allowed-tools: Bash Read Edit Write Glob Grep
metadata:
  short-description: Build music consensus evaluation and provider reports
  author: autoshow
  version: "1.0"
---

# Build Music Consensus Report

## Overview

Turn one multi-provider AutoShow music run into three deliverables:

1. `consensus-evaluation.txt`
2. `provider-comparison-report.md`
3. `provider-comparison-report.json`

Use the scripts in `scripts/` for deterministic data extraction and ranking. Use agent judgment only for the evaluation-writing pass.

Read `references/output-contract.md` before writing outputs.

## Workflow

Progress:

- [ ] Set the run directory.
- [ ] Verify music files from `metadata.music[]` exist on disk.
- [ ] Build a temporary evaluation evidence packet.
- [ ] Write `consensus-evaluation.txt`.
- [ ] Generate both comparison reports.
- [ ] Run a final sanity pass.

## Commands

Run commands from the skill directory so script paths stay relative to the skill root. The skill directory is the directory containing this SKILL.md file.

```bash
RUN_DIR="/absolute/path/to/music-run"
SKILL_DIR="/absolute/path/to/music-consensus"
TMP_PACKET="$(mktemp -t music-eval-packet.XXXXXX.json)"

cd "$SKILL_DIR"
bun scripts/build_evaluation_packet.ts "$RUN_DIR" --out "$TMP_PACKET"
```

This prepares evidence for the evaluation pass. Generate reports only after `consensus-evaluation.txt` exists.

## Evaluation Pass

Use the evidence packet as the primary data source for writing the evaluation.

Rules for `consensus-evaluation.txt`:

1. Do not claim to have listened to audio.
2. Do not fabricate subjective audio or music quality assessments.
3. Base all claims on evidence packet data (artifact existence, file size, duration metadata, processing time, cost).
4. Rank providers by price-speed scoring only: 50% cost efficiency and 50% processing speed.
5. Treat file size, duration, MIME type, bitrate, lyrics, and quality as context only, not scoring inputs.
6. Analyze each provider individually.
7. State which metrics were and were not available.
8. Plain text, no markdown formatting.

## Report Generation

After the consensus evaluation is complete, run:

```bash
cd "$SKILL_DIR"
bun scripts/build_comparison_report.ts "$RUN_DIR"
```

This writes:

1. `provider-comparison-report.md`
2. `provider-comparison-report.json`

The report script:

1. Reads `metadata.music[]` from `run.json` for the provider list.
2. Verifies music artifact files in the run directory.
3. Extracts cost and processing time from `run.json` metadata.
4. Applies price-speed scoring: 50% cost efficiency and 50% processing speed.
5. Ranks providers in a single flat list.

## Validation Checklist

1. Confirm `consensus-evaluation.txt` exists and does not contain markdown formatting or claims of having listened to audio.
2. Confirm the provider count in the report matches `metadata.music[]` length in `run.json`.
3. Confirm `provider-comparison-report.md` and `.json` were generated after the evaluation.
4. Confirm music files referenced in the report exist on disk or missing files are clearly warned.
5. Confirm scoring method (`price-speed`) is correctly stated.
6. Delete temporary helper files such as the evaluation packet unless the user explicitly wants to keep them.
7. If a script fails, report the exact command, the run directory, and the first actionable error line.

## Gotchas

1. Music files are in the run directory root, not in a `providers/` subdirectory.
2. The agent cannot listen to music files. All assessments must come from measurable metadata.
3. Cost data may be in `metadata.cost.actual.steps` or `metadata.cost.estimated.steps`. The scripts prefer actual data when available.
4. Timing data may be in `metadata.timing.actual.steps` or `metadata.timing.estimated.steps`; entry `processingTime` is the final fallback.
5. Single-provider runs can still be processed, but ranking is most useful with multiple `metadata.music[]` entries.

## Reporting

When you finish, report:

1. Which run directory was processed.
2. How many providers were evaluated.
3. Confirm price-speed scoring was used.
4. Where the three final deliverables were written.
5. Best overall provider with its score.
