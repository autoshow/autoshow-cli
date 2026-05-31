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
- [ ] Verify that JSON reports include the required ranking contract for the category.
- [ ] For OCR and STT, verify full grouped `metricRankings` are present and old combined overall/tier/top-three fields are absent.

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

For OCR, STT, and URL report generation, `--input-text <path>` can point to the already-authored consensus artifact:

1. OCR: `consensus-extraction.txt`
2. STT: `consensus-transcription.txt`
3. URL: `consensus-extraction.txt`

If omitted, the report command uses the category default file in the run directory.

## Gold Reference Source

For OCR, STT, and URL, the gold reference is the consensus artifact authored from the full multi-provider packet evidence: `consensus-extraction.txt` for OCR/URL and `consensus-transcription.txt` for STT.

Do not copy or treat `prompt.md`, per-provider transcripts/extractions, provider summaries, model summaries, or any single provider output as the gold reference.

Existing gold files may only be reused when they are already agent-authored consensus artifacts created from packet evidence. If that provenance is unclear, rebuild the packet and reconcile the artifact before report generation.

## Ranking Contract

Reports expose separate local and service ranking surfaces so cost, speed, and quality can be inspected within each provider class.

Image, music, TTS, URL, and video JSON reports generated through `scripts/run.ts <category> build-report` include complete local and service rankings:

1. `rankingSurfaces.local.price`
2. `rankingSurfaces.local.speed`
3. `rankingSurfaces.local.automatedQuality`
4. `rankingSurfaces.local.humanQuality`
5. `rankingSurfaces.service.price`
6. `rankingSurfaces.service.speed`
7. `rankingSurfaces.service.automatedQuality`
8. `rankingSurfaces.service.humanQuality`

Each full-ranking array has a matching `*UnavailableReason` field. Price and speed rankings include every provider in the group; missing values sort last with `value: null` and `label: "n/a"`.

Compatibility aliases are retained and full-length:

1. `rankingSurfaces.local.fastest`
2. `rankingSurfaces.local.cheapest`
3. `rankingSurfaces.local.highestQuality`
4. `rankingSurfaces.service.fastest`
5. `rankingSurfaces.service.cheapest`
6. `rankingSurfaces.service.highestQuality`

`fastest` aliases `speed`, `cheapest` aliases `price`, and `highestQuality` aliases `humanQuality` when present, otherwise `automatedQuality`.

OCR reports use grouped full metric rankings instead of top-three ranking surfaces:

1. `metricRankings.local.price`
2. `metricRankings.local.speed`
3. `metricRankings.local.qualityScore`
4. `metricRankings.thirdPartyService.price`
5. `metricRankings.thirdPartyService.speed`
6. `metricRankings.thirdPartyService.qualityScore`

STT reports use grouped full metric rankings split by diarization support:

1. `metricRankings.local.price`
2. `metricRankings.local.speed`
3. `metricRankings.local.qualityScore`
4. `metricRankings.thirdPartyServiceNonDiarization.price`
5. `metricRankings.thirdPartyServiceNonDiarization.speed`
6. `metricRankings.thirdPartyServiceNonDiarization.qualityScore`
7. `metricRankings.thirdPartyServiceDiarization.price`
8. `metricRankings.thirdPartyServiceDiarization.speed`
9. `metricRankings.thirdPartyServiceDiarization.qualityScore`

OCR and STT do not emit JSON `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, or `tiering`, and their markdown does not emit `## Overall Ranking`, `## Tier Breakdown`, or combined `## Ranking` sections.

Each OCR/STT metric ranking entry includes `rank`, `providerKey`, `provider`, `model`, `group`, `metric`, `value`, `label`, and relevant evidence fields. Price ranks lower cost first, with local providers at zero monetary cost and missing service price retained at the end. Speed ranks lower processing time first, with missing timing retained at the end. Quality Score ranks the existing score from highest to lowest.

## Category Notes

Image, music, and video reports rank price and speed from measurable run metadata. Automated quality remains unavailable unless an explicit `qualityScore` metric is present.

OCR reports use WER/CER-derived extraction accuracy for quality rankings.

STT reports use speaker-aware WER-derived transcript accuracy for quality rankings and split service groups by diarization support.

URL reports use WER, CER, and content coverage for automated quality rankings.

Human quality uses only explicit human score fields such as `humanQualityScore`, or `humanSpeechScore` for TTS. Generic `qualityScore`, file size, bitrate, duration, cost, speed, and subjective judgment are not human quality proxies.

TTS reports keep automated and human quality separate. Automated quality uses roundtrip WER-derived accuracy when present, including `voice-quality-report.json` median roundtrip WER. Human quality uses `humanSpeechScore` from `voice-quality-report.json` when present. File size, bitrate, duration, and subjective judgment are not quality proxies.

## Validation Checklist

1. Confirm the consensus artifact exists when required by the category.
2. Confirm the markdown report exposes the category's expected ranking structure.
3. For non-OCR/STT reports, confirm full `price`, `speed`, `automatedQuality`, and `humanQuality` JSON `rankingSurfaces` paths exist, plus compatibility aliases.
4. For OCR/STT, confirm grouped full `metricRankings` exist and old `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, and `tiering` fields are absent.
5. For TTS, confirm full `price`, `speed`, `automatedQuality`, and `humanQuality` rankings exist for local and service groups.
6. Confirm unavailable quality rankings explain why they are unavailable.
7. Confirm local cheapest rankings only compare local providers and use zero monetary cost.
8. Confirm no combined local-vs-service leaderboard remains in the markdown or JSON report.
9. Delete temporary packet files unless the user explicitly wants to keep them.
10. If a script fails, report the exact command, run directory, and first actionable error line.

## Reporting

When you finish, report:

1. Which run directory and category were processed.
2. Which final deliverables were written.
3. Whether required ranking surfaces or OCR/STT metric rankings were present.
4. Which verification commands were run.
