---
name: tts-consensus
description: Use this skill when the user needs to compare and evaluate multiple TTS providers from a multi-provider AutoShow TTS run. Apply it to rank providers by audio quality (via roundtrip STT intelligibility), speaking rate, cost, and speed, and produce a consensus evaluation with comparison reports.
compatibility: Requires Bun and ffprobe
allowed-tools: Bash Read Edit Write Glob Grep
metadata:
  short-description: Build TTS consensus evaluation and provider reports
  author: autoshow
  version: "1.0"
---

# Build TTS Consensus Report

## Overview

Turn a multi-provider AutoShow TTS run into three deliverables:

1. `consensus-evaluation.txt`
2. `provider-comparison-report.md`
3. `provider-comparison-report.json`

Use the scripts in `scripts/` for the deterministic parts. Use agent judgment only for the evaluation-writing pass.

Read `references/output-contract.md` before writing outputs.

## Workflow

Progress:

- [ ] Set the run directory.
- [ ] Locate or receive the original input text path.
- [ ] Verify audio files from `metadata.tts[]` exist on disk.
- [ ] Build a temporary evaluation evidence packet.
- [ ] Run roundtrip STT with AssemblyAI (if user requests accuracy scoring).
- [ ] Collect roundtrip transcriptions into `$RUN_DIR/roundtrip/`.
- [ ] Write `consensus-evaluation.txt`.
- [ ] Generate both comparison reports (with `--roundtrip-dir` if transcriptions exist).
- [ ] Run a final sanity pass.

## Commands

Run commands from the skill directory so script paths stay relative to the skill root. The skill directory is the directory containing this SKILL.md file.

```bash
RUN_DIR="/absolute/path/to/tts-run"
SKILL_DIR="/absolute/path/to/tts-consensus"
INPUT_TEXT="/absolute/path/to/input.txt"
TMP_PACKET="$(mktemp -t tts-eval-packet.XXXXXX.json)"

cd "$SKILL_DIR"
bun scripts/build_evaluation_packet.ts "$RUN_DIR" --input-text "$INPUT_TEXT" --out "$TMP_PACKET"
```

This prepares evidence for the evaluation pass. Generate reports only after `consensus-evaluation.txt` exists.

## Evaluation Pass

Use the evidence packet as the primary data source for writing the evaluation.

Rules for `consensus-evaluation.txt`:

1. Do not claim to have listened to audio.
2. Do not fabricate subjective quality assessments.
3. Base all claims on evidence packet data.
4. If roundtrip WER is available, weight it as the most important signal of output quality.
5. Without roundtrip data, rank by speaking rate naturalness (120-180 c/s for English), cost, and speed.
6. Separate providers into local models and cloud services sections for independent analysis.
7. Select best local model and best cloud service.
8. State which metrics were and were not available.
9. Plain text, no markdown formatting.

## Roundtrip STT Accuracy Check (Optional but Recommended)

Use the AutoShow CLI to transcribe each TTS audio file back to text with AssemblyAI, then compare the transcriptions against the original input to compute Word Error Rate (WER). This is the strongest signal of output quality.

### Step 1: Run STT on each audio file

From the project root, loop over the audio files in the run directory and transcribe each one with AssemblyAI:

```bash
ROUNDTRIP_DIR="$RUN_DIR/roundtrip"
mkdir -p "$ROUNDTRIP_DIR"

for AUDIO_FILE in "$RUN_DIR"/speech-*.wav; do
  BASENAME="$(basename "$AUDIO_FILE")"
  echo "Transcribing $BASENAME..."
  bun as extract "$AUDIO_FILE" --assemblyai-stt universal-3-pro
done
```

Each `extract` call creates an output directory under `output/` with a `transcription.txt` file.

### Step 2: Collect transcriptions into the roundtrip directory

After all extract runs complete, copy each `transcription.txt` into the roundtrip directory with the expected naming convention (`{audioFileName}.txt`):

```bash
for AUDIO_FILE in "$RUN_DIR"/speech-*.wav; do
  BASENAME="$(basename "$AUDIO_FILE")"

  # Find the most recent extract output for this audio file
  EXTRACT_DIR="$(ls -td output/*/ | while read -r d; do
    if grep -ql "$BASENAME" "$d/run.json" 2>/dev/null; then
      echo "$d"
      break
    fi
  done)"

  if [ -n "$EXTRACT_DIR" ] && [ -f "$EXTRACT_DIR/transcription.txt" ]; then
    cp "$EXTRACT_DIR/transcription.txt" "$ROUNDTRIP_DIR/$BASENAME.txt"
    echo "Collected: $BASENAME.txt"
  else
    echo "WARNING: No transcription found for $BASENAME"
  fi
done
```

The roundtrip directory should now contain one `.txt` file per audio file:

```
roundtrip/
├── speech-kitten-kitten-tts-nano.wav.txt
├── speech-elevenlabs-eleven_flash_v2_5.wav.txt
├── speech-openai-gpt-4o-mini-tts.wav.txt
└── ... (one per provider)
```

### Notes on roundtrip STT

- AssemblyAI `universal-3-pro` requires `ASSEMBLYAI_API_KEY` to be set.
- Each extract call is a separate API request. For 15 providers, expect 15 billable transcription minutes.
- The audio files in this run are 30-55 seconds each, well within AssemblyAI's limits.
- If any extract call fails, the roundtrip directory will be missing that file and the report script will log a warning but still score the remaining providers.

## Report Generation

After the consensus evaluation is complete, run:

```bash
cd "$SKILL_DIR"
bun scripts/build_comparison_report.ts "$RUN_DIR" --input-text "$INPUT_TEXT"
```

For roundtrip scoring (after completing the STT accuracy check above), supply the roundtrip directory:

```bash
ROUNDTRIP_DIR="$RUN_DIR/roundtrip"
bun scripts/build_comparison_report.ts "$RUN_DIR" --input-text "$INPUT_TEXT" --roundtrip-dir "$ROUNDTRIP_DIR"
```

This writes:

1. `provider-comparison-report.md`
2. `provider-comparison-report.json`

The report script:

1. Reads `metadata.tts[]` from `run.json` for the provider list.
2. Probes audio files via ffprobe for duration and speaking rate.
3. Extracts cost and timing from `run.json` metadata.
4. Optionally reads roundtrip STT transcriptions to compute WER.
5. Classifies providers as local or cloud and ranks each group independently.
6. Ranks providers within each group by roundtrip WER (if available) or a composite score.
7. Adds a combined overall leaderboard using `overallScore = 50% accuracy + 25% processing speed + 25% cost efficiency`, with neutral 50/100 accuracy for providers missing roundtrip data, and reports the best and worst overall providers.
8. Adds grouped tiering for local and third-party providers using balanced overall group rank.

## Validation Checklist

1. Confirm `consensus-evaluation.txt` exists and does not contain markdown formatting or claims of having listened to audio.
2. Confirm the provider count in the report matches `metadata.tts[]` length in `run.json`.
3. Confirm `provider-comparison-report.md` and `.json` were generated after the evaluation.
4. Confirm audio files referenced in the report exist on disk.
5. Confirm scoring method (roundtrip-wer or composite) is correctly stated.
6. Confirm the markdown report contains `Overall Ranking` and `Tier Breakdown` sections with best and worst overall notes.
7. Confirm the JSON report contains `overallMetric`, `overallWeights`, `overall`, `tiering`, and per-provider `overallComponents`, `tierGroup`, `groupOverallRank`, and `groupTier`.
8. Delete temporary helper files such as the evaluation packet unless the user explicitly wants to keep them.
9. If a script fails, report the exact command, the run directory, and the first actionable error line.

## Gotchas

1. Audio files are in the run directory root, not in a `providers/` subdirectory.
2. The agent cannot listen to audio files. All quality assessments must come from measurable metrics.
3. Cost data may be in `metadata.cost.actual` or `metadata.cost.estimated`. The scripts prefer actual data when available.
4. Roundtrip transcription files must be named `{audioFileName}.txt` (e.g. `speech-kitten-kitten-tts-nano.wav.txt`). The `.wav.txt` double extension is intentional.
5. Each `bun as extract` call creates its own output directory. The collection step copies just the `transcription.txt` from each extract output into the roundtrip directory with the correct filename.
6. AssemblyAI requires `ASSEMBLYAI_API_KEY`. If the key is missing, `extract` will fail with a clear error.

## Reporting

When you finish, report:

1. Which run directory was processed.
2. How many providers were evaluated (local count and cloud count).
3. Whether roundtrip STT scoring was used, and if so, how many providers were successfully transcribed.
4. Where the three final deliverables were written.
5. Best local model and best cloud service with their scores.
