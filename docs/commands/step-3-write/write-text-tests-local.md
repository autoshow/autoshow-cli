# Write Tests (local)

Run all local write tests:

```bash
bun t \
  test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts \
  test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/llama/llama-qwen.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-subcommand-local.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [E2E Local](#e2e-local)

## E2E Local

**Tier:** `local`

```bash
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-subcommand-local.test.ts
```

Covers a fast llama smoke preflight (`--price`), local llama gemma generation, and local `write` subcommand flows.

**Tier:** `slow-local`

```bash
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-qwen.test.ts
```

Covers Qwen3-0.6B model generation (slow due to model load + inference overhead).
