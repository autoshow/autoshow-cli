# Step 1 Service Tests: Download

Network-backed download coverage for hosted media URLs, feeds, channels, and streaming sources. Local file input coverage for step 1 remains in [Local Tests](local-tests.md).

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts
```

## Current Coverage

- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts` covers local audio and local PDF inputs. This remains part of [Local Tests](local-tests.md).
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts` covers hosted audio and video URLs plus URL-list batching for direct URLs.
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts` covers RSS feed batching and YouTube channel batching.
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts` covers YouTube and Twitch streaming URLs plus URL-list batching for streaming sources.
- No standalone download-only validation or price file is currently defined. Coverage stays in the step 1 e2e suites above.

## Price Preflight

```bash
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts --test-price
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts --test-price
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts --test-price
```

These download mappings are report-only entries in `test/test-runner/price-commands/registry/download.ts`. `--budget` does not currently skip step 1 download tests.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [Download](../commands/process-steps/step-1-download/download-file.md)
