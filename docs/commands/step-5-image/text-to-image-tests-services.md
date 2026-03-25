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
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Each provider suite uses `defineImageServiceTest`, which currently covers:
- invalid model rejection
- `--price` output
- real generation and metadata checks when the required API key is configured

Additional provider-specific coverage:
- Gemini rejects multiple providers and rejects `--image-size` for `imagen-4.0-fast-generate-001`
- OpenAI rejects multiple providers
- MiniMax includes an explicit aspect-ratio generation case

## E2E Services

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts --budget 25
```

Setup details are in [`text-to-image-setup.md`](./text-to-image-setup.md).
