---
name: consensus
description: Use this skill when the user needs a gold-reference extraction/transcript, consensus evaluation, or provider comparison report from a multi-provider AutoShow image, music, OCR, STT, TTS, URL, or video run. Apply it to build category-specific consensus packets, generate reports, and compare providers without ranking local options against paid or hosted services.
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
- [ ] Verify that markdown and JSON reports keep local and service providers separated.

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

Reports must not rank local options against service options in the same table.

Every JSON report generated through `scripts/run.ts <category> build-report` includes:

1. `rankingSurfaces.local.fastest`
2. `rankingSurfaces.local.cheapest`
3. `rankingSurfaces.local.highestQuality`
4. `rankingSurfaces.service.fastest`
5. `rankingSurfaces.service.cheapest`
6. `rankingSurfaces.service.highestQuality`

If a group or metric is unavailable, the surface is an empty list and has an adjacent `*UnavailableReason` field.

## Category Notes

Image, music, and video reports rank fastest and cheapest service providers from measurable run metadata. Highest-quality rankings remain unavailable unless an explicit quality metric is present.

OCR reports use WER/CER-derived extraction accuracy for highest-quality rankings.

STT reports use speaker-aware WER-derived transcript accuracy for highest-quality rankings.

URL reports use WER, CER, and content coverage for highest-quality rankings.

TTS reports use roundtrip WER when present, or explicit voice-quality data if a report already provides it. File size, bitrate, duration, and subjective judgment are not quality proxies.

## Validation Checklist

1. Confirm the consensus artifact exists when required by the category.
2. Confirm the markdown report has separate Local Providers and Service Providers sections.
3. Confirm all six JSON `rankingSurfaces` paths exist.
4. Confirm unavailable quality rankings explain why they are unavailable.
5. Confirm local cheapest rankings only compare local providers and use zero monetary cost.
6. Confirm no combined local-vs-service leaderboard remains in the markdown or JSON report.
7. Delete temporary packet files unless the user explicitly wants to keep them.
8. If a script fails, report the exact command, run directory, and first actionable error line.

## Reporting

When you finish, report:

1. Which run directory and category were processed.
2. Which final deliverables were written.
3. Whether local and service providers were separated.
4. Which verification commands were run.
