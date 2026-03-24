# write (local)

Run `write` with a local llama.cpp model.

## Outline

- [Setup](#setup)
- [Runtime Setup](#runtime-setup)
- [Local Runtime](#local-runtime)
- [Service Environment](#service-environment)
- [Usage](#usage)
- [Local LLM](#local-llm)
- [Examples](#examples)
- [Prompts](#prompts)
- [Flags](#flags)
- [Notes](#notes)
- [Local Tests](#local-tests)
- [E2E Local](#e2e-local)
- [E2E Slow-Local](#e2e-slow-local)
- [Related Local Coverage Routed as API](#related-local-coverage-routed-as-api)

## Setup

### Runtime Setup

```bash
# full setup
bun as setup

# install llama.cpp if needed and download all supported local write models
bun as setup --step write

# optional: add larger local transcription assets used by some write flows
bun as setup --step transcription
```

### Local Runtime

Local write runtime pieces:
- `runtime/bin/llama-server`
- local models under `runtime/models/llama/`

### Service Environment

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
MINIMAX_API_KEY=...
```

## Usage

```bash
bun as write [input] [flags]
```

`write` still uses the normal step 1 download and step 2 transcribe / extract routing. Choosing `--llama` only controls the step 3 LLM.

## Local LLM

Current local llama.cpp models in the project config:
- `ggml-org/gemma-3-270m-it-GGUF`
- `ggml-org/Qwen3-0.6B-GGUF`

## Examples

```bash
# Local write pipeline with llama.cpp
bun as write input/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF

# Document input + local summary
bun as write input/1-document.pdf --llama ggml-org/Qwen3-0.6B-GGUF

# Multiple prompts
bun as write input/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF --prompt shortSummary longSummary
```

## Prompts

Prompt names are loaded from `src/prompts/prompts.json`. Common names include:
- `default`
- `shortSummary`
- `longSummary`
- `chapters`

## Flags

| Flag | Description |
|------|-------------|
| `--llama <model>` | Select the local llama.cpp model |
| `--prompt <name...>` | Select prompt preset(s) |
| `--price` | Show the aggregated estimate and exit |

## Notes

- Local llama output is always written as markdown (`text.md`), even when structured mode is enabled for the command.
- Upstream transcribe / extract behavior is still controlled by the normal `write` flags.

## Local Tests

```bash
bun t \
  test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts \
  test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts \
  test/test-cases/e2e/step-3-write-e2e/llama/llama-qwen.test.ts \
  test/test-cases/e2e/step-3-write-e2e/write-subcommand-local.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

### E2E Local

**Tier:** `local`

```bash
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts
```

Covers:
- local llama smoke / price coverage
- the Gemma local model

### E2E Slow-Local

**Tier:** `slow-local`

```bash
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-qwen.test.ts
```

Covers the Qwen local model.

### Related Local Coverage Routed as API

`write-subcommand-local.test.ts` exercises local llama flows for:
- audio input
- document input
- multi-prompt local output

It currently routes to the `api` tier because of its file location:

```bash
bun t test/test-cases/e2e/step-3-write-e2e/write-subcommand-local.test.ts
```
