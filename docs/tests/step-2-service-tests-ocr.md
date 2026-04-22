# Step 2 Service Tests: OCR

Hosted OCR and article-extraction coverage for the `ocr` command.

## Quick Start

```bash
bun t \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts
```

## Current Coverage

- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts` covers PDF and image extraction with `--mistral-ocr mistral-ocr-2512`, `--glm-ocr glm-ocr`, `--openai-ocr gpt-5.4-nano`, `--anthropic-ocr claude-haiku-4-5`, and `--gemini-ocr gemini-3.1-flash-lite-preview`.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts` covers remote article extraction with `--url-backend firecrawl`, writes `extraction.txt`, and records `step2.extractionMethod: "html+firecrawl"` in `run.json`.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts` covers remote article extraction with `--url-backend glm-reader`, writes `extraction.txt`, and records `step2.extractionMethod: "html+glm-reader"` in `run.json`.
- Hosted article backend validation also lives in `test/test-cases/validation/html-article-inputs.test.ts`.
- Native EPUB cleanup and export validation lives in `test/test-cases/validation/epub-cleanup-and-export.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts --budget 25
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts --budget 25
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts --test-price
```

`ocr-glm-reader.test.ts` currently resolves a report-only price selector, so `--budget` does not skip it.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [OCR Command](../commands/process-steps/step-2-ocr/ocr-document.md)
