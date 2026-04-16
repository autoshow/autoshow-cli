# Extract Tests (services)

```bash
bun t \
  test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts \
  test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-glm-ocr.test.ts \
  test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-firecrawl.test.ts \
  test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-glm-reader.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

There is no separate hosted OCR price-only or invalid-model test file right now.

Hosted article backend validation currently lives in the HTML/article validation suite:

```bash
bun t test/test-cases/validation/html-article-inputs.test.ts
```

That suite includes setup guards for missing `FIRECRAWL_API_KEY` and `GLM_API_KEY`, local HTML fallback coverage, and mocked GLM Reader routing.

## E2E Services

### Mistral OCR

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts --test-price
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts --budget 25
```

Covers:
- PDF extraction with `mistral-ocr-latest` and `mistral-ocr-2512`
- image extraction with the same two model IDs

Requires `MISTRAL_API_KEY`.

### GLM OCR

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-glm-ocr.test.ts
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-glm-ocr.test.ts --test-price
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-glm-ocr.test.ts --budget 25
```

Covers:
- PDF extraction with `--glm-ocr glm-ocr`
- image extraction with the same model ID

Requires `GLM_API_KEY`.

### Firecrawl Article Extraction

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-firecrawl.test.ts
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-firecrawl.test.ts --test-price
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-firecrawl.test.ts --budget 25
```

Covers:
- `bun as ocr https://ajcwebdev.com --url-backend firecrawl`
- remote article extraction writing `extraction.txt`
- `metadata.json` reporting `step1.format: "html"` and `step2.extractionMethod: "html+firecrawl"`

Requires `FIRECRAWL_API_KEY`.

### GLM Reader Article Extraction

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-glm-reader.test.ts
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-glm-reader.test.ts --test-price
bun t test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-glm-reader.test.ts --budget 25
```

Covers:
- `bun as ocr https://ajcwebdev.com --url-backend glm-reader`
- remote article extraction writing `extraction.txt`
- `metadata.json` reporting `step1.format: "html"` and `step2.extractionMethod: "html+glm-reader"`

Requires `GLM_API_KEY`.

Service setup details are in [`extract-document-services.md#service-environment`](./extract-document-services.md#service-environment).
