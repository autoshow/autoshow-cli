# Step 4 Service Tests: TTS

Provider-backed text-to-speech coverage for the `tts` command plus the service-side Kitten pipeline flow.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/
```

## Current Coverage

- The shared `defineTTSServiceTest` helper covers invalid model rejection, `--price` output, and real synthesis when the required API key is configured.
- ElevenLabs Instant Voice Cloning has mocked validation coverage for IVC creation, shared clone reuse across selected ElevenLabs models, verification-required failures, metadata, API error handling, and setup estimates.
- ElevenLabs PVC has mocked validation coverage for ready-PVC synthesis, create/upload/CAPTCHA setup, verification/train/poll, failed training, setup artifacts, metadata, and price/timing estimates.
- OpenAI custom voice creation has mocked validation coverage for consent upload, voice creation, speech synthesis with `{ id: "voice_..." }`, metadata, and setup estimates. Live coverage is opt-in only: set `OPENAI_API_KEY`, `OPENAI_TTS_CUSTOM_VOICE_TEST=1`, `OPENAI_TTS_CONSENT_ID`, and `OPENAI_TTS_REF_AUDIO`.
- `test/test-cases/validation/tts-provider-contracts.test.ts` covers OpenAI instructions/speed, Grok language/text-normalization and custom voice IDs, Groq English default voice selection, MiniMax synthesis controls, Hume Octave file requests and voice payloads, Cartesia byte synthesis requests, and provider-specific mocked request metadata.
- Mistral live coverage is gated by `MISTRAL_API_KEY`; the saved-voice test also requires `MISTRAL_TTS_VOICE`, and the reference-audio test uses `input/examples/audio/anthony-voice.mp3`.
- MiniMax live coverage is gated by `MINIMAX_API_KEY` and uses hosted/preset voice IDs.
- Speechify live coverage is gated by `SPEECHIFY_API_KEY`; the expected speaker is `SPEECHIFY_TTS_VOICE` or `george`.
- Google Cloud live coverage is opt-in with `AUTOSHOW_GCLOUD_TTS_E2E=1` and requires `gcloud` CLI auth, an active billed project, and `texttospeech.googleapis.com`.
- Hume and Cartesia currently have mocked provider-contract, option/config/help, and side-effect-free price coverage; no live service e2e cases are mapped yet.
- `test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts` covers the root `write` pipeline with Groq plus Kitten TTS, `write --price` behavior when multiple LLM providers are selected, and multi-provider speech artifacts when OpenAI TTS is also enabled.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/ --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts --budget 2500
```

ElevenLabs IVC, ElevenLabs PVC, OpenAI custom voice, Speechify, Hume, Cartesia, Google Cloud prebuilt TTS, and Google Cloud Instant Custom Voice with an existing key have side-effect-free price coverage. ElevenLabs IVC adds a 0 cent setup cost and 10000 ms setup time to the first ElevenLabs clone target. ElevenLabs PVC setup adds a 0 cent setup cost and, when `--elevenlabs-tts-pvc-wait` is set, 3 hours for English or 6 hours for non-English/multilingual training. OpenAI adds a 0 cent setup cost and 15000 ms setup time to the first OpenAI clone target.

The Kitten pipeline mapping is selected with `bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts --test-price`; budget preflight still maps the live e2e file.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [TTS Command](../commands/process-steps/step-4-tts/text-to-speech.md)
