# Step 7 Service Tests: Music

Provider-backed music-generation coverage for the `music` command plus service-side write-pipeline cases.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/
```

## Current Coverage

- Model-level files under `test/test-cases/e2e/service/step-7-music-gen-e2e/` use `defineMusicServiceTest` for invalid model rejection, `--price`, and real provider generation when the required API key is configured.
- Step 7 also covers provider-selection validation, multi-provider `--price` output, and multi-provider runs that emit per-provider filenames plus array metadata.
- Pipeline files add write-pipeline coverage for `write --price` with MiniMax music, `write` with ElevenLabs music enabled, and `write` with MiniMax music plus a lyrics file.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --test-price
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/gemini-lyria-3-pro-preview.test.ts --test-price
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --budget 2500
```


## Related Docs

- [Service Tests](service-tests.md)
- [Music Services](../commands/process-steps/step-7-music/text-to-music-services.md)
