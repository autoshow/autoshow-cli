# Image Tests (services)

```bash
bun t \
  test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts \
  test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts \
  test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Local](#e2e-local)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Each provider test file includes `--price` estimate tests and an "rejects invalid model" validation test via the shared `defineImageServiceTest` factory. Provider-specific validation (multiple providers, image-size restrictions) is inline in each test file.

## E2E Local

No local image generation models are supported.

## E2E Services

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts
```

Covers provider/model validation, `--price` preflight, generation, and metadata checks.

Service setup/env prerequisites are in [`text-to-image-setup.md`](./text-to-image-setup.md).
