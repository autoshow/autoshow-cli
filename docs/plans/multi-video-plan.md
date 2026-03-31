# Plan: Multi-Service Video Generation

**Goal**: Allow `--gemini-video` and `--minimax-video` to be used together in the same `video` command invocation, matching the multi-provider behavior already present for LLMs, TTS, Images, and Music.

Video is currently the only generation step locked to a single provider. A `providerCount > 1` guard throws a `CLIUsageError` in both `define-video-command.ts` and `run-video-gen.ts`. The fix mirrors the music step's pattern exactly.

---

## Phase 1 — New `video-targets.ts` module

Create `src/cli/commands/process-steps/step-6-video/video-targets.ts` modelled directly on `src/cli/commands/process-steps/step-7-music/music-targets.ts`.

Contents:

- **`VideoGenOptions`** — `Pick<ProcessingOptions, 'geminiVideoModel' | 'minimaxVideoModel' | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'>`
- **`VideoTarget`** — `{ service: VideoProvider, model: string, run: (prompt: string, outputDir: string) => Promise<{ videoPath: string, metadata: Step6VideoMetadata }> }`
- **`sanitizeVideoModelName(model)`** — same `replace(/[/\\:*?"<>|]/g, '-')` regex used by music and image
- **`getVideoArtifactFileName(target, singleTarget)`**
  - single: `generated-video.mp4`
  - multi: `generated-video-{service}-{sanitizedModel}.mp4`
- **`buildVideoArtifactMap(metadata[])`**
  - single: `{ video: metadata[0].videoFileName }`
  - multi: keyed by `video-{service}-{sanitizedModel}`
- **`collectVideoTargets(options)`** — pushes a gemini target if `geminiVideoModel` is present, pushes a minimax target if `minimaxVideoModel` is present; each target's `run` closure delegates to the existing `runGeminiVideoGen` / `runMinimaxVideoGen` service functions, same as `resolveVideoEngine` + dispatch does today

---

## Phase 2 — Rewrite `run-video-gen.ts`

*Depends on Phase 1.*

Replace the `resolveVideoEngine` single-dispatch pattern with:

- **`runVideoTargets(targets, prompt, outputDir)`** — mirrors `runMusicTargets` exactly:
  - Tmp workspace dirs per target when `!singleTarget`
  - Per-target error isolation with `failedTargets[]` accumulator
  - Artifact rename + `getVideoArtifactFileName` on success
  - Logs partial failures with `l.warn`; throws if zero successes
  - Returns `{ videoPaths: string[], metadata: Step6VideoMetadata[] }`
- **`runVideoGen(prompt, outputDir, options)`** — calls `collectVideoTargets`, throws if empty, calls `runVideoTargets`
- Remove `resolveVideoEngine` and the `assertNever` import

---

## Phase 3 — Widen `step6` in pricing utilities

*No dependency on Phases 1–2; can be done in parallel.*

**`src/utils/pricing/compute-costs.ts`** (line ~102):

```ts
// Before
step6?: Step6VideoMetadata | undefined

// After
step6?: Step6VideoMetadata | Step6VideoMetadata[] | undefined
```

Wrap the existing `if (input.step6)` block in the same array-iteration pattern already used for `step7` in that file.

**`src/utils/pricing/compute-processing-time.ts`** (line ~87):

Same type widening and same array-iteration wrapper on the `if (input.step6)` block.

---

## Phase 4 — Update `define-video-command.ts`

*Depends on Phases 1, 2, and 3.*

- **Remove** the `providerCount > 1` guard (and the `providerCount === 0` guard, which moves into `collectVideoTargets` via the empty-array throw in `runVideoGen`)
- **Import** `collectVideoTargets`, `buildVideoArtifactMap`, `getVideoArtifactFileName` from `./video-targets`
- **Add** local `serializeOneOrMany` (same 1-liner as `define-music-command.ts`):
  ```ts
  const serializeOneOrMany = <T,>(items: T[]): T | T[] => items.length === 1 ? items[0] as T : items
  ```
- **Update preflight** `expectedOutput` to list per-target file names (mirror music command)
- **Update** `runVideoGen` call to use the new `{ videoPaths, metadata }` return shape
- **Update** `computeActualCosts({ step6: metadata })` — pass array
- **Update** `computeActualProcessingTimes({ step6: metadata })` — pass array
- **Update** `metadata.json` write: `{ video: serializeOneOrMany(metadata), cost, timing }`
- **Update** `l.report.complete` to use `buildVideoArtifactMap(metadata)` and a per-entry `steps` array (mirror music command)

---

## Relevant Files

| File | Action | Reference |
|---|---|---|
| `src/cli/commands/process-steps/step-6-video/video-targets.ts` | **CREATE** | `step-7-music/music-targets.ts` |
| `src/cli/commands/process-steps/step-6-video/run-video-gen.ts` | **REWRITE** | `step-7-music/run-music-gen.ts` |
| `src/cli/commands/process-steps/step-6-video/define-video-command.ts` | **UPDATE** | `step-7-music/define-music-command.ts` |
| `src/utils/pricing/compute-costs.ts` | **UPDATE** (~line 102) | `step7` array pattern in same file |
| `src/utils/pricing/compute-processing-time.ts` | **UPDATE** (~line 87) | `step7` array pattern in same file |
| `src/types/process-types.ts` | **NO CHANGE** | — |

`Step6VideoMetadata` itself is not changed — same design as `Step7MusicMetadata`: single-entry per item, array lives at the caller level.

---

## Verification

1. **`bun run typecheck`** — zero new type errors
2. **Single-provider** — `autoshow video --gemini-video <model> "prompt"` produces `generated-video.mp4` and `metadata.json` with a scalar `video` key (backward-compatible output)
3. **Multi-provider** — `autoshow video --gemini-video <model> --minimax-video <model> "prompt"` produces two renamed files (`generated-video-gemini-*.mp4`, `generated-video-minimax-*.mp4`) and `metadata.json` with an array `video` key
4. **Partial failure** — one provider fails, the other succeeds; a warning is logged, no crash; the single-success result is written as scalar
5. **Preflight / dry-run** — expected file list shows per-provider names when multiple targets are active
6. **Costs + timing** — `metadata.json` `cost.actual.steps` and `timing.actual.steps` each contain one entry per provider

---

## Decisions

- **No new flags** — existing `--gemini-video` and `--minimax-video` flags already accept model name strings; removing the mutual-exclusion guard is the only flag-level change required
- **No parallelism** — all multi-target steps in the codebase use sequential `for...of` loops with per-target error isolation; video follows the same convention
- **No batch-file video support** — out of scope; that is a separate concern
- **`Step6VideoMetadata` type unchanged** — single-entry-per-item design is consistent with `Step7MusicMetadata`
