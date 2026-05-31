# Step 0 Service Tests: Setup

Setup coverage for model downloads and service-adjacent runtime bootstrap checks.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/setup/tts-models/tts-setup.test.ts
```

## Current Coverage

- `test/test-cases/setup/tts-models/tts-setup.test.ts` validates the Kitten TTS setup module and runtime virtualenv checks.
- No standalone step 0 validation-only or price-only suites currently exist.
- These setup files do not currently resolve mapped `--test-price` or `--budget` commands.

## Price Preflight

Step 0 setup does not currently add any mapped price commands. `--test-price` and `--budget` do not provide step-specific setup preflight coverage today.

## Related Docs

- [Service Tests](service-tests.md)
- [Setup](../commands/process-steps/step-0-setup/setup.md)
