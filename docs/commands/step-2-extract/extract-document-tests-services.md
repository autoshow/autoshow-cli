# Extract Tests (services)

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Local](#e2e-local)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

No separate extract service pricing file exists; validation is embedded in the e2e suite.

## E2E Local

No local service-extraction tests — see [extract-document-tests-local.md](./extract-document-tests-local.md).

## E2E Services

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts
```

Covers Mistral OCR extraction for PDF and image inputs, gated by `MISTRAL_API_KEY`.

Service setup/env prerequisites are in [`extract-document-setup.md`](./extract-document-setup.md).
