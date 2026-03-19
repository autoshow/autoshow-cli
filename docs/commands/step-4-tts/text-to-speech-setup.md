# TTS Setup

Setup and test prerequisites for `tts`.

## Outline

- [Runtime Setup](#runtime-setup)
- [Service Environment](#service-environment)
- [Setup and Validation Tests](#setup-and-validation-tests)

## Runtime Setup

```bash
# full setup
bun as setup

# pre-download all local TTS model weights
bun as setup --step tts
```

TTS local runtime requirements:
- `runtime/bin/kitten-tts`

## Service Environment

Set required env vars for service TTS:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
```

## Setup and Validation Tests

```bash
# pricing/non-e2e validation
bun t test/test-cases/price/tts-pricing.test.ts

# setup/runtime local tests
bun t test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts

# service tests
bun t test/test-cases/e2e/step-4-tts-e2e/openai-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/gemini-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/groq-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/elevenlabs-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/minimax-tts.test.ts
```
