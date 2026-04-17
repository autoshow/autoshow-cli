# `--resume-missing`: Current State And Remaining Work

_Checked against the repository and generated CLI help on 2026-04-16._

This file replaces the earlier phase-1 proposal. STT resume support is already implemented and shipping. What remains unfinished is the command-agnostic extraction of that logic and any OCR/extract resume support.

## Current User-Facing Behavior

- `--resume-missing` is supported only for `stt` at runtime.
- `handle-process-target.ts` rejects non-STT commands, rejects positional input, and rejects `--price` / `--dry-run` when resume is requested.
- `bun as stt --resume-missing` auto-discovers the newest compatible incomplete STT batch under `./output`.
- Explicit STT provider flags narrow both autodiscovery and the rerun set, and they must be a subset of the original batch providers.
- Resume is limited to batches that originally requested multiple STT providers.
- `stt --help` advertises `--resume-missing`.
- `ocr --help` does not advertise `--resume-missing`.
- `write --help` currently does advertise `--resume-missing` because `writeFlags` include `transcriptionFlags`, but the runtime still rejects `write --resume-missing` because dispatch remains STT-only. That is a current UX mismatch, not a shipped write-resume feature.

## What Has Already Landed

- STT writes resumable metadata into `metadata.json` and batch `info.json` entries:
  - `completionStatus`
  - `requestedProviders`
  - `providerStates`
  - `missingProviders`
  - `errors`
  - `cost`
  - `timing`
- `processStt` already supports resume-style execution via `ProcessSttRunOptions`:
  - reuse an existing `outputDir`
  - keep the original `requestedTargets`
  - rerun only `targetsToRun`
  - reload existing successful provider artifacts before scheduling new work
- `step-2-stt/stt-batch/resume-stt-batch.ts` already handles:
  - batch autodiscovery under `./output`
  - manifest reading and loose validation
  - output directory recovery for older manifest entries
  - source reconstruction from `step1.url`
  - provider-subset validation
  - rerunning only missing providers
  - rewriting `info.json` with refreshed metadata
  - final batch summary logging
- Persisted async-job state is reused during resume. The Soniox path is covered by validation tests.
- Coordinated multi-item multi-provider STT batches already trigger an automatic retryable backfill pass after the initial batch run.
- The underlying STT resume helper supports `retryableOnly`, `ignoreUnresumableEntries`, and `maxPasses`, even though the current CLI path uses the default one-pass resume behavior.

## What Has Not Landed

- There is still no shared `src/cli/commands/process-steps/resume-missing/` module, adapter registry, or generic resume dispatch.
- STT resume logic is still owned by `step-2-stt/stt-batch/resume-stt-batch.ts`.
- The `--resume-missing` flag description is still STT-specific.
- `BatchManifestEntry` outside the STT path is still just `Record<string, unknown>`; there is no shared typed resume manifest layer.
- OCR/extract resume is not implemented.
- `processOcr` does not accept a `resumeRun` or existing-`outputDir` reuse mode analogous to STT resume.
- OCR metadata does not write STT-style resumable fields such as `completionStatus`, `requestedProviders`, `providerStates`, `missingProviders`, or a top-level `source`.
- Direct-document URL download-to-temp logic is still local to `single-target.ts`; there is no shared document-source resolver for resume flows.

## OCR And Document-Processing Reality Check

- The old draft referred to a `document` alias. The current CLI alias for OCR is `extract`.
- The standalone `ocr` command currently rejects multiple OCR engine flags during real execution. Multi-engine selection is allowed only in preflight-style flows such as `--price` / `--dry-run`.
- `processOcr` still has a multi-provider execution branch and writes per-provider outputs under `providers/<service>-<model>/` when called with multiple explicit OCR targets.
- In current OCR flows, partial provider failures are surfaced only as `errors` in root metadata. That is enough for reporting, but not enough for selective resume.
- In batch summaries, non-STT entries with `errors` are treated as partial results, not resumable `incomplete` items.

## Recommended Next Steps

1. Decide the intended scope before changing code again.
   - If resume should remain STT-only, the remaining work is mostly help and flag cleanup.
   - If resume should expand, decide whether the target is `ocr` / `extract`, document-processing inside `write`, or both.
2. If OCR resume is still desired, start by making OCR outputs resumable.
   - add explicit `source` data
   - persist `completionStatus`, `requestedProviders`, `providerStates`, and `missingProviders`
   - preserve enough information to map batch entries back to original inputs and provider artifact directories
3. Extract the direct-document URL temp-download helper from `single-target.ts` into a shared resolver before adding OCR resume.
4. Only after OCR metadata exists, evaluate whether STT resume should be lifted into a shared adapter-based subsystem.
5. Fix the current help/runtime mismatch for `write --resume-missing`.
   - Either stop advertising the flag in `write --help`, or broaden dispatch so the advertised surface matches actual behavior.

## Verification References

- Runtime dispatch and validations:
  - `src/cli/commands/process-steps/step-1-download/targets/handle-process-target.ts`
  - `src/cli/flags/shared-flags.ts`
- STT resume implementation:
  - `src/cli/commands/process-steps/process-stt.ts`
  - `src/cli/commands/process-steps/step-2-stt/stt-batch/resume-stt-batch.ts`
  - `src/cli/commands/process-steps/step-2-stt/stt-batch/stt-batch.ts`
- OCR and document gaps:
  - `src/cli/commands/process-steps/process-ocr.ts`
  - `src/cli/commands/process-steps/step-1-download/targets/single-target.ts`
  - `src/types/cli-types.ts`
- Tests and help verification:
  - `test/test-cases/validation/stt-resume-batch.test.ts`
  - `test/test-cases/validation/model-options.test.ts`
  - `test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-options.test.ts`
  - `bun src/cli/create-cli.ts help stt`
  - `bun src/cli/create-cli.ts help ocr`
  - `bun src/cli/create-cli.ts help write`
