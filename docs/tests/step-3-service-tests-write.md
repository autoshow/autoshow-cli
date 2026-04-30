# Step 3 Service Tests: Write

Provider-backed LLM coverage for the `write` command.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/step-3-write-e2e/write-services/
```

## Current Coverage

- Provider-backed write coverage lives in `test/test-cases/e2e/step-3-write-e2e/write-services/service-models.test.ts`.
- The suite uses `defineLLMWriteTest` to verify service-backed write runs, output artifacts, and `run.json` step 3 metadata when the required API key is configured.
- Current providers are OpenAI, Anthropic, Gemini, Groq, MiniMax, Grok, GLM, and Kimi. The GLM case covers `--glm glm-5.1` and requires `GLM_API_KEY`; the Kimi case covers `--kimi kimi-k2.6` and requires `KIMI_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-3-write-e2e/write-services/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-services/service-models.test.ts --budget 2500
```

The directory-wide `--test-price` selection resolves OpenAI, Anthropic, Gemini, Groq, MiniMax, GLM, Kimi, and local llama price mappings. Live service tests skip providers whose API key is not configured.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [Write Command](../commands/process-steps/step-3-write/write-text.md)
