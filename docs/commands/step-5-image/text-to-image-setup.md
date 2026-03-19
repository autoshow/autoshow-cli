# Image Setup

Setup and test prerequisites for `image`.

## Outline

- [Service Environment](#service-environment)
- [Setup and Validation Tests](#setup-and-validation-tests)

## Service Environment

Set required env vars for service image providers:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
```

## Setup and Validation Tests

```bash
# service image tests
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts
```
