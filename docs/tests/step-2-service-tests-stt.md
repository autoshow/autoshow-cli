# Step 2 Service Tests: STT

Provider-backed speech-to-text coverage for the `stt` command, including deAPI exact-pricing and manifest assertions.

## Quick Start

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/
```

## Current Coverage

- `test/test-cases/e2e/step-2-stt-e2e/stt-services/service-models.test.ts` is the shared provider suite for AssemblyAI, deAPI, Deepgram, DeepInfra, ElevenLabs, Gladia, Groq, Mistral, Rev, Soniox, and Speechmatics.
- The shared `defineSTTServiceTest` helper covers invalid model rejection, `--price` output, and real transcription when the required API key is configured.
- deAPI coverage also verifies exact-price preflight and run-manifest estimated/actual STT cost fields with local stubbed responses.
- AWS has a dedicated suite because readiness depends on AWS CLI auth plus saved `awsRegion` / `awsBucket` config instead of a single API-key env var.
- Google Cloud STT has a dedicated suite because readiness depends on gcloud CLI auth, an active project with linked billing, and `speech.googleapis.com` enablement instead of a single API-key env var.
- YouTube caption-first mode and other zero-cost routing coverage live in `test/test-cases/validation/youtube-captions.test.ts`, `yt-dlp-options.test.ts`, `stt-resume-batch.test.ts`, `compute-costs.test.ts`, and `model-options.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/ --budget 25
```

All current step 2 STT service suites resolve mapped price commands, including deAPI exact-price coverage in the shared suite.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [STT Command](../commands/process-steps/step-2-stt/stt-audio.md)
