# Transcribe Tests (local)

Run all local transcribe tests:

```bash
bun t \
  test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-default.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Non-E2E](#validation--non-e2e)
- [E2E Local](#e2e-local)

## Validation / Non-E2E

No standalone local transcribe parsing/unit file is currently defined.

## E2E Local

**Tier:** `local`/`slow-local`

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-default.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts
```

Covers default/base/tiny/split whisper flows, large-v3-turbo audio/video+split, and reverb diarization paths.
