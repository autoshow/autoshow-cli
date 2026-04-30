# Local Tests

Shared `bun t` runner behavior plus the local/runtime-heavy test paths for Whisper, Reverb, local llama.cpp, Kitten TTS, and sample generation.

For API-backed and networked coverage, see [Service Tests](service-tests.md).

## Outline

- [Quick Start](#quick-start)
- [Shared Runner Behavior](#shared-runner-behavior)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
# run all local tests
bun t test/test-cases/local/ test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ test/test-cases/e2e/step-2-stt-e2e/stt-local/ test/test-cases/e2e/step-3-write-e2e/write-local/ test/test-cases/e2e/step-4-tts-e2e/tts-local/
```

```bash
# sample and local fixture coverage
bun t test/test-cases/local/sample/sample-generate.test.ts

# local STT coverage
bun t test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/
bun t test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/reverb.test.ts

# local write and TTS coverage
bun t test/test-cases/e2e/step-3-write-e2e/write-local/llama/
bun t test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts
```

## Shared Runner Behavior

- `bun t` always runs the sample/setup preflight before test discovery: `setup --step sample`, fallback `setup`, then `setup --sample --out input/samples --verify-only`, and finally fixture regeneration if verification fails.
- Test discovery comes from `test/test-cases/**/*.test.ts`.
- Selection is path-based only.
- `--test-price` and `--budget <whole-number-hundredths-of-a-cent>` operate on the same selected paths as normal test mode. For example, `--budget 100` allows tests estimated at up to 1 cent.
- Each run writes artifacts under `./test-output/YYYY-MM-DD_HH-MM-SS_test-run/`, including `runner.log`, `commands.log`, `metrics.ndjson`, `metadata/`, and `report.json`. Normal test mode also writes `junit.xml`, `e2e-report.json`, and `model-calibration.json`.
- `--cleanup` removes the run directory after a successful run. In normal test mode it also sets `AUTOSHOW_TEST_PRESERVE_ARTIFACTS=0`, which deletes per-test `./output/` directories as tests finish.

```bash
# remove the run directory after a successful run
bun t --cleanup

# drop per-test output directories during a normal run
AUTOSHOW_TEST_PRESERVE_ARTIFACTS=0 bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts
```

## Current Coverage

| Area | Paths | Notes |
|------|-------|-------|
| Sample fixture generation | `test/test-cases/local/sample/sample-generate.test.ts` | Generates and verifies sample fixtures |
| Download local file | `test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts` | Local input path coverage |
| OCR options | `test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-options.test.ts` | Core local OCR validation and routing coverage |
| PaddleOCR image extraction | `test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts` | Heavier local OCR coverage |
| Whisper | `test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/` | Includes default, split, model-price, and `large-v3-turbo` coverage |
| Reverb | `test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/reverb.test.ts` | Heavier local STT coverage |
| Llama write | `test/test-cases/e2e/step-3-write-e2e/write-local/llama/`, `test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts` | Local llama.cpp audio and document flows |
| Local TTS | `test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts` | Standalone Kitten TTS coverage |

## Price Preflight

Local price and budget commands are now path-based:

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/reverb.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-local/llama/llama-smoke.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts --budget 500
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts --test-price --budget 500
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts --budget 500
```

Notes:
- `--test-price` with no path filters resolves all mapped priceable tests.
- `--budget` in normal mode only skips tests that use a matching `budgetedTest()` key.
- Some local paths still have no mapped price commands, including `test/test-cases/local/sample/`, `test/test-cases/validation/`, and `test/test-cases/e2e/step-0-setup-e2e/`.

## Related Docs

- [Service Tests](service-tests.md)
- [Sample Tests](../commands/setup-and-utilities/sample/sample-tests.md)
- [Step 0 Setup Service Tests](step-0-service-tests-setup.md)
- [extract](../commands/process-steps/step-2-extract/01-extract.md)
- [Write Command](../commands/process-steps/step-3-write/write-text.md)
- [TTS Command](../commands/process-steps/step-4-tts/text-to-speech.md)
