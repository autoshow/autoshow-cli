# Music Tests

```bash
bun t \
  test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts \
  test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Local](#e2e-local)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

No separate music pricing unit file exists currently. Validation and `--price` coverage are embedded in:
- `test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts`
- `test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts`

## E2E Local

No local music generation models are supported.

## E2E Services

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts
bun t test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts
```

Provider env keys:
- `ELEVENLABS_API_KEY`
- `MINIMAX_API_KEY`
