# Download Tests

```bash
bun t \
  test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts \
  test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Smoke](#e2e-smoke)
- [E2E Slow-API](#e2e-slow-api)

## Validation / Price / Non-E2E

No standalone download-only validation or price file is currently defined. Coverage is embedded in the e2e suites.

## E2E Smoke

The test runner currently routes these files as `smoke`:

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts
```

Covers:
- local audio and local PDF document inputs
- direct hosted audio and video URLs
- URL-list batching for direct URLs

## E2E Slow-API

The test runner currently routes these files as `slow-api`:

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
```

Covers:
- RSS feed batching
- YouTube channel batching
- YouTube and Twitch streaming URLs
- URL-list batching for streaming URLs
