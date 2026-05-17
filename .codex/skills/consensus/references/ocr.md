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

Highest-quality rankings use WER first and CER as a tie-breaker against the consensus extraction. Local OCR providers and cloud services stay in separate report groups.
