# Setup Tests

```bash
bun t \
  test/test-cases/e2e/step-0-setup-e2e/llama-models/llama-downloads.test.ts \
  test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
```

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Local](#e2e-local)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

No standalone setup unit/price tests currently exist under `test/test-cases/price/` or `test/test-cases/validation/` for setup.

## E2E Local

**Tier:** `slow-api`

```bash
bun t test/test-cases/e2e/step-0-setup-e2e/llama-models/llama-downloads.test.ts
bun t test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
```

Covers:
- llama model download/setup path
- local TTS environment setup for kitten

## E2E Services

No service-only setup e2e file is currently defined.
