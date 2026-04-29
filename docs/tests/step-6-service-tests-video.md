# Step 6 Service Tests: Video

Provider-backed validation, price coverage, and optional live generation coverage for the `video` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/
```

## Current Coverage

- `test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts` covers Gemini Veo, MiniMax, and deAPI invalid model rejection, `--price` output, `video` requiring at least one provider flag, multi-provider `--price` acceptance, and price estimates for Gemini, GLM, Grok, Runway, and deAPI.
- Live generation coverage is defined for Gemini, MiniMax, and deAPI and is skipped unless the relevant API key is configured. Optional live Lite generation coverage requires `GEMINI_API_KEY`.
- GLM, Grok, and Runway currently have price/flag coverage; add live-service cases when those providers are stable enough for the budgeted test suite.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/ --test-price
```

The price checks cover:

- Gemini: `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview`, `veo-3.1-lite-generate-preview`
- MiniMax: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01`
- GLM: `cogvideox-3`, `viduq1-text`
- Grok: `grok-imagine-video`
- Runway: `gen4.5`
- deAPI: `Ltxv_13B_0_9_8_Distilled_FP8`, `Ltx2_19B_Dist_FP8`, `Ltx2_3_22B_Dist_INT8`

## Related Docs

- [Service Tests](service-tests.md)
- [Video](../commands/process-steps/step-6-video/text-to-video-services.md)
