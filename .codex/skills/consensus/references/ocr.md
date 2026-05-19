# OCR Consensus

Use this category for AutoShow OCR runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts ocr build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

Use the packet to author `consensus-extraction.txt` as plain text. For multi-page documents, keep `--- Page N ---` delimiters. Do not add report notes or commentary to the extraction file.

## Report

```bash
bun scripts/run.ts ocr build-report "$RUN_DIR"
```

To use a non-default gold extraction path:

```bash
bun scripts/run.ts ocr build-report "$RUN_DIR" --input-text /path/to/consensus-extraction.txt
```

The OCR report follows the STT report shape:

1. `## Overall Ranking` combines all providers with the balanced-overall score.
2. `## Tier Breakdown` assigns local and third-party providers independently by balanced-overall group rank.
3. `## Ranking` combines all providers by WER accuracy, with CER included for context and tie-breaking.
4. JSON keeps `overall`, `providers`, and `tiering` in addition to the required local/service `rankingSurfaces`.

Highest-quality ranking surfaces use WER first and CER as a tie-breaker against the consensus extraction. Local OCR providers and cloud services remain separated in `rankingSurfaces` and tier groups, even though OCR also includes the combined overall table.
