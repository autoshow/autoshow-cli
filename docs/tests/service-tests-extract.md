# Service Tests: Extract

Hosted OCR coverage for the `extract` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts
```

## Current Coverage

- `test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts` covers PDF and image extraction with `mistral-ocr-latest` and `mistral-ocr-2512`.
- There is no separate hosted OCR validation-only or price-only test file right now.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts --test-price
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts --budget 25
```

## Related Docs

- [Service Tests](service-tests.md)
- [Extract Tests (Services)](../commands/step-2-extract/extract-document-tests-services.md)
