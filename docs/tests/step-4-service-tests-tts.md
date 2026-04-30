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

- Provider suites in `test/test-cases/e2e/step-4-tts-e2e/tts-services/` cover OpenAI, Gemini, Groq, Grok, Mistral, Deepgram, Runway, ElevenLabs, and MiniMax TTS.
- The shared `defineTTSServiceTest` helper covers invalid model rejection, `--price` output, and real synthesis when the required API key is configured.
- Mistral live coverage is gated by `MISTRAL_API_KEY`; the saved-voice test also requires `MISTRAL_TTS_VOICE`, and the reference-audio test uses `input/examples/audio/anthony-voice.mp3`.
- `test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts` covers the root `write` pipeline with Groq plus Kitten TTS, `write --price` behavior when multiple LLM providers are selected, and multi-provider speech artifacts when OpenAI TTS is also enabled.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/ --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/minimax-tts.test.ts --budget 2500
```

`kitten-tts-pipeline.test.ts` does not currently have its own mapped `--test-price` or `--budget` selector.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [TTS Command](../commands/process-steps/step-4-tts/text-to-speech.md)
