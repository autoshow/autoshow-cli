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
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Each provider suite uses `defineTTSServiceTest`, which currently covers:
- invalid model rejection
- `--price` output
- real synthesis when the required API key is configured

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

`kitten-tts-pipeline.test.ts` covers the root `write` pipeline with Groq for step 3 plus Kitten TTS for step 4.

Service setup details are in [`text-to-speech-local.md#setup`](./text-to-speech-local.md#setup).
