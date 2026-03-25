# Service Tests

API-backed and networked test coverage for provider integrations, remote-input download paths, and cross-provider e2e flows.

Shared `bun t` runner behavior, artifacts, cleanup, and path-based selection are documented in [Local Tests](local-tests.md).

## Quick Start

```bash
# service STT, write, and media-provider suites
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/assemblyai/
bun t test/test-cases/e2e/step-3-write-e2e/write-services/openai/
bun t test/test-cases/e2e/step-5-image-gen-e2e/

# network and remote-input coverage
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts
```

## Service-Specific Notes

- `test/test-cases/validation/model-options.test.ts` is still a useful service-facing validation file, but it does not have mapped `--test-price` coverage.
- `test/test-cases/e2e/step-0-setup-e2e/` downloads assets and validates setup flows, but it does not currently have mapped price commands.
- Step 2 through step 4 e2e coverage now lives under explicit `*-services/` subfolders, so hosted suites can be selected by directory.
- `test/test-cases/e2e/api-cheap.test.ts` has report-only price mappings. It is useful for `--test-price`, but `--budget` will not skip tests in that file.

## Current Coverage

| Area | Paths | Notes |
|------|-------|-------|
| Validation | `test/test-cases/validation/model-options.test.ts` | Service-model validation without mapped price commands |
| Direct URL download | `test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts` | Hosted audio/video URL coverage |
| Feed/channel and streaming downloads | `test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts`, `test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts` | Network-dependent remote-input coverage |
| Setup downloads | `test/test-cases/e2e/step-0-setup-e2e/` | Llama downloads and Kitten setup validation |
| Extract | `test/test-cases/e2e/step-2-extract-e2e/extract-services/extract-mistral-ocr.test.ts` | Hosted OCR coverage |
| Transcribe | `test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/assemblyai/`, `elevenlabs/`, `groq/`, `openai/`, `mistral/` | Provider-specific STT coverage |
| Write | `test/test-cases/e2e/step-3-write-e2e/write-services/openai/`, `anthropic/`, `gemini/`, `groq/`, `minimax/`, `test/test-cases/e2e/step-3-write-e2e/write-services/write-subcommand-services.test.ts` | Hosted LLM coverage |
| TTS | `test/test-cases/e2e/step-4-tts-e2e/tts-services/` | Hosted TTS coverage, including the Kitten pipeline test |
| Image | `test/test-cases/e2e/step-5-image-gen-e2e/` | Hosted image generation coverage |
| Video | `test/test-cases/e2e/step-6-video-gen-e2e/` | Provider video `--price` coverage |
| Music | `test/test-cases/e2e/step-7-music-gen-e2e/` | Provider music and write-pipeline coverage |
| Integration | `test/test-cases/e2e/api-cheap.test.ts`, `test/test-cases/e2e/cli-integration.test.ts` | Cross-provider integration coverage |

## Price Preflight

Service price and budget commands are now path-based:

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/assemblyai/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-services/openai/ --test-price --budget 25
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/openai-tts.test.ts --test-price
bun t test/test-cases/e2e/step-5-image-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts --budget 25
bun t test/test-cases/e2e/api-cheap.test.ts --test-price
```

Notes:
- `api-cheap.test.ts` contributes report-only price coverage. It is included in `--test-price` but excluded from budget skip propagation.
- Setup files, `cli-integration.test.ts`, `kitten-tts-pipeline.test.ts`, and `validation/model-options.test.ts` currently have no mapped price commands.
- `--test-price` with no path filters resolves all mapped priceable tests across local and service coverage.

## Command Docs

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
