# Local Tests

Shared `bun t` runner behavior plus the local/runtime-heavy test paths for Whisper, Reverb, local llama.cpp, and Kitten TTS.

For API-backed and networked coverage, see [Service Tests](service-tests.md).

Default agent/contributor verification is `bun run check`. For smoke coverage that avoids third-party APIs and provider costs, use only targeted local/no-cost tests:

```bash
bun test test/test-cases/validation/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli-usage-errors.test.ts
bun test test/test-cases/validation/option-resolution-contracts.test.ts
```

Additional no-cost URL article contract coverage lives in `test/test-cases/validation/html-url-backends-contracts.test.ts` and `test/test-cases/validation/price-mode-contracts.test.ts`; those suites mock provider calls and cover `--all-url` artifact and price-preflight behavior. `test/test-cases/validation/provider-selection-contracts.test.ts` is another no-cost suite covering provider-flag acceptance/rejection and shared-flag logic across all provider types.

The `bun t` commands below document the full project runner for humans. Do not use `bun t`, `bun run t`, or `AGENT=1 bun test/test-runner.ts` as a default verification pass. Service, e2e, and full-runner commands may call paid or quota-limited providers and must not be used as agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Shared Runner Behavior](#shared-runner-behavior)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
# run all local tests
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ test/test-cases/e2e/step-2-stt-e2e/stt-local/ test/test-cases/e2e/step-3-write-e2e/write-local/ test/test-cases/e2e/step-4-tts-e2e/tts-local/ test/test-cases/e2e/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts
```

```bash
# local STT coverage
bun t test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/
bun t test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/reverb.test.ts

# local write and TTS coverage
bun t test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts
bun t test/test-cases/e2e/step-3-write-e2e/write-local/write-project-lyrics.test.ts
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts

# local lyric-video coverage
bun t test/test-cases/e2e/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts
```

## Shared Runner Behavior

- Test discovery comes from `test/test-cases/**/*.test.ts`.
- Selection is path-based only.
- Normal test mode passes `--max-concurrency=30` to `bun test` by default. Pass an explicit `--max-concurrency=<n>` to override it for a run.
- Price and budget preflight commands run with the same default runner concurrency of 30.
- `--test-price` uses the same normal `test/test-cases/...` path filters as `bun t`: append it to the command you would otherwise run to price-check the mapped commands without running the live tests. `--budget <whole-number-hundredths-of-a-cent>` remains a live-test skip mechanism for the selected normal test paths. For example, `--budget 100` allows tests estimated at up to 1 cent.
- Each run writes artifacts under `./project/test-output/YYYY-MM-DD_HH-MM-SS_test-run/`, including `runner.log`, `commands.log`, `metrics.ndjson`, `metadata/`, and `report.json`. Normal test mode also writes `junit.xml`, `e2e-report.json`, and `model-calibration.json`.
- By default, `bun t` cleans test outputs after every run and leaves `./project/test-output/latest.log` with the run summary, failures, runner log, and command log. Normal test mode also sets `AUTOSHOW_TEST_PRESERVE_ARTIFACTS=0`, which deletes per-test output directories as tests finish.
- Use `--no-cleanup` to keep the full run directory, per-test CLI outputs, and test cache under `./project/test-output/`. The older `--cleanup` flag is still accepted but no longer changes behavior.

```bash
# keep the full run directory after completion
bun t --no-cleanup

# default cleanup still leaves a failure/debug summary
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts
cat project/test-output/latest.log
```

## Current Coverage

| Area | Paths | Notes |
|------|-------|-------|
| Download local file | `test/test-cases/e2e/step-1-download-e2e/download-input-types-local-file.test.ts` | Local input path coverage |
| OCR options | `test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-options.test.ts` | Core local OCR validation and routing coverage |
| PaddleOCR image extraction | `test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts` | Heavier local OCR coverage |
| Whisper | `test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/` | Includes default, split, model-price, and `large-v3-turbo` coverage |
| Reverb | `test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/reverb.test.ts` | Heavier local STT coverage |
| Llama write | `test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts`, `test/test-cases/e2e/step-3-write-e2e/write-local/write-project-lyrics.test.ts` | Local llama.cpp audio and project-text flows |
| Local TTS | `test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts` | Standalone Kitten TTS coverage |
| Music lyric-video | `test/test-cases/e2e/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts` | Local FFmpeg/Whisper lyric-video rendering |

## Price Preflight

Local price and budget commands are now path-based:

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-local/reverb/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-local/write-project-lyrics.test.ts --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts --budget 500
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts --budget 500
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts --test-price
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts --budget 500
```

Notes:
- `--test-price` with no path filters resolves all mapped test price commands.
- `--budget` in normal mode only skips tests that use a matching `budgetedTest()` key.
- Some local paths still have no mapped price commands, including `test/test-cases/validation/`, `test/test-cases/setup/`, and local lyric-video rendering.

## Related Docs

- [Service Tests](service-tests.md)
- [Step 0 Setup Service Tests](step-0-service-tests-setup.md)
- [extract](../commands/process-steps/step-2-extract/01-extract.md)
- [Write Command](../commands/process-steps/step-3-write/write-text.md)
- [TTS Command](../commands/process-steps/step-4-tts/text-to-speech.md)
