# Music Consensus

Use this category for multi-provider AutoShow music runs with `run.json` metadata and generated music files in the run directory root.

## Packet

```bash
bun scripts/run.ts music build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

The packet verifies music artifacts and records measurable metadata such as file size, duration metadata, processing time, and cost.

## Evaluation

Write `consensus-evaluation.txt` as plain text. Do not claim to have listened to audio or assessed musical quality. Use only measurable packet evidence.

## Report

```bash
bun scripts/run.ts music build-report "$RUN_DIR"
```

Reports expose full `price`, `speed`, `automatedQuality`, and `humanQuality` ranking surfaces for local and service groups. `fastest`, `cheapest`, and `highestQuality` remain compatibility aliases for the full `speed`, `price`, and quality arrays.

Price and speed rankings include every provider in the group, with missing values sorted last as `n/a`. Automated quality uses only explicit `qualityScore` evidence when present. Human quality uses only explicit `humanQualityScore` evidence. Do not use duration, file size, bitrate, cost, speed, or generic artifact metadata as quality proxies.
