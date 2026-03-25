# tts (local)

Generate speech audio from a local text file with Kitten TTS.

## Outline

- [Setup](#setup)
- [Runtime Setup](#runtime-setup)
- [Local Runtime](#local-runtime)
- [Service Environment](#service-environment)
- [Usage](#usage)
- [Local Engine](#local-engine)
- [Examples](#examples)
- [Flags](#flags)
- [Output](#output)
- [Local Tests](#local-tests)
- [Core Local Paths](#core-local-paths)
- [Related Setup Coverage](#related-setup-coverage)

## Setup

### Runtime Setup

```bash
# full setup
bun as setup

# install Kitten TTS and download all supported local TTS models
bun as setup --step tts
```

### Local Runtime

Local TTS runtime pieces:
- Kitten TTS venv under `runtime/bin/kitten-tts/`
- downloaded model cache created by Kitten TTS itself

API providers do not require local model downloads.

### Service Environment

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
```

## Usage

```bash
bun as tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file.

## Local Engine

| Engine | Selection | Models |
|--------|-----------|--------|
| Kitten TTS | `--kitten-tts <model>` | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |

If no engine flag is provided, `tts` defaults to Kitten TTS with `kitten-tts-nano-0.8-int8`.

## Examples

```bash
bun as tts input/1-tts.md --kitten-tts kitten-tts-mini --tts-speaker Jasper
bun as tts input/1-tts.md
```

## Flags

| Flag | Description |
|------|-------------|
| `--kitten-tts <model>` | Select the Kitten model |
| `--tts-speaker <name>` | Select the Kitten speaker |
| `--price` | Show the estimate and exit |

## Output

Each standalone `tts` run writes:
- `speech.wav`
- `metadata.json`

`metadata.json` includes `tts`, `cost`, and `timing` sections.

## Local Tests

```bash
bun t \
  test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts \
  test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

### Core Local Paths

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts --test-price --budget 5
```

Covers:
- Kitten runtime environment checks
- synthesis with `kitten-tts-micro`, `kitten-tts-mini`, `kitten-tts-nano`, and `kitten-tts-nano-0.8-int8`
- speaker selection
- mutual exclusion with hosted TTS flags
- invalid Kitten model and invalid speaker rejection

### Related Setup Coverage

```bash
bun t test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
```

This file validates the Kitten setup module and venv creation path.
