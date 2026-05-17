# STT Consensus

Use this category for AutoShow speech-to-text runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts stt build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

Use the packet to author `consensus-transcription.txt` in this line format:

```text
[00:00:10] [speaker-1] Transcript text.
```

Keep one segment per line, chronological timestamps, and stable canonical speaker labels.

## Report

```bash
bun scripts/run.ts stt build-report "$RUN_DIR"
```

To use a non-default gold transcript path:

```bash
bun scripts/run.ts stt build-report "$RUN_DIR" --input-text /path/to/consensus-transcription.txt
```

Highest-quality rankings use speaker-aware WER against the consensus transcript. Local STT providers and third-party services stay in separate report groups.
