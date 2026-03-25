# Setup Tests

Current setup-related coverage:

```bash
bun t \
  test/test-cases/e2e/step-0-setup-e2e/llama-models/llama-downloads.test.ts \
  test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
```

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Coverage](#e2e-coverage)

## Validation / Price / Non-E2E

No standalone setup validation or price tests currently exist under `test/test-cases/validation/` or `test/test-cases/price/`.

## E2E Coverage

```bash
bun t test/test-cases/e2e/step-0-setup-e2e/llama-models/llama-downloads.test.ts
bun t test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
```

Covers:
- local llama model download readiness via `bun as models <model>`
- Kitten TTS setup module execution and runtime venv validation
- these files currently do not have mapped `--test-price` or `--budget` commands

There is no separate service-only setup e2e file at the moment.
