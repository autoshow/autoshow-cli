# Service Tests

Service-backed, networked, and setup-adjacent test coverage for provider integrations, remote-input download paths, and cross-provider e2e flows.

Shared `bun t` runner behavior, artifacts, cleanup, and path-based selection are documented in [Local Tests](local-tests.md).

## Service Quick Start

```bash
# setup bootstrap coverage
bun t \
  test/test-cases/e2e/step-0-setup-e2e/llama-models/llama-downloads.test.ts \
  test/test-cases/e2e/step-0-setup-e2e/tts-models/tts-setup.test.ts

# network-backed download coverage
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts

# service command suites
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/
bun t test/test-cases/e2e/step-3-write-e2e/write-services/
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/
bun t test/test-cases/e2e/step-5-image-gen-e2e/
bun t test/test-cases/e2e/step-6-video-gen-e2e/
bun t test/test-cases/e2e/step-7-music-gen-e2e/
```

## Step Pages

- [Step 0 Setup Service Tests](step-0-service-tests-setup.md)
- [Step 1 Download Service Tests](step-1-service-tests-download.md)
- [Step 2 OCR Service Tests](step-2-service-tests-ocr.md)
- [Step 2 STT Service Tests](step-2-service-tests-stt.md)
- [Step 3 Write Service Tests](step-3-service-tests-write.md)
- [Step 4 TTS Service Tests](step-4-service-tests-tts.md)
- [Step 5 Image Service Tests](step-5-service-tests-image.md)
- [Step 6 Video Service Tests](step-6-service-tests-video.md)
- [Step 7 Music Service Tests](step-7-service-tests-music.md)

## Cross-Cutting Coverage

- `test/test-cases/validation/model-options.test.ts` remains the main service-facing validation suite for model-option handling, but it does not currently have mapped `--test-price` coverage.
- `test/test-cases/e2e/api-cheap.test.ts` is still useful for `--test-price` reporting, but its mappings are report-only. `--budget` does not skip tests in that file.
- `test/test-cases/e2e/cli-integration.test.ts` covers cross-provider CLI flows, but it does not currently have mapped price commands.
- `--test-price` with no path filters still resolves all mapped priceable tests across both local and service coverage.
