# Service Tests: Video

Provider-backed validation and price coverage for the `video` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/
```

## Current Coverage

- `test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts` and `minimax-video-gen.test.ts` cover invalid model rejection and `--price` handling for Gemini Veo and MiniMax model IDs.
- The suites also validate that `video` requires at least one provider flag and that multi-provider runs such as `--gemini-video` plus `--minimax-video` are accepted.
- There are currently no full provider-generation e2e video tests. Coverage is limited to validation and price preflight.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts --budget 25
```

## Related Docs

- [Service Tests](service-tests.md)
- [Video Tests](../commands/step-6-video/text-to-video-tests-services.md)
