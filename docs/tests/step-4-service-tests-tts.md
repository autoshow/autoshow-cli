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

- Provider suites in `test/test-cases/e2e/step-4-tts-e2e/tts-services/` cover OpenAI, Gemini, Groq, Grok, Mistral, Deepgram, Runway, ElevenLabs, MiniMax, and deAPI TTS.
- The shared `defineTTSServiceTest` helper covers invalid model rejection, `--price` output, and real synthesis when the required API key is configured.
- OpenAI custom voice creation has mocked validation coverage for consent upload, voice creation, speech synthesis with `{ id: "voice_..." }`, metadata, and setup estimates. Live coverage is opt-in only: set `OPENAI_API_KEY`, `OPENAI_TTS_CUSTOM_VOICE_TEST=1`, `OPENAI_TTS_CONSENT_ID`, and `OPENAI_TTS_REF_AUDIO`.
- Mistral live coverage is gated by `MISTRAL_API_KEY`; the saved-voice test also requires `MISTRAL_TTS_VOICE`, and the reference-audio test uses `input/examples/audio/anthony-voice.mp3`.
- MiniMax rapid voice-clone live coverage is gated by `MINIMAX_API_KEY`, uses `input/examples/audio/anthony-voice.mp3`, and carries a 150 cent provider clone fee.
- deAPI Qwen3 voice-clone live coverage is gated by `DEAPI_API_KEY` and uses `input/examples/audio/0-audio-short.mp3`.
- `test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts` covers the root `write` pipeline with Groq plus Kitten TTS, `write --price` behavior when multiple LLM providers are selected, and multi-provider speech artifacts when OpenAI TTS is also enabled.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/ --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts --budget 2500
```

OpenAI custom voice price preflight is side-effect free and covered without `OPENAI_API_KEY`; it adds a 0 cent setup cost and 15000 ms setup time to the first OpenAI clone target.

`kitten-tts-pipeline.test.ts` does not currently have its own mapped `--test-price` or `--budget` selector.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [TTS Command](../commands/process-steps/step-4-tts/text-to-speech.md)
