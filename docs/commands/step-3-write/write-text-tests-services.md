# Write Tests (services)

```bash
bun t \
  test/test-cases/e2e/step-3-write-e2e/openai/openai-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/anthropic/anthropic-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/gemini/gemini-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/groq/groq-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/minimax/minimax-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-subcommand-services.test.ts
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

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-3-write-e2e/openai/openai-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/anthropic/anthropic-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/gemini/gemini-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/groq/groq-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/minimax/minimax-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-subcommand-services.test.ts
```

Service setup details are in [`write-text-local.md#setup`](./write-text-local.md#setup).
