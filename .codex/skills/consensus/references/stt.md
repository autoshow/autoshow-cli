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

The STT report keeps the combined transcript comparison structure:

1. `## Overall Ranking` combines all providers with the balanced-overall score.
2. `## Tier Breakdown` assigns local, diarization-capable third-party, and non-diarization third-party providers independently by balanced-overall group rank.
3. `## Ranking` combines all providers by strict speaker-aware WER accuracy.
4. JSON keeps `overall`, `providers`, and `tiering` in addition to the required local/service `rankingSurfaces`.

Highest-quality ranking surfaces use speaker-aware WER against the consensus transcript. Local STT providers and third-party services remain separated in `rankingSurfaces` and tier groups, even though STT also includes the combined overall table.
