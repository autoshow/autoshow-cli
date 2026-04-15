# Service Tests: Transcribe

Provider-backed speech-to-text coverage for the `transcribe` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/
```

## Current Coverage

- Provider-specific suites live under `test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/assemblyai/`, `deepgram/`, `elevenlabs/`, `groq/`, `mistral/`, `openai/`, and `speechmatics/`.
- These suites cover invalid model rejection, `--price` output, and real transcription when the required API key is configured.
- Step 2 hosted coverage is selected cleanly by directory because the service suites now live under the explicit `transcribe-services/` subfolder.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/assemblyai/ --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/speechmatics/ --test-price
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/openai/ --budget 25
```

## Related Docs

- [Service Tests](service-tests.md)
- [Transcribe Tests (Services)](../commands/step-2-transcribe/transcribe-audio-tests-services.md)
