# Service Tests

API-backed and networked test coverage for provider integrations, remote-input download paths, and cross-provider e2e flows.

Shared `bun t` runner behavior, artifacts, cleanup, and path-based selection are documented in [Local Tests](local-tests.md).

## Service Quick Start

```bash
# service command suites
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/
bun t test/test-cases/e2e/step-3-write-e2e/write-services/
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/
bun t test/test-cases/e2e/step-5-image-gen-e2e/
bun t test/test-cases/e2e/step-6-video-gen-e2e/
bun t test/test-cases/e2e/step-7-music-gen-e2e/

# network-backed download coverage
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts
```

## Command Pages

- [Setup Service Tests](service-tests-setup.md)
- [Download Service Tests](service-tests-download.md)
- [Extract Service Tests](service-tests-extract.md)
- [Transcribe Service Tests](service-tests-transcribe.md)
- [Write Service Tests](service-tests-write.md)
- [TTS Service Tests](service-tests-tts.md)
- [Image Service Tests](service-tests-image.md)
- [Video Service Tests](service-tests-video.md)
- [Music Service Tests](service-tests-music.md)

## Cross-Cutting Coverage

- `test/test-cases/validation/model-options.test.ts` remains the main service-facing validation suite for model-option handling, but it does not currently have mapped `--test-price` coverage.
- `test/test-cases/e2e/api-cheap.test.ts` is still useful for `--test-price` reporting, but its mappings are report-only. `--budget` does not skip tests in that file.
- `test/test-cases/e2e/cli-integration.test.ts` covers cross-provider CLI flows, but it does not currently have mapped price commands.
- `--test-price` with no path filters still resolves all mapped priceable tests across both local and service coverage.

## Related Docs

- [Local Tests](local-tests.md)
- [Setup Tests](../commands/step-0-setup/setup-tests.md)
- [Download Tests](../commands/step-1-download/download-file-tests.md)
- [Extract Tests (Services)](../commands/step-2-extract/extract-document-tests-services.md)
- [Transcribe Tests (Services)](../commands/step-2-transcribe/transcribe-audio-tests-services.md)
- [Write Tests (Services)](../commands/step-3-write/write-text-tests-services.md)
- [TTS Tests (Services)](../commands/step-4-tts/text-to-speech-tests-services.md)
- [Image Tests (Services)](../commands/step-5-image/text-to-image-tests-services.md)
- [Video Tests](../commands/step-6-video/text-to-video-tests-services.md)
- [Music Tests](../commands/step-7-music/text-to-music-tests-services.md)
