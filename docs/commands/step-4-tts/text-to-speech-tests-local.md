# TTS Tests (local)

Run all local TTS tests:

```bash
bun t \
  test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [E2E Local](#e2e-local)

## E2E Local

**Tier:** `local`

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts
```

Covers local kitten TTS environment checks, model synthesis with speaker selection (mini + micro), and mutual exclusion validation.

**Tier:** `slow-api` (setup downloads models from the internet)

```bash
bun t test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
```

The kitten full-pipeline test (write+tts with `--groq`) is in the [TTS services tests](./text-to-speech-tests-services.md) since it requires an API key.
