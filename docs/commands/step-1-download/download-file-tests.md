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
- [Local And Hosted Inputs](#local-and-hosted-inputs)
- [Networked Inputs](#networked-inputs)

## Validation / Price / Non-E2E

No standalone download-only validation or price file is currently defined. Coverage is embedded in the e2e suites.

## Local And Hosted Inputs

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts
```

Covers:
- local audio and local PDF document inputs
- direct hosted audio and video URLs
- URL-list batching for direct URLs

`download-input-types-direct-url.test.ts` has mapped `--test-price` coverage for the hosted audio/video cases. The local-file test does not.

## Networked Inputs

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts --test-price
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts --test-price
```

Covers:
- RSS feed batching
- YouTube channel batching
- YouTube and Twitch streaming URLs
- URL-list batching for streaming URLs
