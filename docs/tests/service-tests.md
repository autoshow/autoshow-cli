# Service Tests

API-backed and networked test coverage for the current `api` and `slow-api` suites, plus the smoke-tier remote download case that often travels with them.

Shared `bun t` runner behavior, artifacts, cleanup, and path-filter rules are documented in [Local Tests](local-tests.md).

## Outline

- [Quick Start](#quick-start)
- [Service-Specific Notes](#service-specific-notes)
- [Tier Map](#tier-map)
- [Current Suites](#current-suites)
- [Price Preflight](#price-preflight)
- [Command Docs](#command-docs)

## Quick Start

```bash
# service and network tiers
bun t --tier api
bun t --tier slow-api
bun t --tier api,slow-api

# targeted service suites
bun t test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/
bun t test/test-cases/e2e/step-3-write-e2e/openai/openai-models.test.ts
bun t test/test-cases/e2e/step-5-image-gen-e2e/
```

## Service-Specific Notes

- `test/test-cases/validation/model-options.test.ts` is the only validation file routed to `api`.
- `test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts` uses a remote input but is routed to `smoke`, not `api`.
- `test/test-cases/e2e/step-0-setup-e2e/` is pure `slow-api`: it downloads assets and validates setup flows, but it does not perform API inference.
- `test/test-cases/e2e/step-2-extract-e2e/` is mixed `smoke` + `api` + `slow-local`, so use exact files for service-only extract coverage.
- `test/test-cases/e2e/step-4-tts-e2e/` is mixed `local` + `api`, so use exact files or `--tier api` for service-only TTS coverage.

## Tier Map

| Tier | What runs | Notes |
|------|-----------|-------|
| `api` | `model-options.test.ts`, provider OCR/STT/LLM/TTS/image/video/music suites, `api-cheap.test.ts`, `cli-integration.test.ts` | API-backed coverage |
| `slow-api` | Setup downloads plus feed/channel and streaming download tests | Network-dependent coverage, no local-only guarantees |
| `smoke` companion | `download-input-types-direct-url.test.ts` | Remote input coverage that is not routed to `api` |

## Current Suites

| Area | Tier | Paths | Notes |
|------|------|-------|-------|
| Validation | `api` | `test/test-cases/validation/model-options.test.ts` | The rest of `validation/` is `smoke` |
| Direct URL download | `smoke` | `test/test-cases/e2e/step-1-download-e2e/download-input-types-direct-url.test.ts` | Remote input, but not `api` |
| Feed/channel and streaming downloads | `slow-api` | `test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts`, `test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts` | Network-dependent remote-input coverage |
| Setup downloads | `slow-api` | `test/test-cases/e2e/step-0-setup-e2e/` | Includes `llama-models/llama-downloads.test.ts` and `tts-models/tts-setup.test.ts` |
| Extract | `api` | `test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts` | The directory also contains `smoke` and `slow-local` files |
| Transcribe | `api` | `test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/`, `elevenlabs/`, `groq/`, `openai/`, `mistral/` | Provider-specific STT coverage |
| Write | `api` | `test/test-cases/e2e/step-3-write-e2e/openai/`, `anthropic/`, `gemini/`, `groq/`, `minimax/`, `test/test-cases/e2e/step-3-write-e2e/write-subcommand-services.test.ts` | Provider LLM coverage |
| TTS | `api` | `test/test-cases/e2e/step-4-tts-e2e/openai-tts.test.ts`, `gemini-tts.test.ts`, `groq-tts.test.ts`, `elevenlabs-tts.test.ts`, `minimax-tts.test.ts`, `kitten-tts-pipeline.test.ts` | Use exact files because the directory also contains local TTS |
| Image | `api` | `test/test-cases/e2e/step-5-image-gen-e2e/` | Provider image generation coverage |
| Video | `api` | `test/test-cases/e2e/step-6-video-gen-e2e/` | Provider video generation coverage |
| Music | `api` | `test/test-cases/e2e/step-7-music-gen-e2e/` | Provider music generation coverage |
| Integration | `api` | `test/test-cases/e2e/api-cheap.test.ts`, `test/test-cases/e2e/cli-integration.test.ts` | Cross-provider integration coverage |

## Price Preflight

Tier-level price preflight is the canonical service workflow:

```bash
bun t --tier api --test-price
bun t --tier slow-api --test-price
bun t --tier api --test-price --budget 25
```

Direct file/path `--test-price` mappings currently exist for:

- `test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts`
- Provider STT files and directories under `test/test-cases/e2e/step-2-transcribe-e2e/`
- Provider write files and directories under `test/test-cases/e2e/step-3-write-e2e/`
- Exact service TTS files except `test/test-cases/e2e/step-4-tts-e2e/kitten-tts-pipeline.test.ts`
- Image, video, and music files/directories under `step-5-image-gen-e2e/`, `step-6-video-gen-e2e/`, and `step-7-music-gen-e2e/`

Use tier-level preflight instead for `model-options.test.ts`, download files/directories, setup files/directories, `api-cheap.test.ts`, `cli-integration.test.ts`, and `kitten-tts-pipeline.test.ts`.

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
