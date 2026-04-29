# Step 2 Service Tests: OCR

Hosted OCR and article-extraction coverage for the `extract` document/OCR route.

## Quick Start

```bash
bun t \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts
```

## Current Coverage

- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts` covers PDF and image extraction with `--mistral-ocr mistral-ocr-2512`, `--glm-ocr glm-ocr`, `--openai-ocr gpt-5.4-nano`, `--anthropic-ocr claude-haiku-4-5`, `--gemini-ocr gemini-3.1-flash-lite-preview`, and `--deepinfra-ocr allenai/olmOCR-2-7B-1025`.
- DeepInfra OCR tests are gated on `DEEPINFRA_API_KEY` and assert `ocrService: "deepinfra"`, the requested `ocrModel`, and recorded `promptTokens` / `completionTokens` when the provider returns usage.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts` covers remote article extraction with `--url-backend firecrawl`, writes `extraction.txt`, and records `step2.extractionMethod: "html+firecrawl"` in `run.json`.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts` covers remote article extraction with `--url-backend glm-reader`, writes `extraction.txt`, and records `step2.extractionMethod: "html+glm-reader"` in `run.json`.
- Hosted article backend validation also lives in `test/test-cases/validation/html-article-inputs.test.ts`.
- Native EPUB cleanup and export validation lives in `test/test-cases/validation/epub-cleanup-and-export.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts --budget 2500
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts --budget 2500
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts --test-price
```

`ocr-glm-reader.test.ts` currently resolves a report-only price selector, so `--budget` does not skip it.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [extract OCR](../commands/process-steps/step-2-extract/03-extract-ocr.md)
- [extract URL and X](../commands/process-steps/step-2-extract/04-extract-url.md)
