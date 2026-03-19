# Tests (local)

All tests that run without API keys. Covers `smoke`, `local`, `slow-local`, and `slow-api` (setup-only) tiers.

## Run All Local Tests

```bash
bun t --tier smoke,local,slow   # includes smoke, local, slow-local, and slow-api
bun t --tier smoke
bun t --tier local
bun t --tier slow-local
bun t --tier smoke,local
bun t --tier local --budget 5
```

```bash
bun t --tier smoke,local,slow --test-price
bun t --tier smoke --test-price
bun t --tier local --test-price
bun t --tier slow-local --test-price
bun t --tier local --test-price --budget 5
```

`--budget` runs a detailed preflight before the test run and prints RUN/SKIP plus skipped-command list output. Combined with `--test-price`, it keeps the same per-test-key budget filter and marks over-budget keys as skipped in the price report.

## Outline

- [Smoke](#smoke)
- [Local](#local)
- [Slow Local](#slow-local)
- [Slow API (Setup)](#slow-api-setup)

## Smoke

Fast checks with no models or API keys required.

### Validation

```bash
bun t test/test-cases/validation/prompt-loader.test.ts
bun t test/test-cases/validation/tier-routing.test.ts
```

### Step 1 — Download

```bash
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts
```

### Step 2 — Extract

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-options.test.ts
```

### Directory

```bash
bun t test/test-cases/validation/
```

```bash
bun t test/test-cases/validation/ --test-price
```

## Local

Requires local runtimes and models (whisper.cpp, llama.cpp, kitten), no API keys.

### Step 2 — Transcribe (Whisper)

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-default.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-models-price.test.ts
```

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-default.test.ts --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-models-price.test.ts --test-price
```

### Step 3 — Write (Llama)

```bash
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-subcommand-local.test.ts
```

```bash
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-subcommand-local.test.ts --test-price
```

### Step 4 — TTS (Kitten)

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts
```

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/
bun t test/test-cases/e2e/step-3-write-e2e/llama/
```

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/llama/ --test-price
```

## Slow Local

Heavy local models with longer runtimes, no network required.

### Step 2 — Extract (PaddleOCR)

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-paddle-ocr-image.test.ts
```

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-paddle-ocr-image.test.ts --test-price
```

### Step 2 — Transcribe (Whisper Large, Reverb)

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts
```

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo.test.ts --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts --test-price
```

### Step 3 — Write (Llama Qwen)

```bash
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-qwen.test.ts
```

```bash
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-qwen.test.ts --test-price
```

### Directory

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/reverb/
```

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/reverb/ --test-price
```

## Slow API (Setup)

Downloads models from the internet. No API inference, but requires network.

### Step 0 — Setup

```bash
bun t test/test-cases/e2e/step-0-setup-e2e/llama-models/llama-downloads.test.ts
bun t test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts
```

### Directory

```bash
bun t test/test-cases/e2e/step-0-setup-e2e/
```
