# Write Tests (services)

```bash
bun t \
  test/test-cases/e2e/step-3-write-e2e/write-services/openai/openai-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-services/anthropic/anthropic-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-services/gemini/gemini-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-services/groq/groq-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-services/minimax/minimax-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-services/grok/grok-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Coverage currently comes from:
- provider model suites built on `defineLLMWriteTest`
- `write-subcommand-services.test.ts` for explicit `write` command flows and `--price`

## E2E Services

```bash
bun t test/test-cases/e2e/step-3-write-e2e/write-services/openai/openai-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-services/anthropic/anthropic-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-services/gemini/gemini-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-services/groq/groq-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-services/minimax/minimax-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-services/grok/grok-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-services/openai/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts --budget 25
```

Service setup details are in [`write-text-local.md#setup`](./write-text-local.md#setup).
