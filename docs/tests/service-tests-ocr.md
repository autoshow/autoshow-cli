# Service Tests: OCR

Hosted OCR coverage for the `ocr` command.

## Quick Start

```bash
bun t \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-mistral-ocr.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-ocr.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts
```

## Current Coverage

- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-mistral-ocr.test.ts` covers PDF and image extraction with `mistral-ocr-2512`.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-ocr.test.ts` covers PDF and image extraction with `--glm-ocr glm-ocr`.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts` covers remote article extraction with `--url-backend firecrawl`.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts` covers remote article extraction with `--url-backend glm-reader`.
- There is no separate hosted OCR validation-only or price-only test file right now.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-mistral-ocr.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-mistral-ocr.test.ts --budget 25
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-ocr.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts --test-price
```

## Related Docs

- [Service Tests](service-tests.md)
- [OCR Tests (Services)](../commands/step-2-ocr/ocr-document-tests-services.md)
