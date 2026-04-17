# OCR Tests (services)

```bash
bun t \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-mistral-ocr.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-ocr.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts
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

Native EPUB cleanup/export validation is local-only and lives in:

```bash
bun t test/test-cases/validation/epub-cleanup-and-export.test.ts
```

## E2E Services

### Mistral OCR

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-mistral-ocr.test.ts
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-mistral-ocr.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-mistral-ocr.test.ts --budget 25
```

Covers:
- PDF extraction with `mistral-ocr-2512`
- image extraction with the same model ID

Requires `MISTRAL_API_KEY`.

### GLM OCR

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-ocr.test.ts
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-ocr.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-ocr.test.ts --budget 25
```

Covers:
- PDF extraction with `--glm-ocr glm-ocr`
- image extraction with the same model ID

Requires `GLM_API_KEY`.

### Firecrawl Article Extraction

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts --budget 25
```

Covers:
- `bun as ocr https://ajcwebdev.com --url-backend firecrawl`
- remote article extraction writing `extraction.txt`
- `run.json` reporting `step1.format: "html"` and `step2.extractionMethod: "html+firecrawl"`

Requires `FIRECRAWL_API_KEY`.

### GLM Reader Article Extraction

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts --budget 25
```

Covers:
- `bun as ocr https://ajcwebdev.com --url-backend glm-reader`
- remote article extraction writing `extraction.txt`
- `run.json` reporting `step1.format: "html"` and `step2.extractionMethod: "html+glm-reader"`

Requires `GLM_API_KEY`.

Service setup details are in [`ocr-document-services.md#service-environment`](./ocr-document-services.md#service-environment).
