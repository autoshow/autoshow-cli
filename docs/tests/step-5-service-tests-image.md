# Step 5 Service Tests: Image

Provider-backed image-generation coverage for the `image` command.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/
```

## Current Coverage

- Provider suites cover OpenAI, Gemini, MiniMax, GLM, Grok, Runway, BFL, and deAPI image generation.
- The shared `defineImageServiceTest` helper covers invalid model rejection, `--price` output, real generation, and metadata checks when the required API key is configured.
- `openai-image-gen.test.ts` also covers `gpt-image-2` low-quality `1024x1024`, JPEG output options, multi-provider `--price` output, and `write` pipeline integration with `--openai-image`.
- `gemini-image-gen.test.ts` also covers multi-provider `--price` output and rejects `--image-size` for `imagen-4.0-fast-generate-001`.
- `minimax-image-gen.test.ts` adds aspect-ratio generation coverage for `image-01`; validation and mocked REST contracts cover `--image-input`, `--image-count`, and `--image-size`.
- `bfl-image-gen.test.ts` covers BFL FLUX.2 generation, unsupported flag validation, mocked polling/download metadata, and output extension handling. Validation and mocked REST contracts cover numbered `--image-input` reference fields.
- `provider-selection-contracts.test.ts` covers provider-specific shared image flag acceptance and rejection, including MiniMax count/size/input, BFL input, and GLM `--image-quality hd|standard`.
- `image-provider-rest-contracts.test.ts` covers mocked BFL, MiniMax, and GLM request payloads without calling hosted providers.
- `deapi-image-gen.test.ts` covers all supported deAPI image models and `--image-size`.

## Price Preflight

```bash
bun t test/test-price/step-5-image --test-price
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts --budget 2500
```

All step 5 provider suites currently resolve mapped price commands.

## Related Docs

- [Service Tests](service-tests.md)
- [Image Command](../commands/process-steps/step-5-image/text-to-image.md)
