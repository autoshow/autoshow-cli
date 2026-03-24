# Local Tests

Shared `bun t` runner behavior plus the current `smoke`, `local`, and `slow-local` suites for local runtimes and models.

For API-backed and networked coverage, see [Service Tests](service-tests.md).

## Outline

- [Quick Start](#quick-start)
- [Shared Runner Behavior](#shared-runner-behavior)
- [Tier Map](#tier-map)
- [Current Suites](#current-suites)
- [Price Preflight](#price-preflight)
- [Command Docs](#command-docs)

## Quick Start

```bash
# local-only tiers
bun t --tier smoke,local,slow-local

# targeted local suites
bun t test/test-cases/local/sample/sample-generate.test.ts
bun t test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-default.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts
```

## Shared Runner Behavior

- `bun t` always runs the sample/setup preflight before test discovery:
  `setup --step sample`, fallback `setup`, then `sample --out input/samples --verify-only`, and finally fixture regeneration if verification fails.
- Test discovery comes from `test/test-cases/**/*.test.ts`.
- `--api` is an alias for `--tier api`.
- `--tier slow` expands to both `slow-local` and `slow-api`, so it is not local-only.
- Path filters take precedence over tier selection. Mixed-tier paths currently include `test/test-cases/validation/`, `test/test-cases/e2e/step-1-download-e2e/`, `test/test-cases/e2e/step-2-extract-e2e/`, `test/test-cases/e2e/step-2-transcribe-e2e/whisper/`, `test/test-cases/e2e/step-3-write-e2e/llama/`, and `test/test-cases/e2e/step-4-tts-e2e/`.
- Each run writes artifacts under `./test-output/YYYY-MM-DD_HH-MM-SS_test-run/`, including `runner.log`, `commands.log`, `metrics.ndjson`, `metadata/`, and `report.json`. Normal test mode also writes `junit.xml`, `e2e-report.json`, and `model-calibration.json`.
- `--cleanup` removes the run directory after a successful run. In normal test mode it also sets `AUTOSHOW_TEST_PRESERVE_ARTIFACTS=0`, which deletes per-test `./output/` directories as tests finish.

```bash
# remove the run directory after a successful run
bun t --cleanup

# drop per-test output directories during a normal run
AUTOSHOW_TEST_PRESERVE_ARTIFACTS=0 bun t test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts
```

## Tier Map

| Tier         | What runs                                                                 | Notes |
|--------------|---------------------------------------------------------------------------|-------|
| `smoke`      | Validation tests except `model-options.test.ts`, `smoke/sample`, local-file download, extract options | Fast checks with minimal dependencies |
| `local`      | `local/sample`, Whisper default/model coverage, local Llama write tests, `kitten-tts.test.ts` | Local runtimes/models only, no API keys |
| `slow-local` | PaddleOCR image extraction, Reverb, Whisper `large-v3-turbo`, Llama Qwen | Heavy local-only tests with longer runtimes |

## Current Suites

| Area | Tier | Paths | Notes |
|------|------|-------|-------|
| Validation | `smoke` | `test/test-cases/validation/` | `test/test-cases/validation/model-options.test.ts` belongs to `api` and is covered in [Service Tests](service-tests.md) |
| Sample command | `smoke` | `test/test-cases/smoke/sample/sample-command.test.ts` | CLI smoke coverage for `sample` and `samples` |
| Sample fixture generation | `local` | `test/test-cases/local/sample/sample-generate.test.ts` | Generates and verifies sample fixtures |
| Download local file | `smoke` | `test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts` | Local input path coverage |
| Extract options | `smoke` | `test/test-cases/e2e/step-2-extract-e2e/extract-options.test.ts` | `step-2-extract-e2e/` also contains `api` and `slow-local` files |
| Whisper | `local` + `slow-local` | `test/test-cases/e2e/step-2-transcribe-e2e/whisper/` | `whisper-large-v3-turbo.test.ts` is `slow-local` |
| Reverb | `slow-local` | `test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts` | Heavy local STT coverage |
| Llama write | `local` + `slow-local` | `test/test-cases/e2e/step-3-write-e2e/llama/`, `test/test-cases/e2e/step-3-write-e2e/write-subcommand-local.test.ts` | `llama-qwen.test.ts` is `slow-local` |
| Local TTS | `local` | `test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts` | `step-4-tts-e2e/` also contains `api` files |
| Related setup downloads | `slow-api` | `test/test-cases/e2e/step-0-setup-e2e/` | Networked setup coverage, not local-only |

## Price Preflight

Tier-level price preflight is the canonical local workflow:

```bash
bun t --tier smoke --test-price
bun t --tier local --test-price
bun t --tier slow-local --test-price
bun t --tier local --test-price --budget 5
```

Direct file-path `--test-price` mappings currently exist for:

- `test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts`
- `test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts`
- `test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo.test.ts`
- `test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts`

Use tier-level preflight instead for validation files, `whisper-default.test.ts`, `whisper-models-price.test.ts`, `extract-paddle-ocr-image.test.ts`, `llama-smoke.test.ts`, `write-subcommand-local.test.ts`, and `llama-qwen.test.ts`.

## Command Docs

- [Service Tests](service-tests.md)
- [Sample Tests](../commands/sample/sample-tests.md)
- [Setup Tests](../commands/step-0-setup/setup-tests.md)
- [Extract Tests (Local)](../commands/step-2-extract/extract-document-local.md#local-tests)
- [Transcribe Tests (Local)](../commands/step-2-transcribe/transcribe-audio-local.md#local-tests)
- [Write Tests (Local)](../commands/step-3-write/write-text-local.md#local-tests)
- [TTS Tests (Local)](../commands/step-4-tts/text-to-speech-local.md#local-tests)
