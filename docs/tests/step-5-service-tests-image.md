# Step 5 Service Tests: Image

Provider-backed image-generation coverage for the `image` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/
```

## Current Coverage

- The shared `defineImageServiceTest` helper covers invalid model rejection, `--price` output, real generation, and metadata checks when the required API key is configured.
- OpenAI coverage is split across `openai-gpt-image-1.5.test.ts`, `openai-gpt-image-2.test.ts`, and `openai-gpt-image-2-pipeline.test.ts`; it includes `gpt-image-2` low-quality `1024x1024`, JPEG output options, multi-provider `--price` output, and `write` pipeline integration with `--image openai=...`.
- `gemini-image-gen.test.ts` covers native Gemini image generation, shared image options, and multi-provider `--price` output.
- BFL coverage is split across FLUX.2 model files plus `bfl-validation.test.ts` for unsupported flag validation, mocked polling/download metadata, and output extension handling. Validation and mocked REST contracts cover numbered `--image-input` reference fields.
- `provider-selection-contracts.test.ts` covers provider-specific shared image flag acceptance and rejection, including BFL input and Reve aspect ratio, fit-within size, format, input count, and unsupported flag validation.
- `image-provider-rest-contracts.test.ts` covers mocked BFL and Reve request payloads without calling hosted providers.
- Grok coverage is split across `grok-imagine-image.test.ts` and `grok-imagine-image-quality.test.ts` for generation, `--image-aspect-ratio`, and `--image-size`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --test-price
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --budget 2500
```

All step 5 provider suites currently resolve mapped price commands.

## Related Docs

- [Service Tests](service-tests.md)
- [Image Command](../commands/process-steps/step-5-image/text-to-image.md)
