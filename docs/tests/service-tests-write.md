# Service Tests: Write

Provider-backed LLM coverage for the `write` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-3-write-e2e/write-services/
```

## Current Coverage

- Provider-specific suites live under `test/test-cases/e2e/step-3-write-e2e/write-services/openai/`, `anthropic/`, `gemini/`, `grok/`, `groq/`, and `minimax/`.
- `test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts` covers explicit `write` command flows and `--price`.
- Hosted write coverage is selected cleanly by directory because the service suites now live under the explicit `write-services/` subfolder.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-3-write-e2e/write-services/openai/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts --budget 25
```

## Related Docs

- [Service Tests](service-tests.md)
- [Write Tests (Services)](../commands/step-3-write/write-text-tests-services.md)
