# Service Tests: Image

Provider-backed image-generation coverage for the `image` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/
```

## Current Coverage

- Provider suites cover OpenAI, Gemini, and MiniMax image generation.
- The image suites cover invalid model rejection, `--price` output, and real generation when the required API key is configured.
- Additional provider-specific assertions include Gemini multi-provider rejection and `--image-size` validation, OpenAI multi-provider rejection, and MiniMax aspect-ratio generation.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts --budget 25
```

## Related Docs

- [Service Tests](service-tests.md)
- [Image Tests (Services)](../commands/step-5-image/text-to-image-tests-services.md)
