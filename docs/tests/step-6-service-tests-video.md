# Step 6 Service Tests: Video

Provider-backed validation, price coverage, and optional live generation coverage for the `video` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/
```

## Current Coverage

- Video coverage is split into one model or scenario file per provider target under `test/test-cases/e2e/service/step-6-video-gen-e2e/`, with provider flag validation isolated in `provider-flag-validation.test.ts`.
- `test/test-cases/validation/video-provider-contracts.test.ts` covers mocked REST contracts for Gemini Veo media inputs, GLM text/image/interpolation/reference requests, MiniMax text/image/subject-reference requests, and Grok generation/reference/edit/extension endpoint shapes including moderation failure handling.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --test-price
```

The price checks cover:

- Gemini: `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview`, `veo-3.1-lite-generate-preview`
- MiniMax: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `MiniMax-Hailuo-2.3`, `T2V-01-Director`, `T2V-01`, `I2V-01-Director`, `I2V-01-live`, `I2V-01`, `S2V-01`
- GLM: `cogvideox-3`, `viduq1-text`, `vidu2-image`, `vidu2-start-end`, `vidu2-image`, `vidu2-start-end`, `vidu2-reference`
- Grok: `grok-imagine-video`
- Runway: `gen4.5`

## Related Docs

- [Service Tests](service-tests.md)
- [Video](../commands/process-steps/step-6-video/text-to-video-services.md)
