# Step 2 Service Tests: STT

Provider-backed speech-to-text coverage for the `extract` media route, including deAPI exact-pricing and manifest assertions.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/
```

## Current Coverage

- `test/test-cases/e2e/step-2-stt-e2e/stt-services/service-models.test.ts` is the shared provider suite for AssemblyAI, Cloudflare, deAPI, Deepgram, DeepInfra, ElevenLabs, Gladia, Groq, Grok, Mistral, Rev, Soniox, Speechmatics, and Together.
- The shared `defineSTTServiceTest` helper covers invalid model rejection, `--price` output, and real transcription when the required API key is configured.
- deAPI coverage also verifies exact-price preflight and run-manifest estimated/actual STT cost fields with local stubbed responses.
- AWS has a dedicated suite because readiness depends on AWS CLI auth plus explicit or saved `awsRegion` / `awsBucket` values instead of a single API-key env var.
- Google Cloud STT has a dedicated suite because readiness depends on gcloud CLI auth, an active project with linked billing, and `speech.googleapis.com` enablement instead of a single API-key env var.
- YouTube caption-first mode and other zero-cost routing coverage live in validation suites such as `input-contracts.test.ts`, `option-resolution-contracts.test.ts`, `provider-selection-contracts.test.ts`, `price-mode-contracts.test.ts`, `resume-cache-setup-contracts.test.ts`, and `stt-media-cache-contracts.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/ --budget 2500
```

All current step 2 STT service suites resolve mapped price commands, including deAPI exact-price coverage in the shared suite.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [extract STT](../commands/process-steps/step-2-extract/02-extract-stt.md)
