# Step 5 Service Tests: Image

Provider-backed image-generation coverage for the `image` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/
```

## Current Coverage

- Provider suites cover OpenAI, Gemini, MiniMax, GLM, Grok, Runway, BFL, and deAPI image generation.
- The shared `defineImageServiceTest` helper covers invalid model rejection, `--price` output, real generation, and metadata checks when the required API key is configured.
- `openai-image-gen.test.ts` also covers JPEG output options, multi-provider `--price` output, and `write` pipeline integration with `--openai-image`.
- `gemini-image-gen.test.ts` also covers multi-provider `--price` output and rejects `--image-size` for `imagen-4.0-fast-generate-001`.
- `minimax-image-gen.test.ts` adds aspect-ratio generation coverage for `image-01`.
- `bfl-image-gen.test.ts` covers BFL FLUX.2 generation, unsupported flag validation, mocked polling/download metadata, and output extension handling.
- `deapi-image-gen.test.ts` covers all supported deAPI image models and `--image-size`.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts --budget 25
```

All step 5 provider suites currently resolve mapped price commands.

## Related Docs

- [Service Tests](service-tests.md)
- [Image Command](../commands/process-steps/step-5-image/text-to-image.md)
