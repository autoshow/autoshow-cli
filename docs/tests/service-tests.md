# Service Tests

Service-backed, networked, and setup-adjacent test coverage for provider integrations, remote-input download paths, and cross-provider e2e flows.

Shared `bun t` runner behavior, artifacts, cleanup, and path-based selection are documented in [Local Tests](local-tests.md).


## Outline

- [Service Quick Start](#service-quick-start)
- [Step Pages](#step-pages)
- [Cross-Cutting Coverage](#cross-cutting-coverage)

## Service Quick Start

```bash
# setup bootstrap coverage
bun t test/test-cases/setup/tts-models/tts-setup.test.ts

# network-backed download coverage
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts

# service command suites
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ --test-price

bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/ --test-price

bun t test/test-cases/e2e/step-3-write-e2e/write-services/
bun t test/test-cases/e2e/step-3-write-e2e/write-services/ --test-price

bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/ --test-price

bun t test/test-cases/e2e/step-5-image-gen-e2e/
bun t test/test-cases/e2e/step-5-image-gen-e2e/ --test-price

bun t test/test-cases/e2e/step-6-video-gen-e2e/
bun t test/test-cases/e2e/step-6-video-gen-e2e/ --test-price

bun t test/test-cases/e2e/step-7-music-gen-e2e/
bun t test/test-cases/e2e/step-7-music-gen-e2e/ --test-price
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

- `test/test-cases/validation/option-resolution-contracts.test.ts`, `provider-selection-contracts.test.ts`, and `price-mode-contracts.test.ts` cover model-option, provider-selection, and price-mode behavior without live service calls.
- `test/test-cases/validation/video-provider-contracts.test.ts`, `image-provider-rest-contracts.test.ts`, `tts-provider-contracts.test.ts`, `music-provider-contracts.test.ts`, and `resume-additive-provider-contracts.test.ts` cover mocked REST and provider-contract behavior across their respective generation command families. Provider-specific REST contract suites such as `anthropic-rest-contracts.test.ts`, `gemini-rest-contracts.test.ts`, `openai-rest-contracts.test.ts`, and `mistral-rest-contracts.test.ts` cover write/OCR service request payloads.
- `test/test-cases/price-flag/` contains focused `--price` coverage for STT, OCR, write, TTS, image, video, and music command families.
- `test/test-cases/e2e/cli-integration.test.ts` covers cross-provider CLI flows, but it does not currently have mapped price commands.
- `--test-price` with no path filters still resolves all mapped test price commands across both local and service coverage.
