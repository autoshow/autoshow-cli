# Tests (services)

All tests that require API keys and network. Covers `api` and `slow-api` tiers.

## Run All Service Tests

```bash
bun t --tier api,slow-api
bun t --tier api
bun t --tier api --budget 25
```

```bash
bun t --tier api,slow-api --test-price
bun t --tier api --test-price
bun t --tier api --test-price --budget 25
```

`--budget` runs a detailed preflight before the test run and prints RUN/SKIP plus skipped-command list output. Combined with `--test-price`, it keeps the same per-test-key budget filter and marks over-budget keys as skipped in the price report.

## Outline

- [Validation / Price](#validation--price)
- [Step 1 — Download](#step-1--download)
- [Step 2 — Extract](#step-2--extract)
- [Step 2 — Transcribe](#step-2--transcribe)
- [Step 3 — Write](#step-3--write)
- [Step 4 — TTS](#step-4--tts)
- [Step 5 — Image](#step-5--image)
- [Step 6 — Video](#step-6--video)
- [Step 7 — Music](#step-7--music)
- [Integration](#integration)
- [Slow API](#slow-api)

## Validation

**Tier:** `api`

```bash
bun t test/test-cases/validation/model-options.test.ts
```

```bash
bun t test/test-cases/validation/model-options.test.ts --test-price
```

## Step 1 — Download

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts
```

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-1-download-e2e/
```

```bash
bun t test/test-cases/e2e/step-1-download-e2e/ --test-price
```

## Step 2 — Extract

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts
```

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/
```

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/ --test-price
```

## Step 2 — Transcribe

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/assemblyai-models.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/elevenlabs/elevenlabs-scribe-v2.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/groq/groq-whisper-models.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/openai/openai-gpt-4o-transcribe-diarize.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/mistral/mistral-voxtral-mini-2602.test.ts
```

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/assemblyai-models.test.ts --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/elevenlabs/elevenlabs-scribe-v2.test.ts --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/groq/groq-whisper-models.test.ts --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/openai/openai-gpt-4o-transcribe-diarize.test.ts --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/mistral/mistral-voxtral-mini-2602.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/
bun t test/test-cases/e2e/step-2-transcribe-e2e/elevenlabs/
bun t test/test-cases/e2e/step-2-transcribe-e2e/groq/
bun t test/test-cases/e2e/step-2-transcribe-e2e/openai/
bun t test/test-cases/e2e/step-2-transcribe-e2e/mistral/
```

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/ --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/elevenlabs/ --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/groq/ --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/openai/ --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/mistral/ --test-price
```

## Step 3 — Write

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-3-write-e2e/openai/openai-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/anthropic/anthropic-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/gemini/gemini-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/groq/groq-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/minimax/minimax-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-subcommand-services.test.ts
```

```bash
bun t test/test-cases/e2e/step-3-write-e2e/openai/openai-models.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/anthropic/anthropic-models.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/gemini/gemini-models.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/groq/groq-models.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/minimax/minimax-models.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-subcommand-services.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-3-write-e2e/openai/
bun t test/test-cases/e2e/step-3-write-e2e/anthropic/
bun t test/test-cases/e2e/step-3-write-e2e/gemini/
bun t test/test-cases/e2e/step-3-write-e2e/groq/
bun t test/test-cases/e2e/step-3-write-e2e/minimax/
```

```bash
bun t test/test-cases/e2e/step-3-write-e2e/openai/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/anthropic/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/gemini/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/groq/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/minimax/ --test-price
```

## Step 4 — TTS

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/openai-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/gemini-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/groq-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/elevenlabs-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/minimax-tts.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/kitten-tts-pipeline.test.ts
```

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/openai-tts.test.ts --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/gemini-tts.test.ts --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/groq-tts.test.ts --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/elevenlabs-tts.test.ts --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/minimax-tts.test.ts --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/kitten-tts-pipeline.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/
```

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/ --test-price
```

## Step 5 — Image

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts
```

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts --test-price
bun t test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts --test-price
bun t test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/
```

```bash
bun t test/test-cases/e2e/step-5-image-gen-e2e/ --test-price
```

## Step 6 — Video

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts
bun t test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts
```

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts --test-price
bun t test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/
```

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/ --test-price
```

## Step 7 — Music

**Tier:** `api`

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts
bun t test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts
```

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts --test-price
bun t test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/
```

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/ --test-price
```

## Integration

**Tier:** `api`

```bash
bun t test/test-cases/e2e/api-cheap.test.ts
bun t test/test-cases/e2e/cli-integration.test.ts
```

```bash
bun t test/test-cases/e2e/api-cheap.test.ts --test-price
bun t test/test-cases/e2e/cli-integration.test.ts --test-price
```

## Slow API

Long-running network-dependent tests (large downloads, RSS/channel feeds, streaming).

**Tier:** `slow-api`

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
```

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts --test-price
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts --test-price
```
