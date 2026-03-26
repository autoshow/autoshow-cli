# Plan: Multi-Provider Image Generation

Allow image generation to run multiple providers in one invocation, using the same target-collection pattern already used by TTS. This plan also closes scope gaps in pricing, preflight estimation, and output file reporting.

## Outline

- [Goals](#goals)
- [Current State](#current-state)
- [Recommended Changes](#recommended-changes)
- [Open Decisions](#open-decisions)
- [Files To Update](#files-to-update)
- [Verification](#verification)

## Goals

- Permit `--gemini-image`, `--openai-image`, and `--minimax-image` to be used together.
- Preserve current single-provider behavior for users who only select one image provider.
- Reuse the existing target-collection / per-provider run-loop pattern already present in `step-4-tts`.
- Ensure costs, timing, metadata, preflight output, and final artifact reporting all reflect every selected image provider.

## Current State

- `src/cli/commands/process-steps/step-5-image/run-image-gen.ts` resolves exactly one provider via `resolveImageEngine()`.
- `src/cli/commands/process-steps/step-5-image/define-image-command.ts` rejects runs with more than one image provider.
- `src/cli/commands/process-steps/process-video.ts` assumes `step5` is a single metadata object.
- `src/utils/pricing/compute-costs.ts` and `src/utils/pricing/compute-processing-time.ts` only account for one image provider at a time.
- `src/utils/pricing/aggregate-pricing.ts` and `src/cli/commands/process-steps/step-5-image/image-utils/image-pricing.ts` still estimate only the first configured image provider during preflight.
- Current filename assumptions are too PNG-specific. OpenAI can emit `jpg`, MiniMax emits `jpeg`, and Gemini can already emit multiple files for a single provider when `--imagen-count` is used.

## Recommended Changes

### 1. Add `image-targets.ts`

Create `src/cli/commands/process-steps/step-5-image/image-targets.ts` and mirror the structure of `src/cli/commands/process-steps/step-4-tts/tts-targets.ts`.

Suggested contents:

- `ImageTarget` type:
  ```ts
  {
    service: ImageProvider
    model: string
    run: (prompt, outputDir, opts) => Promise<{ imagePaths: string[], metadata: Step5Metadata }>
  }
  ```
- `ImageGenOptions` type moved out of `run-image-gen.ts`
- `collectImageTargets(options: ImageGenOptions): ImageTarget[]`
- `sanitizeImageModelName(model: string): string`
- A filename helper that preserves the provider-native extension and supports multi-image outputs per target

Do not hardcode `.png` in the helper. The helper should preserve the extension from the original file produced by the provider.

Recommended multi-provider naming scheme:

| Scenario | Example |
|----------|---------|
| Single Gemini output | `generated-image.png` |
| Single OpenAI JPEG output | `generated-image.jpg` |
| Single MiniMax output | `generated-image.jpeg` |
| Multi-provider Gemini output | `generated-image-gemini-imagen-4.0-generate-001.png` |
| Multi-provider Gemini second image | `generated-image-gemini-imagen-4.0-generate-001-2.png` |
| Multi-provider OpenAI JPEG output | `generated-image-openai-gpt-image-1-mini.jpg` |

### 2. Refactor `run-image-gen.ts`

Update `src/cli/commands/process-steps/step-5-image/run-image-gen.ts` to follow the same execution model as `src/cli/commands/process-steps/step-4-tts/run-tts.ts`.

Recommended changes:

- Remove `resolveImageEngine()`
- Import `collectImageTargets()` and the filename helper from `image-targets.ts`
- Add `runImageTargets(targets, prompt, outputDir, options)`
- Run targets sequentially with isolated per-target workspaces such as `.image-tmp-{service}-{model}`
- Collect partial failures instead of failing the entire run on the first provider error
- Rename finalized artifacts only after each provider succeeds
- Return `Promise<{ imagePaths: string[], metadata: Step5Metadata[] }>`

Important detail:

- `imagePaths` should remain the flattened list of all generated files across all providers.
- `metadata` should become one `Step5Metadata` entry per provider, not one entry per output file.

Recommended metadata improvement:

- Add `imageFileNames: string[]` to `Step5Metadata` while keeping `imageFileName` as the primary file for backward compatibility.
- Without this, `metadata.json` and downstream artifact reporting can only describe the first file from a Gemini multi-image run.

### 3. Update `process-video.ts`

Update `src/cli/commands/process-steps/process-video.ts` so step 5 mirrors the existing multi-target TTS handling.

Recommended changes:

- Change `step5Metadata` to `Step5Metadata[] | null`
- Keep `step5ImagePaths: string[] | null` from `runImageGen()` so artifact reporting can list every output image
- Serialize step 5 with `serializeOneOrMany(step5Metadata)`
- Add one step summary per image provider, just like step 4 already does for TTS
- Replace the single `artifactFiles['image'] = ...` assignment with an image artifact map builder
- Pass `imageTargets` into estimated timing instead of `imageService` / `imageModel`

Avoid tying this helper only to metadata unless `Step5Metadata` is expanded with `imageFileNames`. `process-video.ts` currently needs either the returned `imagePaths` or a richer metadata shape to report every generated artifact.

### 4. Update `define-image-command.ts`

Update `src/cli/commands/process-steps/step-5-image/define-image-command.ts`.

Recommended changes:

- Remove the `providerCount > 1` guard
- Reuse `collectImageTargets()` for preflight expected-file reporting
- Treat `metadata` as `Step5Metadata[]`
- Serialize `image` metadata with `serializeOneOrMany(metadata)` for consistency with TTS and write output
- Build expected output filenames with the same extension-aware naming logic used by the runtime path
- Keep final artifact reporting based on `imagePaths`, not assumptions about one provider or one file

The current preflight output example is incomplete for:

- OpenAI runs with `--image-format jpeg`
- MiniMax runs
- Gemini runs with `--imagen-count > 1`
- Any future multi-provider image run

### 5. Update Pricing And Preflight

Update both direct pricing helpers and preflight aggregation so every selected image provider is represented.

Required files:

- `src/utils/pricing/compute-costs.ts`
- `src/utils/pricing/compute-processing-time.ts`
- `src/utils/pricing/aggregate-pricing.ts`
- `src/cli/commands/process-steps/step-5-image/image-utils/image-pricing.ts`

Recommended behavior:

- `computeActualCosts()` should accept `step5: Step5Metadata | Step5Metadata[]` and emit one image cost step per provider
- `computeEstimatedCosts()` should emit one image estimate per selected provider instead of picking the first populated image model
- `computeEstimatedProcessingTimes()` should accept `imageTargets?: Array<{ service, model, count }>` and emit one timing step per target
- `computeActualProcessingTimes()` should accept `step5: Step5Metadata | Step5Metadata[]`
- `aggregate-pricing.ts` should append one image estimate step per selected provider
- `image-pricing.ts` should move from a single `estimateImageCost()` result to an array-based helper such as `estimateImageCosts()`

This is the largest scope gap in the current plan. Supporting multiple providers only in runtime code would leave `--price` and budget enforcement wrong.

### 6. Tests

Update or add tests alongside the implementation.

Recommended coverage:

- Replace the existing "rejects multiple image providers" cases in:
  - `test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts`
  - `test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts`
- Add unit tests for:
  - target collection
  - filename generation
  - partial failure handling
  - array normalization in pricing / timing helpers
- Add a lightweight multi-provider preflight test so `--price` covers more than one image step
- Add one integration path that verifies `write` serializes `step5` as one-or-many and reports multiple image artifacts

Avoid making multi-provider live E2E coverage depend on multiple real API keys if a cheaper unit/integration test can prove the control flow.

### 7. Documentation Follow-Up

Once the implementation lands, update the user-facing docs that currently describe image generation as single-provider only.

Expected follow-up docs:

- `docs/commands/step-5-image/text-to-image-services.md`
- `docs/diagrams/05-types-and-output.md`

`src/cli/commands/process-steps/step-1-download/targets/handle-process-target.ts` does not currently appear to enforce an image provider count check, so it should be treated as "confirm no change needed" rather than as a required edit.

## Open Decisions

### Metadata shape

The cleanest option is to add `imageFileNames: string[]` to `Step5Metadata` and keep `imageFileName` as the primary artifact for compatibility. If that is intentionally out of scope, the plan should explicitly accept that `metadata.json` will still only point at the first file from a multi-image Gemini run.

### Filename strategy

The runtime and preflight paths should use the same naming function. If the naming logic is duplicated, file listings will drift again.

## Files To Update

| File | Action | Notes |
|------|--------|-------|
| `src/cli/commands/process-steps/step-5-image/image-targets.ts` | New | Target collection, setup, validation, filename helpers |
| `src/cli/commands/process-steps/step-5-image/run-image-gen.ts` | Refactor | Multi-target execution, partial failures, workspace cleanup |
| `src/cli/commands/process-steps/step-5-image/define-image-command.ts` | Update | Remove single-provider guard, use one-or-many metadata, fix expected-file output |
| `src/cli/commands/process-steps/process-video.ts` | Update | Step 5 array handling, summaries, artifact reporting |
| `src/utils/pricing/compute-costs.ts` | Update | Actual and estimated image cost arrays |
| `src/utils/pricing/compute-processing-time.ts` | Update | Actual and estimated image timing arrays |
| `src/utils/pricing/aggregate-pricing.ts` | Update | Preflight image estimates for every provider |
| `src/cli/commands/process-steps/step-5-image/image-utils/image-pricing.ts` | Update | Array-based image cost estimation |
| `src/types/process-types.ts` | Recommended | Add `imageFileNames` if full manifest support is desired |
| `test/test-cases/e2e/step-5-image-gen-e2e/*.test.ts` | Update | Replace rejection coverage, add multi-provider assertions |
| `docs/commands/step-5-image/text-to-image-services.md` | Follow-up | Remove "only one provider" language |
| `docs/diagrams/05-types-and-output.md` | Follow-up | Reflect final metadata shape |

## Verification

1. Run `bun run build`.
2. Run single-provider image smoke tests and confirm filenames remain provider-native:
   - Gemini: `generated-image.png`
   - OpenAI JPEG: `generated-image.jpg`
   - MiniMax: `generated-image.jpeg`
3. Run `bun as image "a cat" --gemini-image imagen-4.0-fast-generate-001 --openai-image gpt-image-1-mini` and verify both outputs are present.
4. Run a Gemini multi-image command such as `bun as image "a cat" --gemini-image imagen-4.0-generate-001 --imagen-count 2` and verify both files are preserved after any multi-provider rename logic.
5. Verify `metadata.json` uses one object for one provider and an array for multiple providers.
6. Verify `--price` and budget enforcement show one image step per selected provider.
7. Verify `write` / `process-video` output lists every generated image artifact, not just the first one.
8. Run image-related tests, including the step-5 E2E suite and any new unit coverage.
