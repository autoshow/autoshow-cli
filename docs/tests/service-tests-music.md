# Service Tests: Music

Provider-backed music-generation coverage for the `music` command plus service-side write-pipeline cases.

## Quick Start

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/
```

## Current Coverage

- `test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts` and `minimax-music-gen.test.ts` cover invalid model rejection, `--price`, and real provider generation when the required API key is configured.
- The music suites also cover provider-selection validation and multi-provider runs that emit per-provider filenames plus array metadata.
- Additional write-pipeline coverage currently lives in `minimax-music-gen.test.ts`, including `write --price`, `write` with ElevenLabs music enabled, and `write` with MiniMax music plus a lyrics file.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts --budget 25
```

## Related Docs

- [Service Tests](service-tests.md)
- [Music Tests](../commands/step-7-music/text-to-music-tests-services.md)
