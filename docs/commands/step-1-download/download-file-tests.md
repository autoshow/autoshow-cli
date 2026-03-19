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
- [E2E Local](#e2e-local)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

No standalone download-only validation/price file is currently defined. Validation coverage is embedded in the e2e suites.

## E2E Local

**Tier:** `smoke`/`local`

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts
```

Covers local audio and local document input downloads.

## E2E Services

**Tier:** `api`/`slow-api`

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
```

Covers direct hosted URLs, RSS/YouTube channel inputs, YouTube/Twitch URLs, and URL-list batch inputs.
