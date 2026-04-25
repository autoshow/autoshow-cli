---
name: stt-consensus
description: Generate a gold-reference transcript and provider comparison reports from an AutoShow STT episode directory that contains `run.json` plus `providers/*/result.json`. Use when evaluating multi-provider speech-to-text or transcription runs, reconciling provider segments into `consensus-transcription.txt`, or producing `reference-comparison-report.md` and `.json` for podcasts, interviews, meetings, videos, or other speaker-labeled audio.
metadata:
  short-description: Build STT consensus and provider reports
---

# Build STT Consensus Report

## Overview

Turn a multi-provider AutoShow STT run into three deliverables:

1. `consensus-transcription.txt`
2. `reference-comparison-report.md`
3. `reference-comparison-report.json`

Use the scripts in `scripts/` for the deterministic parts. Use agent judgment only for the consensus-writing pass.

Read `references/output-contract.md` before writing outputs.

## Workflow

1. Set the run directory.
2. Verify the actual provider set from `providers/*/result.json`.
3. Build a temporary consensus-evidence packet.
4. Write `consensus-transcription.txt`.
5. Generate both comparison reports from the consensus transcript.
6. Run a final sanity pass on timestamps, speakers, provider count, and output paths.

## Commands

Run commands from this skill directory. If working from a repository checkout, set `SKILL_DIR` to the checkout's `skills/stt-consensus` directory; if the skill is installed elsewhere, use that installed skill directory.

```bash
RUN_DIR="/absolute/path/to/episode-run"
SKILL_DIR="/absolute/path/to/stt-consensus"
TMP_PACKET="$(mktemp -t consensus-packet.XXXXXX.json)"

bun "$SKILL_DIR/scripts/build_consensus_packet.ts" "$RUN_DIR" --out "$TMP_PACKET"
```

The first command prepares evidence for the consensus pass. The second command should be run only after `consensus-transcription.txt` exists.

## Consensus Pass

Use the evidence packet as the primary navigation layer, then fall back to raw `providers/*/result.json` when a segment is still ambiguous.

Rules for `consensus-transcription.txt`:

1. Use the exact format `[HH:MM:SS] [speaker-n] text`.
2. Keep one segment per line.
3. Use stable canonical speaker labels such as `speaker-1`, `speaker-2`, and so on across the whole file.
4. Preserve chronological order and keep timestamps monotonic.
5. Start from the baseline provider suggested by `build_consensus_packet.ts`, but repair every questionable segment with cross-provider evidence.
6. Prefer the reading that best matches cross-provider agreement plus local context; do not summarize or paraphrase.
7. Resolve obvious provider-specific mistakes such as mangled names, dropped negations, garbled product names, and bad punctuation.
8. If only one provider has a plausible reading and it clearly fits the surrounding context, use it.
9. Do not copy stale text from existing comparison reports. Treat `providers/*/result.json` and the evidence packet as the source of truth.
10. Do not add helper sections, notes, markdown formatting, or commentary to the transcript file.

## Report Generation

After the consensus transcript is complete, run:

```bash
bun "$SKILL_DIR/scripts/build_reference_report.ts" "$RUN_DIR"
```

This writes:

1. `reference-comparison-report.md`
2. `reference-comparison-report.json`

The report script:

1. Parses `consensus-transcription.txt` as the gold reference.
2. Uses only `result.json.result.segments` for provider scoring.
3. Maps provider speaker IDs onto canonical speakers by segment overlap.
4. Computes text-only WER and speaker-aware WER from each provider's ordered word stream rather than by forcing provider text onto gold segment boundaries.
5. Pulls actual cost and processing time from `run.json` when available.
6. Ignores `transcription.txt` files and any pre-existing comparison reports.

## Validation Checklist

1. Confirm `consensus-transcription.txt` exists and every nonblank line matches `[HH:MM:SS] [speaker-n] text`.
2. Confirm the providers counted in the report are the providers that actually exist under `providers/`.
3. Confirm `reference-comparison-report.md` and `.json` were regenerated after the consensus transcript changed.
4. Confirm speaker labels are stable across the transcript and the report speaker maps are non-empty for diarized providers.
5. Confirm the final segment in the consensus transcript does not extend past the run duration in `run.json`.
6. Delete temporary helper files such as the consensus packet unless the user explicitly wants to keep them.
7. If a script fails, report the exact command, the run directory, and the first actionable error line.

## Reporting

When you finish, report:

1. Which run directory was processed.
2. Which providers were discovered on disk.
3. Whether any run/report inconsistency was ignored as stale input.
4. Where the three final deliverables were written.
