# STT Tests (Services)

```bash
bun t \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/assemblyai/assemblyai-models.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/gladia/gladia-models.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/deepgram/deepgram-nova-3.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/groq/groq-whisper-models.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/elevenlabs/elevenlabs-scribe-v2.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/soniox/soniox-models.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/speechmatics/speechmatics-models.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/rev/rev-machine.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/openai/openai-gpt-4o-transcribe-diarize.test.ts \
  test/test-cases/e2e/step-2-stt-e2e/stt-services/mistral/mistral-voxtral-mini-2602.test.ts
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

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/assemblyai/assemblyai-models.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/gladia/gladia-models.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/deepgram/deepgram-nova-3.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/elevenlabs/elevenlabs-scribe-v2.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/groq/groq-whisper-models.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/mistral/mistral-voxtral-mini-2602.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/openai/openai-gpt-4o-transcribe-diarize.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/rev/rev-machine.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/soniox/soniox-models.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/speechmatics/speechmatics-models.test.ts
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/assemblyai/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/gladia/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/deepgram/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/rev/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/soniox/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/speechmatics/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/openai/ --budget 25
```

Service setup details are in [`stt-audio-local.md#setup`](./stt-audio-local.md#setup).
