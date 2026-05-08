# Step 7 Service Tests: Music

Provider-backed music-generation coverage for the `music` command plus service-side write-pipeline cases.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/
```

## Current Coverage

- `test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts`, `minimax-music-gen.test.ts`, and `gemini-music-gen.test.ts` use `defineMusicServiceTest` for invalid model rejection, `--price`, and real provider generation when the required API key is configured.
- Step 7 also covers provider-selection validation, multi-provider `--price` output, and multi-provider runs that emit per-provider filenames plus array metadata.
- `minimax-music-gen.test.ts` adds write-pipeline coverage for `write --price` with MiniMax music, `write` with ElevenLabs music enabled, and `write` with MiniMax music plus a lyrics file.
- deAPI music is supported by the command surface, but there is no dedicated `deapi-music-gen.test.ts` or mapped price selector in the current step-7 service suite.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-7-music-gen-e2e/gemini-music-gen.test.ts --test-price
bun t test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts --budget 2500
```

The ElevenLabs, MiniMax, and Gemini provider suites resolve mapped price commands, and the MiniMax suite also carries the current write-pipeline price selectors.

## Related Docs

- [Service Tests](service-tests.md)
- [Music Services](../commands/process-steps/step-7-music/text-to-music-services.md)
