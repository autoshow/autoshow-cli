# Service Tests: TTS

Provider-backed text-to-speech coverage for the `tts` command plus the service-side Kitten pipeline flow.

## Quick Start

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/
```

## Current Coverage

- Provider suites in `test/test-cases/e2e/step-4-tts-e2e/tts-services/` cover OpenAI, Gemini, Groq, ElevenLabs, and MiniMax TTS.
- Each provider suite covers invalid model rejection, `--price` output, and real synthesis when the required API key is configured.
- `test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts` covers the root `write` pipeline with Kitten TTS plus multi-provider speech output behavior.
- The Kitten pipeline file does not currently have its own mapped `--test-price` or `--budget` selector.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/openai-tts.test.ts --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/tts-services/minimax-tts.test.ts --budget 25
```

## Related Docs

- [Service Tests](service-tests.md)
- [TTS Tests (Services)](../commands/step-4-tts/text-to-speech-tests-services.md)
