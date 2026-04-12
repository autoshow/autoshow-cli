# Service Tests: Download

Network-backed download coverage for hosted media URLs, feeds, channels, and streaming sources.

## Quick Start

```bash
bun t \
  test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
```

## Current Coverage

- `download-input-types-direct-url.test.ts` covers hosted audio and video URLs plus URL-list batching for direct URLs.
- `download-input-types-feed-or-channel.test.ts` covers RSS feed batching and YouTube channel batching.
- `download-input-types-streaming.test.ts` covers YouTube and Twitch streaming URLs plus URL-list batching for streaming sources.
- Local file input coverage stays in [Local Tests](local-tests.md).

## Price Preflight

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts --test-price
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts --test-price
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts --test-price
```

No standalone download-only validation or price file is currently defined. Coverage is embedded in the e2e suites above.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [Download Tests](../commands/step-1-download/download-file-tests.md)
