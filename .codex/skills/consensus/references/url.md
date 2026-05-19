# URL Consensus

Use this category for AutoShow URL article extraction runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts url build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

Use the packet to author `consensus-extraction.txt` as the gold article extraction. The file should contain only reconciled article content, not scoring notes or process commentary.

## Report

```bash
bun scripts/run.ts url build-report "$RUN_DIR"
```

To use a non-default gold extraction path:

```bash
bun scripts/run.ts url build-report "$RUN_DIR" --input-text /path/to/consensus-extraction.txt
```

Highest-quality rankings use WER, CER, and content coverage against the consensus extraction. Local URL extractors and hosted services stay in separate report groups.
