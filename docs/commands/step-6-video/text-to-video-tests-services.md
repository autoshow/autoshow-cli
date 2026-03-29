# Video Tests

```bash
bun t \
  test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts \
  test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Current coverage:
- invalid model rejection via `defineVideoServiceTest`
- `--price` coverage for Gemini Veo and MiniMax model IDs
- explicit validation that `video` requires a provider flag
- explicit validation that multiple providers are rejected

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts
bun t test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts
bun t test/test-cases/e2e/step-6-video-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts --budget 25
```

## E2E Services

There are currently no full provider-generation e2e video tests. Video coverage is limited to validation and `--price` preflight.

Provider env keys:
- `GEMINI_API_KEY`
- `MINIMAX_API_KEY`
