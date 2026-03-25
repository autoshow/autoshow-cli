# Multi-Provider TTS Fanout

## Summary

- Allow multiple existing TTS provider flags in one run; do not add new CLI flags.
- Apply this to standalone `tts`, and to `write` only when step 3 produces exactly one summary text.
- Keep the current `write` behavior when multiple LLM providers are selected: log a clear warning and skip step 4 instead of guessing which summary to synthesize. (This is existing behavior in `processVideo.ts`, preserved as-is.)
- Execute selected TTS targets sequentially, mirroring multi-provider LLM behavior.
- Succeed on partial TTS failure if at least one target produces audio; fail only if every selected TTS target fails.

## Public APIs / Interfaces / Types

### `collectTtsTargets` (new)

Introduce a shared target resolver modeled on `collectTargets` in `run-llm.ts`:

```typescript
type TtsTarget = {
  service: TtsProvider
  model: string
  voice?: string
  run: (text: string, outputDir: string, opts: TtsOptions) => Promise<{ audioPath: string, metadata: Step4Metadata }>
}

const collectTtsTargets = (options: TtsOptions): TtsTarget[]
```

- Inspects all TTS provider flags and builds a target array in deterministic order: `kitten`, `elevenlabs`, `minimax`, `groq`, `openai`, `gemini`.
- Used by command validation, preflight expected-output generation, pricing/timing estimation, and runtime execution (single source of truth).
- Returns an empty array when no TTS flags are set; callers apply the Kitten default externally (standalone `tts` adds Kitten, `write` does not).

### `runTts` / orchestrator split

Keep the existing per-provider functions (`runKittenTts`, `runElevenlabsTts`, etc.) unchanged. Replace the current single-dispatch `runTts` with a new orchestrator:

```typescript
const runTtsTargets = async (
  targets: TtsTarget[],
  text: string,
  outputDir: string,
  options: TtsOptions
): Promise<Step4Metadata[]>
```

- Loops over `targets` sequentially, calling each target's `run` function.
- For multi-target runs, creates an isolated temp subdirectory per target (see workspace strategy below).
- Catches errors per target, logs failures, continues remaining targets.
- Returns only successful `Step4Metadata` entries.

### Metadata shape

- Internally, always work with `Step4Metadata[]` (even for single-target runs). This keeps orchestration, pricing, and reporting code uniform.
- In the final serialized metadata JSON, flatten single-element arrays to a plain object for backward compatibility:
  - standalone `tts`: `metadata.tts` is an object for one target, an array for multiple targets
  - `write`: `metadata.step4` follows the same rule
- Preserve backward compatibility for single-target runs:
  - artifact remains `speech.wav`
  - metadata remains a single `Step4Metadata` object
- For multi-target runs, write one final artifact per success using `speech-<service>-<sanitized-model>.wav`.

### CLI flags

- Keep `RuntimeOptions` and CLI flags as-is; the user opts into fanout by passing multiple existing flags such as `--openai-tts ... --gemini-tts ...`.

## Implementation Changes

### What changes vs. what is preserved

Changes:
- Remove mutual-exclusion checks for TTS provider flags from standalone `tts` (`define-tts-command.ts` lines 62-65), `write` (`handle-process-target.ts` lines 179-183), and the TTS runner (`run-tts.ts` lines 91-93).
- Replace single-dispatch `resolveTtsEngine` in `run-tts.ts` with `collectTtsTargets` + `runTtsTargets`.
- Update pricing/timing aggregation and artifact reporting for multi-target.

Preserved as-is (no changes needed):
- Standalone `tts` default behavior: if no explicit TTS provider flag is set, implicitly select Kitten only; if any explicit TTS provider flag is set, do not also add Kitten. (Current fallback in `resolveTtsEngine`; replicated in standalone command's call to `collectTtsTargets`.)
- `write` runtime gating: step 4 runs only when the effective LLM output count is exactly 1; with 0 or >1 outputs, skip TTS. (Already implemented in `processVideo.ts`.)
- Provider-specific voice behavior:
  - `--tts-speaker` applies only to Kitten
  - each provider-specific voice flag applies only to that provider target

### Per-target workspace isolation

Each provider currently hardcodes `speech.wav` as output and some providers write temp chunk files in the same directory. For multi-target runs:

- Create a temp subdirectory per target inside the output directory: `<outputDir>/.tts-tmp-<service>-<model>/`
- Pass this subdirectory as the `outputDir` to the provider's `run` function.
- After the provider completes, promote (move) the final audio file from the temp subdirectory into the main output directory using the multi-target filename (`speech-<service>-<sanitized-model>.wav`).
- Rewrite `audioFileName` in the returned `Step4Metadata` to the promoted filename.
- Clean up the temp subdirectory after promotion (on both success and failure).
- For single-target runs, skip temp subdirectory creation entirely and use the main output directory directly (preserving current behavior).

### Orchestration

- Rework TTS orchestration to use `collectTtsTargets` for target resolution and `runTtsTargets` for execution.
- Mirror `runLLM` failure handling:
  - catch errors per target
  - log `service/model` failure details
  - continue remaining targets
  - return only successful `Step4Metadata` entries

### Pricing and estimation

- Extend pricing/timing aggregation to accept multiple TTS results and produce one `tts` step entry per target in both estimated and actual breakdowns.
- `--price` (dry-run) output for multi-target: show a per-target cost/time estimate line, then a total line summing all targets.
- `write --price` with multiple LLM providers plus TTS flags: show LLM estimates but omit TTS estimates entirely (since TTS would be skipped at runtime). Include a note explaining TTS is omitted because multiple LLM providers are selected.

### Reporting and consumers

- Update final artifact reporting to list one speech artifact per successful target and one TTS step summary per successful target.
- Update test-runner/report readers that currently assume a singular `tts`/`step4` entry so they accept arrays the same way they already handle multi-step `step3`.

## Test Plan

- Add standalone `tts` success coverage for two providers in one run and verify:
  - both audio files exist with `speech-<service>-<sanitized-model>.wav`
  - `metadata.tts` is an array with both entries in deterministic order
  - cost/timing sections contain two `tts` step entries
- Replace current standalone mutual-exclusion tests with multi-provider acceptance tests; keep invalid-model validation tests per provider.
- Add standalone `tts --price` coverage for multiple providers and verify:
  - per-target estimate lines are shown
  - summed total matches individual estimates
- Add `write` coverage with one LLM provider plus two TTS providers and verify:
  - summary output is still singular
  - two speech artifacts are produced
  - `metadata.step4` is an array
- Add `write` coverage with multiple LLM providers plus TTS flags and verify:
  - step 4 is skipped
  - no speech artifacts are emitted
  - warning text explains that multi-TTS only runs when there is exactly one summary
- Add `write --price` coverage with multiple LLM providers plus TTS flags and verify:
  - LLM estimates are shown
  - TTS estimates are omitted
  - a note explains TTS is skipped due to multiple LLM providers
- Add partial-failure coverage: one selected TTS target fails, another succeeds, command exits successfully and metadata includes only the success.
- Add all-fail coverage: all selected TTS targets fail and the command exits non-zero.

## Assumptions / Defaults

- No concurrency is added; fanout remains sequential for predictability and parity with current multi-provider LLM behavior.
- Single-target compatibility is preserved exactly; only multi-target runs change filenames and metadata shape.
- Multi-target filename sanitization uses the same invalid-character replacement rule as multi-LLM outputs and always prefixes with service to avoid cross-provider collisions.
- Estimated cost/timing reflects requested targets that runtime would attempt; actual cost/timing reflects successful outputs only.
- Deterministic target ordering is defined by `collectTtsTargets`, not inherited implicitly from if-statement chains.
- Internal code always works with `Step4Metadata[]`; the single-object flattening happens only at serialization time.
