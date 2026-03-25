# TTS Tests (services)

```bash
bun t \
  test/test-cases/e2e/step-4-tts-e2e/tts-services/openai-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/tts-services/gemini-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/tts-services/groq-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/tts-services/elevenlabs-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/tts-services/minimax-tts.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Each provider suite uses `defineTTSServiceTest`, which currently covers:
- invalid model rejection
- `--price` output
- real synthesis when the required API key is configured

## E2E Services

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/openai-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/gemini-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/groq-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/elevenlabs-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/minimax-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/openai-tts.test.ts --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/minimax-tts.test.ts --budget 25
```

`kitten-tts-pipeline.test.ts` covers the root `write` pipeline with Groq for step 3 plus Kitten TTS for step 4.

`kitten-tts-pipeline.test.ts` currently does not have mapped `--test-price` or `--budget` coverage.

Service setup details are in [`text-to-speech-local.md#setup`](./text-to-speech-local.md#setup).
