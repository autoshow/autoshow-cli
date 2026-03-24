# Transcribe Tests (services)

```bash
bun t \
  test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/assemblyai-models.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/groq/groq-whisper-models.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/elevenlabs/elevenlabs-scribe-v2.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/openai/openai-gpt-4o-transcribe-diarize.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/mistral/mistral-voxtral-mini-2602.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Each provider file uses the shared `defineSTTServiceTest` helper, which currently covers:
- invalid model rejection
- `--price` output
- real transcription when the required API key is configured

## E2E Services

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/assemblyai-models.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/elevenlabs/elevenlabs-scribe-v2.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/groq/groq-whisper-models.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/mistral/mistral-voxtral-mini-2602.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/openai/openai-gpt-4o-transcribe-diarize.test.ts
```

Service setup details are in [`transcribe-audio-local.md#setup`](./transcribe-audio-local.md#setup).
