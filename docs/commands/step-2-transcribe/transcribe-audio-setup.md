# Transcribe Setup

Setup and test prerequisites for `transcribe`.

## Outline

- [Runtime Setup](#runtime-setup)
- [Service Environment](#service-environment)
- [Setup and Validation Tests](#setup-and-validation-tests)

## Runtime Setup

```bash
# full setup
bun as setup

# pre-download large-v3-turbo Whisper + Reverb models
bun as setup --step transcription

# install/build only default whisper model assets
bun as setup --step whisper-model

# install Reverb environment
bun as setup --step reverb
```

Transcribe local runtime requirements:
- Whisper.cpp runtime and model files in `runtime/models/whisper/`
- Reverb runtime and model files in `runtime/models/reverb/`

## Service Environment

Set required env vars for service transcription:

```bash
GROQ_API_KEY=...
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
MISTRAL_API_KEY=...
ASSEMBLYAI_API_KEY=...
```

## Setup and Validation Tests

```bash
# local engines
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-default.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-models-price.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts

# service engines
bun t test/test-cases/e2e/step-2-transcribe-e2e/groq/groq-whisper-models.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/elevenlabs/elevenlabs-scribe-v2.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/openai/openai-gpt-4o-transcribe-diarize.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/mistral/mistral-voxtral-mini-2602.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/assemblyai-models.test.ts
```
