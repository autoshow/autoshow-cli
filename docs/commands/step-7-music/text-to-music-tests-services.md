# Music Tests

```bash
bun t \
  test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts \
  test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Services](#e2e-services)

## Validation / Price / Non-E2E

Current coverage comes from the two provider suites:
- invalid model rejection
- `--price` coverage (single-provider and multi-provider)
- real provider generation when the required API key is configured
- provider-selection validation (`music` requires at least one provider)
- multi-provider run producing per-provider filenames and array metadata (requires both API keys)

Additional write-pipeline coverage currently lives in `minimax-music-gen.test.ts`:
- `write --price` with MiniMax music
- `write` with ElevenLabs music enabled
- `write` with MiniMax music plus a lyrics file

## E2E Services

```bash
bun t test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts
bun t test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts
bun t test/test-cases/e2e/step-7-music-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts --budget 25
```

Provider env keys:
- `ELEVENLABS_API_KEY`
- `MINIMAX_API_KEY`
