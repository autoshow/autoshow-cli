# STT Consensus

Use this category for AutoShow speech-to-text runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts stt build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

Build the packet before authoring the reference. Author `consensus-transcription.txt` from the sum total of segment evidence across providers in the full multi-provider packet. Use the packet baseline and provider transcripts as evidence, not as automatic truth, and do not copy `prompt.md`, provider summaries, or any single provider output as the consensus transcript.

Preserve canonical speaker labels and timestamps in this line format:

```text
[00:00:10] [speaker-1] Transcript text.
```

Keep one segment per line, chronological timestamps, and stable canonical speaker labels.

## Report

```bash
bun scripts/run.ts stt build-report "$RUN_DIR"
```

To use a non-default consensus transcript artifact path:

```bash
bun scripts/run.ts stt build-report "$RUN_DIR" --input-text /path/to/consensus-transcription.txt
```

The STT report uses full grouped metric rankings:

1. `## Metric Rankings` contains Local, Third-Party Service Non-Diarization, and Third-Party Service Diarization groups.
2. Each group contains full Price, Speed, and Quality Score tables.
3. JSON exposes `metricRankings.local.price|speed|qualityScore`.
4. JSON exposes `metricRankings.thirdPartyServiceNonDiarization.price|speed|qualityScore`.
5. JSON exposes `metricRankings.thirdPartyServiceDiarization.price|speed|qualityScore`.
6. JSON does not emit `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, or `tiering`.

Quality Score rankings use the existing speaker-aware WER-derived score from highest to lowest, with speaker-aware WER, text-only WER, and diarization support retained as evidence. Price rankings use zero monetary cost for local STT providers and reported cost for third-party services, keeping missing service price at the end. Speed rankings keep missing timing at the end.
