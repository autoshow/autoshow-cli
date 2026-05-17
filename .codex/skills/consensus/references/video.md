# Video Consensus

Use this category for multi-provider AutoShow video runs with `run.json` metadata and generated video files in the run directory root.

## Packet

```bash
bun scripts/run.ts video build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

The packet verifies video artifacts and records measurable metadata such as file size, duration metadata, processing time, and cost.

## Evaluation

Write `consensus-evaluation.txt` as plain text. Do not claim to have watched video or assessed video quality. Use only measurable packet evidence.

## Report

```bash
bun scripts/run.ts video build-report "$RUN_DIR"
```

Fastest and cheapest rankings come from measurable metadata. Highest-quality rankings are unavailable unless an explicit quality metric is already present.
