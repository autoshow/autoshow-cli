# TTS Tests (services)

```bash
bun t \
  test/test-cases/e2e/step-4-tts-e2e/openai-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/gemini-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/groq-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/elevenlabs-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/minimax-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/kitten-tts-pipeline.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Local](#e2e-local)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Each provider test file includes `--price` estimate tests and an "rejects invalid model" validation test via the shared `defineTTSServiceTest` factory.

## E2E Local

No service-tier local tests — see [text-to-speech-tests-local.md](./text-to-speech-tests-local.md).

## E2E Services

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/openai-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/gemini-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/groq-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/elevenlabs-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/minimax-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/kitten-tts-pipeline.test.ts
```

`kitten-tts-pipeline` runs the full write+tts pipeline with `--groq` (requires `GROQ_API_KEY`).

Service setup/env prerequisites are in [`text-to-speech-setup.md`](./text-to-speech-setup.md).
