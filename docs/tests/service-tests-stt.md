# Service Tests: STT

Provider-backed speech-to-text coverage for the `stt` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/
```

## Current Coverage

- Provider-specific suites live under `test/test-cases/e2e/step-2-stt-e2e/stt-services/assemblyai/`, `deepgram/`, `elevenlabs/`, `gladia/`, `groq/`, `mistral/`, `openai/`, `rev/`, and `speechmatics/`.
- These suites cover invalid model rejection, `--price` output, and real transcription when the required API key is configured.
- Step 2 hosted coverage is selected cleanly by directory because the service suites now live under the explicit `stt-services/` subfolder.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/assemblyai/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/gladia/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/rev/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/speechmatics/ --test-price
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/openai/ --budget 25
```

## Related Docs

- [Service Tests](service-tests.md)
- [STT Tests (Services)](../commands/step-2-stt/stt-audio-tests-services.md)
