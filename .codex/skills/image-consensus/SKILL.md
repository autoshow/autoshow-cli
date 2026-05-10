---
name: image-consensus
description: Use this skill when the user needs to compare and evaluate multiple image generation providers from a multi-provider AutoShow image run. Apply it to rank providers by cost efficiency, processing speed, and file characteristics, and produce a consensus evaluation with comparison reports.
compatibility: Requires Bun
allowed-tools: Bash Read Edit Write Glob Grep
metadata:
  short-description: Build image consensus evaluation and provider reports
  author: autoshow
  version: "1.0"
---

# Build Image Consensus Report

## Overview

Turn a multi-provider AutoShow image run into three deliverables:

1. `consensus-evaluation.txt`
2. `provider-comparison-report.md`
3. `provider-comparison-report.json`

Use the scripts in `scripts/` for the deterministic parts. Use agent judgment only for the evaluation-writing pass.

Read `references/output-contract.md` before writing outputs.

## Workflow

Progress:

- [ ] Set the run directory.
- [ ] Verify image files from `metadata.image[]` exist on disk.
- [ ] Build a temporary evaluation evidence packet.
- [ ] Optionally collect user quality rankings.
- [ ] Write `consensus-evaluation.txt`.
- [ ] Generate both comparison reports (with `--quality-rankings` if user provided rankings).
- [ ] Run a final sanity pass.

## Commands

Run commands from the skill directory so script paths stay relative to the skill root. The skill directory is the directory containing this SKILL.md file.

```bash
RUN_DIR="/absolute/path/to/image-run"
SKILL_DIR="/absolute/path/to/image-consensus"
TMP_PACKET="$(mktemp -t image-eval-packet.XXXXXX.json)"

cd "$SKILL_DIR"
bun scripts/build_evaluation_packet.ts "$RUN_DIR" --out "$TMP_PACKET"
```

This prepares evidence for the evaluation pass. Generate reports only after `consensus-evaluation.txt` exists.

## Evaluation Pass

Use the evidence packet as the primary data source for writing the evaluation.

Rules for `consensus-evaluation.txt`:

1. Do not claim to have viewed or assessed image quality.
2. Do not fabricate subjective quality assessments.
3. Base all claims on evidence packet data (file size, dimensions, processing time, cost).
4. If user quality rankings are provided, incorporate them as the primary signal.
5. Without user rankings, compare providers by cost efficiency, processing speed, and file size relative to dimensions.
6. Analyze each provider individually.
7. State which metrics were and were not available.
8. Plain text, no markdown formatting.

## User Quality Rankings (Optional)

The agent cannot view images. If the user has viewed the generated images and can provide subjective quality rankings (1 = best, N = worst), these can be passed to the report script to improve scoring accuracy.

Ask the user if they would like to provide quality rankings before generating the reports. If they decline or do not respond, proceed without rankings.

## Report Generation

After the consensus evaluation is complete, run:

```bash
cd "$SKILL_DIR"
bun scripts/build_comparison_report.ts "$RUN_DIR"
```

With user quality rankings:

```bash
cd "$SKILL_DIR"
bun scripts/build_comparison_report.ts "$RUN_DIR" \
  --quality-rankings "gemini/imagen-4.0-generate-001=1,openai/gpt-image-1=2,minimax/image-01=3"
```

This writes:

1. `provider-comparison-report.md`
2. `provider-comparison-report.json`

The report script:

1. Reads `metadata.image[]` from `run.json` for the provider list.
2. Probes image files for dimensions and file size.
3. Extracts cost and processing time from `run.json` metadata.
4. Optionally applies user quality rankings as the primary scoring signal.
5. Ranks providers in a single flat list (all providers are cloud APIs).

## Validation Checklist

1. Confirm `consensus-evaluation.txt` exists and does not contain markdown formatting or claims of having viewed images.
2. Confirm the provider count in the report matches `metadata.image[]` length in `run.json`.
3. Confirm `provider-comparison-report.md` and `.json` were generated after the evaluation.
4. Confirm image files referenced in the report exist on disk.
5. Confirm scoring method (composite or quality-ranked) is correctly stated.
6. Delete temporary helper files such as the evaluation packet unless the user explicitly wants to keep them.
7. If a script fails, report the exact command, the run directory, and the first actionable error line.

## Gotchas

1. Image files are in the run directory root, not in a `providers/` subdirectory.
2. The agent cannot view image files. All assessments must come from measurable metrics.
3. Cost data may be in `metadata.cost.actual` or `metadata.cost.estimated`. The scripts prefer actual data when available.
4. Multi-provider image naming: `generated-image-{service}-{model}.{ext}`.
5. Some providers produce JPEG (minimax), others PNG or WebP. File size comparisons should account for format differences.
6. `imageWidth` and `imageHeight` in metadata may be `undefined`. The scripts probe files directly for dimensions.
7. Some providers (Gemini with Imagen) can produce multiple images per request. The evidence packet and reports handle multi-image entries.

## Reporting

When you finish, report:

1. Which run directory was processed.
2. How many providers were evaluated.
3. Whether user quality rankings were used.
4. Where the three final deliverables were written.
5. Best overall provider with its score.
