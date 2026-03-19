# Write Setup

Setup and test prerequisites for `write`.

## Outline

- [Runtime Setup](#runtime-setup)
- [Service Environment](#service-environment)
- [Setup and Validation Tests](#setup-and-validation-tests)

## Runtime Setup

```bash
# full setup
bun as setup

# pre-download all supported llama.cpp models
bun as setup --step write

# optional: pre-download large transcription assets used by some write flows
bun as setup --step transcription
```

Write local runtime requirements:
- llama.cpp runtime (`runtime/bin/llama-server`)
- local models under `runtime/models/llama/` (or `LLAMA_MODEL_PATH` override)

## Service Environment

Set required env vars for service LLMs:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
MINIMAX_API_KEY=...
```

## Setup and Validation Tests

```bash
# local write (smoke + full model coverage)
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts

# service write
bun t test/test-cases/e2e/step-3-write-e2e/openai/openai-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/anthropic/anthropic-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/gemini/gemini-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/groq/groq-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/minimax/minimax-models.test.ts
```
