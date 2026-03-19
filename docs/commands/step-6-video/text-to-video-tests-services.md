# Video Tests

```bash
bun t \
  test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts \
  test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Local](#e2e-local)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

**Tier:** `smoke`

Each provider test file includes `--price` estimate tests and an "rejects invalid model" validation test via the shared `defineVideoServiceTest` factory. `video-gen.test.ts` also covers "requires a provider flag" and "rejects multiple providers" validation.

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts
bun t test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts
```

## E2E Local

No local video generation models are supported.

## E2E Services

No E2E video generation tests exist (validation and `--price` coverage only). Video generation is expensive and slow; provider functionality is verified through preflight checks.

Provider env keys:
- `OPENAI_API_KEY` (Sora)
- `GEMINI_API_KEY` (Veo)
- `MINIMAX_API_KEY` (MiniMax video)
