# Image Consensus

Use this category for multi-provider AutoShow image runs with `run.json` metadata and generated image files in the run directory root.

## Packet

```bash
bun scripts/run.ts image build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

The packet verifies image artifacts and records measurable metadata such as dimensions, file size, processing time, and cost.

## Evaluation

Write `consensus-evaluation.txt` as plain text. Do not claim to have viewed image quality. Use only artifact existence, dimensions, file size, processing time, and cost as evidence.

## Report

```bash
bun scripts/run.ts image build-report "$RUN_DIR"
```

Fastest and cheapest rankings come from measurable metadata. Highest-quality rankings are unavailable unless an explicit quality metric is already present.
