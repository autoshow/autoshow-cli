# stt (local)

Download audio and transcribe it with the local STT engines. Alias: `transcribe`.

## Outline

- [Setup](#setup)
- [Runtime Setup](#runtime-setup)
- [Local Runtime](#local-runtime)
- [Service Environment](#service-environment)
- [Usage](#usage)
- [Supported Inputs](#supported-inputs)
- [Local Engines](#local-engines)
- [Examples](#examples)
- [Flags](#flags)
- [Notes](#notes)
- [Local Tests](#local-tests)
- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [Core Local Paths](#core-local-paths)
- [Heavier Local Paths](#heavier-local-paths)

## Setup

### Runtime Setup

```bash
# full local setup
bun as setup

# isolated steps below assume their prerequisites already exist

# build whisper.cpp binary
bun as setup --step whisper-binary

# download the default whisper model (tiny)
bun as setup --step whisper-model

# download large-v3-turbo + Reverb assets
bun as setup --step transcription

# install the Reverb environment and models
bun as setup --step reverb
```

### Local Runtime

Local transcribe runtime pieces:
- Whisper binary at `runtime/bin/whisper-cli`
- Whisper models under `runtime/models/whisper/`
- Reverb environment under `runtime/bin/reverb/`
- Reverb models under `runtime/models/reverb/`

### Service Environment

```bash
GROQ_API_KEY=...
ELEVENLABS_API_KEY=...
DEEPGRAM_API_KEY=...
OPENAI_API_KEY=...
MISTRAL_API_KEY=...
ASSEMBLYAI_API_KEY=...
```

## Usage

```bash
bun as stt [input] [flags]
```

## Supported Inputs

`stt` uses the same input routing as `download` for audio/video sources:

- YouTube, Twitch, or TikTok URL
- direct media URL
- local media file
- directory batch
- URL-list batch (`.md` / `.txt`)
- RSS / podcast feed batch
- YouTube channel batch

Document inputs are not supported by `stt`.

## Local Engines

| Engine | Selection | Models / behavior |
|--------|-----------|-------------------|
| Whisper.cpp | default, or `--whisper <model>` | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Reverb | `--reverb` | diarized local transcription |

If no engine flag is provided, `stt` uses Whisper with the default `tiny` model.

## Examples

```bash
# Default local Whisper
bun as stt input/examples/audio/1-audio.mp3

# Larger Whisper model
bun as stt input/examples/audio/1-audio.mp3 --whisper large-v3-turbo

# Reverb with explicit verbatimicity
bun as stt input/examples/audio/1-audio.mp3 --reverb --reverb-verbatimicity 0.5

# Split a long media file into 10-minute chunks first
bun as stt input/examples/video/2-video.mp4 --whisper large-v3-turbo --split

# Batch from a URL list
bun as stt input/examples/document/2-urls.md --batch-limit 5
```

## Flags

| Flag | Description |
|------|-------------|
| `--whisper <model>` | Select the local Whisper model |
| `--reverb` | Use Reverb instead of Whisper |
| `--reverb-verbatimicity <0-1>` | Reverb output style |
| `--split` | Split audio into 10-minute chunks before transcription |
| `--prompt <name...>` | Named prompt(s) from `src/prompts/prompts.json` |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |
| `--price` | Show the aggregated estimate and exit |

## Notes

- `--speaker-count` is accepted by the CLI but ignored by the local engines.

## Local Tests

```bash
bun t \
  test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-default.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-large-v3-turbo.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-models-price.test.ts \
  test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/reverb/reverb.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

### Validation / Price / Non-E2E

`whisper-models-price.test.ts` covers `--price` for all supported local Whisper models.

### Core Local Paths

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-default.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-models-price.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/ --test-price
```

Covers:
- default Whisper transcription on local audio
- split-mode transcription on local audio
- `--price` for `tiny`, `base`, `small`, `medium`, and `large-v3-turbo`

### Heavier Local Paths

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-large-v3-turbo.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/reverb/reverb.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-large-v3-turbo.test.ts --budget 5
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/reverb/reverb.test.ts --budget 5
```

Covers:
- `large-v3-turbo` on local audio
- `large-v3-turbo` with split-mode video input
- Reverb transcription with and without explicit verbatimicity
