# Service Tests: Setup

Setup coverage for model downloads and service-adjacent runtime bootstrap checks.

## Quick Start

```bash
bun t \
  test/test-cases/e2e/step-0-setup-e2e/llama-models/llama-downloads.test.ts \
  test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
```

## Current Coverage

- `test/test-cases/e2e/step-0-setup-e2e/llama-models/llama-downloads.test.ts` validates local llama model download readiness via `bun as models <model>`.
- `test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts` validates the Kitten TTS setup module and runtime virtualenv checks.
- These setup files do not currently have mapped `--test-price` or `--budget` commands.

## Related Docs

- [Service Tests](service-tests.md)
- [Setup Tests](../commands/step-0-setup/setup-tests.md)
