# Step 2 Service Tests: STT

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/
```

## Current Coverage

- The shared `defineSTTServiceTest` helper covers invalid model rejection, `--price` output, and real transcription when the required API key is configured.
- YouTube caption-first mode and other zero-cost routing coverage live in validation suites such as `input-contracts.test.ts`, `option-resolution-contracts.test.ts`, `provider-selection-contracts.test.ts`, `price-mode-contracts.test.ts`, `resume-cache-setup-contracts.test.ts`, and `stt-media-cache-contracts.test.ts`.
- `happyscribe` has dedicated mocked validation coverage in `test/test-cases/validation/happyscribe-transcript-parser-contracts.test.ts`. `scrapecreators` has dedicated mocked validation coverage in `test/test-cases/validation/scrapecreators-stt-contracts.test.ts`. `openai-stt`, `gemini-stt`, and `glm-stt` are defined STT providers with no entries in the shared `service-models.test.ts` suite or dedicated e2e service tests.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --test-price
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --budget 2500
```


## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [extract STT](../commands/process-steps/step-2-extract/02-extract-stt.md)
