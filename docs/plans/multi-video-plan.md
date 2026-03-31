# Plan: Multi-Service Video Generation

**Goal**: Allow `--gemini-video` and `--minimax-video` to be used together in the same `video` invocation, matching the multi-provider behavior already present for LLMs, TTS, Images, and Music.

Video is currently locked to a single provider by guard logic in step-6 command/runtime code, and pricing/timing estimate paths still assume exactly one video target.

---

## Findings From Current Code

- `runVideoGen` is shared by both the standalone `video` command and the full pipeline in `process-video.ts`, so changing its return shape requires updates in both call sites.
- `estimateVideoCost(...)` throws when both video providers are set, which would break preflight (`--price`) and estimated-cost computation unless estimate paths are widened.
- `computeEstimatedProcessingTimes(...)` currently only accepts one video target (`videoService` + `videoModel`), so estimated timing needs a multi-target path similar to existing music handling.

---

## Phase 1 — Add `video-targets.ts`

Create `src/cli/commands/process-steps/step-6-video/video-targets.ts` modeled on `step-7-music/music-targets.ts`.

Include:

- `VideoGenOptions` as `Pick<ProcessingOptions, 'geminiVideoModel' | 'minimaxVideoModel' | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'>`
- `VideoTarget` as `{ service: VideoProvider, model: string, run: (prompt, outputDir) => Promise<{ videoPath, metadata }> }`
- `sanitizeVideoModelName(model)` using `replace(/[/\\:*?"<>|]/g, '-')`
- `getVideoArtifactFileName(target, singleTarget)`:
  - single target: `generated-video.mp4`
  - multi target: `generated-video-{service}-{sanitizedModel}.mp4`
- `buildVideoArtifactMap(metadata[])`:
  - single: `{ video: metadata[0].videoFileName }`
  - multi: keyed by `video-{service}-{sanitizedModel}`
- `collectVideoTargets(options)` that validates model strings and returns one target per configured provider

---

## Phase 2 — Rewrite `run-video-gen.ts`

Depends on Phase 1.

Replace single-dispatch (`resolveVideoEngine`) with target iteration, mirroring `runMusicTargets`:

- Add `runVideoTargets(targets, prompt, outputDir)`:
  - per-target temp workspaces for multi-target runs
  - per-target error isolation + `failedTargets[]`
  - rename artifacts via `getVideoArtifactFileName(...)`
  - warn on partial failure; throw when zero successes
  - return `{ videoPaths: string[], metadata: Step6VideoMetadata[] }`
- Update `runVideoGen(...)` to call `collectVideoTargets(...)`, validate non-empty, and delegate to `runVideoTargets(...)`
- Remove `resolveVideoEngine` and `assertNever`

---

## Phase 3 — Widen Actual Cost/Timing For `step6`

No dependency on Phases 1-2.

`src/utils/pricing/compute-costs.ts`:

- Widen `ComputeActualCostsInput.step6` to `Step6VideoMetadata | Step6VideoMetadata[] | undefined`
- Replace scalar `if (input.step6)` logic with array iteration, matching the existing `step7` pattern

`src/utils/pricing/compute-processing-time.ts`:

- Widen `ComputeActualProcessingTimesInput.step6` to `Step6VideoMetadata | Step6VideoMetadata[] | undefined`
- Replace scalar `if (input.step6)` logic with array iteration, matching the existing `step7` pattern

---

## Phase 4 — Widen Estimated Video Pricing Paths

No dependency on Phases 1-3.

`src/cli/commands/process-steps/step-6-video/video-utils/video-pricing.ts`:

- Add `estimateVideoCosts(options): VideoCostEstimate[]` that returns one estimate per selected provider
- Keep `estimateVideoCost(...)` for single-provider call sites (service runners), but implement/guard it so multi-provider usage does not leak into estimate aggregation paths

`src/utils/pricing/aggregate-pricing.ts`:

- Replace `buildVideoEstimate(...)` with `buildVideoEstimates(...)` returning `VideoStepEstimate[]`
- Update both `command === 'video'` and `command === 'write'` estimate assembly to append all video estimates

`src/utils/pricing/compute-costs.ts` (estimated side):

- Replace scalar video estimate branch with iteration over `estimateVideoCosts(...)`
- Push one estimated `video` step per provider

This phase prevents preflight and estimated-cost crashes when both video providers are selected.

---

## Phase 5 — Widen Estimated Video Timing Paths

Depends on Phase 4.

`src/utils/pricing/compute-processing-time.ts`:

- Add `videoTargets?: Array<{ service, model, durationSeconds?: number }>` to `ComputeEstimatedProcessingTimesInput`
- Use the same fallback pattern as music:
  - prefer `videoTargets` when provided
  - otherwise fall back to legacy `videoService`/`videoModel`/`videoDurationSeconds`
- Emit one `video` timing step per target

---

## Phase 6 — Update Step Entry Points

Depends on Phases 1-5.

### `src/cli/commands/process-steps/step-6-video/define-video-command.ts`

- Remove only the mutual-exclusion guard (`providerCount > 1`)
- Keep explicit missing-provider usage error behavior via `collectVideoTargets(...)` + `CLIUsageError` before preflight (matching the music command UX)
- Preflight expected output should list per-target video filenames (`getVideoArtifactFileName(...)`) + `metadata.json`
- Update `runVideoGen(...)` consumption to `{ videoPaths, metadata }`
- Update actual cost/timing calls to pass `step6: metadata` array
- Update estimated timing call to pass `videoTargets` derived from selected targets (not a single service/model)
- Write metadata as `{ video: serializeOneOrMany(metadata), cost, timing }`
- Update completion report to:
  - artifacts from `buildVideoArtifactMap(metadata)`
  - per-provider `steps` entries (provider/model, time, cost)

### `src/cli/commands/process-steps/process-video.ts`

- Import video target helpers (`collectVideoTargets`, `buildVideoArtifactMap`)
- Update local `step6Metadata` handling to array semantics
- Update actual cost/timing calls to pass array `step6`
- Update estimated timing call to pass `videoTargets`
- Serialize metadata `step6` with scalar-or-array behavior (`serializeOneOrMany`)
- Expand report step summaries to one video row per successful provider
- Use `buildVideoArtifactMap(step6Metadata)` for artifacts (single key for one success, provider-keyed map for multi)

---

## Relevant Files

| File | Action | Why |
|---|---|---|
| `src/cli/commands/process-steps/step-6-video/video-targets.ts` | CREATE | Provider collection + filename/artifact helpers |
| `src/cli/commands/process-steps/step-6-video/run-video-gen.ts` | REWRITE | Multi-target execution and error isolation |
| `src/cli/commands/process-steps/step-6-video/define-video-command.ts` | UPDATE | CLI flow, preflight output, metadata/report shape |
| `src/cli/commands/process-steps/process-video.ts` | UPDATE | Full pipeline compatibility with new runVideoGen shape |
| `src/cli/commands/process-steps/step-6-video/video-utils/video-pricing.ts` | UPDATE | Multi-provider estimate helper |
| `src/utils/pricing/aggregate-pricing.ts` | UPDATE | Preflight estimate supports multiple video entries |
| `src/utils/pricing/compute-costs.ts` | UPDATE | Actual + estimated video arrays |
| `src/utils/pricing/compute-processing-time.ts` | UPDATE | Actual + estimated video arrays |
| `src/types/process-types.ts` | NO CHANGE | `Step6VideoMetadata` remains single-entry type |

`Step6VideoMetadata` remains unchanged (single generated artifact entry); array semantics stay at caller level.

---

## Verification

1. `bun run typecheck` passes with no new errors.
2. Single-provider `video` command keeps backward-compatible artifacts (`generated-video.mp4`) and scalar `metadata.video`.
3. Multi-provider `video` command writes provider-suffixed artifacts and array `metadata.video`.
4. Partial failure behavior: one provider failure still yields success output for surviving provider, with warning logged.
5. `video --price` with both providers does not throw and shows two video estimate steps.
6. `video` command completion report includes one step per successful provider and correct per-provider cost/time pairing.
7. Full pipeline run (where step 6 executes) supports both providers and writes provider-aware step6 artifacts + metadata.
8. `metadata.cost.actual.steps` and `metadata.timing.actual.steps` include one video entry per successful provider.

---

## Decisions

- No new flags: existing `--gemini-video` and `--minimax-video` are sufficient.
- No parallelism: keep sequential per-target execution, consistent with other multi-target generation steps.
- No batch-file video expansion: out of scope for this change.
- Preserve `Step6VideoMetadata` shape: multi-target behavior is represented as one-or-many metadata entries at the command/pipeline layer.
