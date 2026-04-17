# Step 6 Service Tests: Video

Provider-backed validation and price coverage for the `video` command.

## Quick Start

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/
```

## Current Coverage

- `test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts` covers Gemini Veo invalid model rejection, `--price` output, `video` requiring at least one provider flag, and multi-provider `--price` acceptance with Gemini plus MiniMax.
- `test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts` covers MiniMax invalid model rejection and `--price` output for the current MiniMax video model set.
- There are currently no full provider-generation e2e video tests. Step 6 coverage is limited to validation and price preflight.

## Price Preflight

```bash
bun t test/test-cases/e2e/step-6-video-gen-e2e/ --test-price
bun t test/test-cases/e2e/step-6-video-gen-e2e/minimax-video-gen.test.ts --budget 25
```

Both current step 6 suites resolve mapped price commands.

## Related Docs

- [Service Tests](service-tests.md)
- [Video](../commands/process-steps/step-6-video/text-to-video-services.md)
