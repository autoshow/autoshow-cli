# URL Consensus

Use this category for AutoShow URL article extraction runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts url build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

Build the packet before authoring the reference. Author `consensus-extraction.txt` from the full multi-provider packet evidence as the reconciled article extraction. Do not copy `prompt.md`, a provider extraction, provider summary, or any single provider output as the consensus extraction.

The file should contain only reconciled article content, not scoring notes or process commentary.

## Report

```bash
bun scripts/run.ts url build-report "$RUN_DIR"
```

To use a non-default consensus extraction artifact path:

```bash
bun scripts/run.ts url build-report "$RUN_DIR" --input-text /path/to/consensus-extraction.txt
```

Reports expose full `price`, `speed`, `automatedQuality`, and `humanQuality` ranking surfaces for local and service groups. `fastest`, `cheapest`, and `highestQuality` remain compatibility aliases for the full `speed`, `price`, and quality arrays.

Price and speed rankings include every provider in the group, with missing values sorted last as `n/a`. Automated quality uses WER/CER/coverage-derived extraction accuracy against the consensus extraction. Human quality uses only explicit `humanQualityScore` evidence. URL normalized reports do not keep combined overall ranking or tiering output.
