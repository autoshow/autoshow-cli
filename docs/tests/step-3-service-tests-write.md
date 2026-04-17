# Step 3 Service Tests: Write

Provider-backed LLM coverage for the `write` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-3-write-e2e/write-services/
```

## Current Coverage

- Provider suites live under `test/test-cases/e2e/step-3-write-e2e/write-services/openai/`, `anthropic/`, `gemini/`, `grok/`, `groq/`, and `minimax/`.
- These suites use `defineLLMWriteTest` to verify service-backed write runs, output artifacts, and `run.json` step 3 metadata when the required API key is configured.
- `test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts` adds explicit `write` command flows for OpenAI, Anthropic, Gemini, Groq, MiniMax, and Grok, plus a dedicated `--price` preflight case.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-3-write-e2e/write-services/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts --budget 25
```

The directory-wide `--test-price` selection currently resolves OpenAI, Anthropic, Gemini, Groq, MiniMax, and `write-subcommand-services.test.ts` mappings. The Grok directory does not currently have its own mapped price selector.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [Write Command](../commands/process-steps/step-3-write/write-text.md)
