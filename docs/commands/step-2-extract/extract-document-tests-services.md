# Extract Tests (services)

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

There is no separate Mistral OCR price-only or invalid-model test file right now. Current hosted coverage is the e2e extraction suite below.

## E2E Services

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts
```

Covers:
- PDF extraction with `mistral-ocr-latest` and `mistral-ocr-2512`
- image extraction with the same two model IDs

Service setup details are in [`extract-document-local.md#setup`](./extract-document-local.md#setup).
