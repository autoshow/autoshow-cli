---
name: consensus
description: Use this skill when the user needs a gold-reference extraction/transcript, consensus evaluation, or provider comparison report from a multi-provider AutoShow image, music, OCR, STT, TTS, URL, or video run. Apply it to build category-specific consensus packets, generate reports, and compare providers with category-appropriate ranking and tier summaries.
compatibility: Requires Bun
allowed-tools: Bash Read Edit Write Glob Grep
metadata:
  short-description: Compare AutoShow providers by category
  author: autoshow
  version: "2.0"
---

# Build Consensus Reports

## Overview

This skill consolidates the AutoShow consensus workflows for:

1. Image generation
2. Music generation
3. OCR extraction
4. Speech-to-text
5. Text-to-speech
6. URL article extraction
7. Video generation

Use `scripts/run.ts` as the public entry point. Category-specific scripts and references live under nested category directories.

Read `references/shared-conventions.md` first, then the category reference for the run you are processing.

## Workflow

Progress:

- [ ] Identify the category and run directory.
- [ ] Read `references/shared-conventions.md` and `references/<category>.md`.
- [ ] Build the packet with `scripts/run.ts <category> build-packet`.
- [ ] Write the category consensus artifact when the workflow requires agent reconciliation.
- [ ] Generate reports with `scripts/run.ts <category> build-report`.
- [ ] Verify that JSON reports include the required local and service ranking surfaces.
- [ ] For OCR and STT, verify the combined overall ranking and tier breakdown are preserved.

## Commands

Run commands from the skill directory so script paths stay relative to the skill root. The skill directory is the directory containing this `SKILL.md` file.

```bash
RUN_DIR="/absolute/path/to/run"
SKILL_DIR="/absolute/path/to/consensus"
TMP_PACKET="$(mktemp -t consensus-packet.XXXXXX.json)"

cd "$SKILL_DIR"
bun scripts/run.ts <category> build-packet "$RUN_DIR" --out "$TMP_PACKET"
bun scripts/run.ts <category> build-report "$RUN_DIR"
```

Valid categories are:

```text
image music ocr stt tts url video
```

Unified command shape:

```bash
bun scripts/run.ts <category> build-packet <run_dir> [--input-text <path>] [--out <path>]
bun scripts/run.ts <category> build-report <run_dir> [--input-text <path>] [--roundtrip-dir <path>]
```

TTS packet and report generation require `--input-text <path>`.

For OCR, STT, and URL report generation, `--input-text <path>` can point to the already-authored gold text:

1. OCR: `consensus-extraction.txt`
2. STT: `consensus-transcription.txt`
3. URL: `consensus-extraction.txt`

If omitted, the report command uses the category default file in the run directory.

## Ranking Contract

Reports expose separate local and service ranking surfaces so cost, speed, and quality can be inspected within each provider class.

Every JSON report generated through `scripts/run.ts <category> build-report` includes:

1. `rankingSurfaces.local.fastest`
2. `rankingSurfaces.local.cheapest`
3. `rankingSurfaces.local.highestQuality`
4. `rankingSurfaces.service.fastest`
5. `rankingSurfaces.service.cheapest`
6. `rankingSurfaces.service.highestQuality`

If a group or metric is unavailable, the surface is an empty list and has an adjacent `*UnavailableReason` field.

OCR and STT reports additionally preserve a combined report structure:

1. `## Overall Ranking` using `balanced-overall`
2. `## Tier Breakdown` with local and third-party tier groups
3. `## Ranking` as the combined WER accuracy ranking
4. JSON `overall`, `providers`, and `tiering` fields with overall scores, component scores, group ranks, and tiers

## Category Notes

Image, music, and video reports rank fastest and cheapest service providers from measurable run metadata. Highest-quality rankings remain unavailable unless an explicit quality metric is present.

OCR reports use WER/CER-derived extraction accuracy for highest-quality rankings.

STT reports use speaker-aware WER-derived transcript accuracy for highest-quality rankings.

URL reports use WER, CER, and content coverage for highest-quality rankings.

TTS reports use roundtrip WER when present, or explicit voice-quality data if a report already provides it. File size, bitrate, duration, and subjective judgment are not quality proxies.

## Validation Checklist

1. Confirm the consensus artifact exists when required by the category.
2. Confirm the markdown report exposes the category's expected ranking structure.
3. Confirm all six JSON `rankingSurfaces` paths exist.
4. Confirm unavailable quality rankings explain why they are unavailable.
5. Confirm local cheapest rankings only compare local providers and use zero monetary cost.
6. For OCR and STT, confirm combined overall ranking and tier breakdowns remain in markdown and JSON.
7. For categories without a combined-overall contract, confirm no combined local-vs-service leaderboard remains in the markdown or JSON report.
8. Delete temporary packet files unless the user explicitly wants to keep them.
9. If a script fails, report the exact command, run directory, and first actionable error line.

## Reporting

When you finish, report:

1. Which run directory and category were processed.
2. Which final deliverables were written.
3. Whether required ranking surfaces and any category-specific combined ranking were present.
4. Which verification commands were run.
