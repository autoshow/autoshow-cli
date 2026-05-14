# Step 2 Service Tests: OCR

Hosted OCR and article-extraction coverage for the `extract` document/OCR route.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts
```

## Current Coverage

- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts` covers PDF and image extraction with `--mistral-ocr mistral-ocr-2512`, `--glm-ocr glm-ocr`, `--kimi-ocr kimi-k2.6`, `--openai-ocr gpt-5.4-nano`, `--anthropic-ocr claude-haiku-4-5`, `--gemini-ocr gemini-3.1-flash-lite-preview`, and `--deepinfra-ocr Qwen/Qwen3-VL-30B-A3B-Instruct`.
- Kimi OCR tests are gated on `KIMI_API_KEY` and assert `ocrService: "kimi"`, the requested `ocrModel`, and recorded `promptTokens` / `completionTokens` when the provider returns usage.
- DeepInfra OCR tests are gated on `DEEPINFRA_API_KEY` and assert `ocrService: "deepinfra"`, the requested `ocrModel`, and recorded `promptTokens` / `completionTokens` when the provider returns usage.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts` covers remote article extraction with `--url-backend firecrawl`, writes `extraction.txt`, and records `step2.extractionMethod: "html+firecrawl"` in `run.json`.
- `test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts` covers remote article extraction with `--url-backend glm-reader`, writes `extraction.txt`, and records `step2.extractionMethod: "html+glm-reader"` in `run.json`.
- Hosted article and local HTML input validation also lives in `test/test-cases/validation/input-contracts.test.ts`. Mocked URL backend contracts for Firecrawl v2, Spider, Zyte, GLM Reader, Defuddle, and `--all-url` provider artifacts live in `test/test-cases/validation/html-url-backends-contracts.test.ts`.
- `test/test-cases/validation/option-resolution-contracts.test.ts` covers `--all-url` backend expansion, URL concurrency defaults, conflict handling with `--url-backend`, and expected provider artifact paths without live API calls.
- Native EPUB cleanup and export validation lives in `test/test-cases/validation/epub-export-contracts.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts --budget 2500
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts --budget 2500
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts --test-price
```

`ocr-glm-reader.test.ts` currently resolves a report-only price selector, so `--budget` does not skip it.

`extract <url> --all-url --price` is covered by the local validation suite. Do not run live `--all-url` e2e coverage unless hosted URL provider API usage has been explicitly approved.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [extract OCR](../commands/process-steps/step-2-extract/03-extract-ocr.md)
- [extract URL and X](../commands/process-steps/step-2-extract/04-extract-url.md)
