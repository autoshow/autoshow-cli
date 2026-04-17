# Report Command + OCR Consensus

## Summary

Add one new top-level command: `bun as report <output-dir>`.

The command accepts either a single run directory or a batch root and auto-detects whether the target is STT or OCR from the persisted run artifacts. Keep the existing STT script working as a thin backward-compatible wrapper, but make `bun as report` the primary supported surface. Extend the report system to OCR runs so multi-provider OCR output can produce a merged consensus artifact plus review/report files in the same spirit as STT.

## Public Interface

**Command signature:** `report [output-dir]`

No `stt`/`ocr` subcommands and no public format flag in v1; the command must infer the report kind from the target directory contents.

**Detection rules (evaluated in order):**

1. If the target itself contains `providers/` and `metadata.json`, treat it as one run.
2. Otherwise, scan immediate child directories for run directories with `providers/` and `metadata.json`; treat the target as a batch root.
3. Classify a run as **STT** if any provider directory contains `transcription.evidence.json`.
4. Classify a run as **OCR** if any provider directory contains `metadata.json` plus `result.json` or at least one of `extraction.txt`, `extraction.json`, `extraction.tsv`, `extraction.hocr`.
5. All discovered runs under one invocation must resolve to the same kind; mixed or unclassifiable targets fail with an actionable error message.

**STT outputs** (unchanged from existing behavior):

- `consensus-transcription.txt`
- `consensus-report.md`
- `consensus-report.json`
- `consensus-review.md`
- batch aggregate `consensus-report.md` at batch root

**OCR outputs** (mirroring that pattern):

- `consensus-extraction.txt`
- `consensus-report.md`
- `consensus-report.json`
- `consensus-review.md`
- batch aggregate `consensus-report.md` at batch root

## Implementation Changes

### 1. CLI Registration

Define `src/cli/commands/setup-and-utilities/report/define-report-command.ts` following the pattern of existing utility commands (e.g., `define-config-command.ts`). Register it by:

- Adding the import and entry to `COMMAND_DEFINITIONS` in `src/cli/create-cli.ts`.
- Adding an entry to `HELP_COMMAND_GROUP_BY_NAME` in the same file under the `'processing'` group alongside `ocr` and `stt`.

The command takes one positional argument (`output-dir`) and no flags in v1. `help report` and `report --help` must work like other top-level commands via the standard `clerc` `defineCommand()` pattern.

### 2. STT Report Refactoring

The STT logic already lives in `src/utils/stt-consensus-report.ts` and is invoked by `src/scripts/generate-stt-consensus-report.ts` via `analyzeAndWriteConsensusReports(targetPath)`. The refactoring is minimal:

- The new CLI command handler calls `analyzeAndWriteConsensusReports(targetPath)` directly — no logic moves.
- `src/scripts/generate-stt-consensus-report.ts` becomes a one-line wrapper that parses `process.argv[2]` and calls the same function.
- The existing `discoverAnalyzableRunDirectories(targetPath)` detection logic informs, but does not replace, the shared detector described in the Detection Rules section above.

### 3. OCR Report Implementation

Add `src/utils/ocr-consensus-report.ts` (mirroring the structure of `src/utils/stt-consensus-report.ts`).

**Provider artifact loading:**

- Read provider identity and timing/cost metadata from the provider-level `metadata.json` (`ExtractionMetadata` type in `src/types/process-types.ts`) and from the run-level `metadata.json`.
- Read canonical OCR content from provider `result.json` (`ExtractionResult` type).
- Fall back to `extraction.json`, then `extraction.txt`/`extraction.tsv`/`extraction.hocr` for older runs where `result.json` is absent.
- Provider directory names follow the pattern produced by `getOcrTargetDirectoryName()` in `src/cli/commands/process-steps/step-2-ocr/ocr-run-state.ts`; known service names are `ocrmypdf`, `paddle-ocr`, `mistral`, and `glm` (not `mistral-ocr`/`glm-ocr`).
- Load incomplete-run state via `readExistingOcrRun()` from `ocr-run-state.ts` to surface missing providers. Allow runs with missing providers as long as at least one provider artifact is analyzable; surface absences in the report rather than failing.

**OCR consensus algorithm:**

- Align providers by `pageNumber` (from `PageResult.pageNumber`).
- Normalize text per page, then split into stable comparison windows using paragraph boundaries first; fall back to sentence/token windows when paragraphs are too large or absent.
- Build provider-agnostic token votes within each page window using relative token position rather than provider order.
- Emit merged page/window consensus text, per-provider variants, similarity scores, and confidence (sourced from `PageResult.confidence` when available).
- Flag review entries when: only one provider contributes a page, agreement is low, vote margin is small, pages are missing from a provider, or provider total page counts (`ExtractionResult.totalPages`) differ.

**OCR report content:**

- `consensus-extraction.txt`: merged best-guess text assembled page by page.
- `consensus-report.md` / `consensus-report.json`: page/window rows, per-provider summary, missing-provider summary, cost/time from `ExtractionMetadata` (`processingTime`, `promptTokens`, `completionTokens`) when available, and aggregate similarity metrics.
- `consensus-review.md`: lists only flagged pages/windows. No image clip or page snapshot artifacts in v1.

**Batch aggregate:**

- Write per-run artifacts inside each run directory.
- Write one aggregate `consensus-report.md` at the batch root summarizing: run name, provider count, pages/windows analyzed, flagged review count, best provider similarity, missing providers, actual cost, and wall time.

## Files Touched

| Action | Path |
|--------|------|
| New | `src/cli/commands/setup-and-utilities/report/define-report-command.ts` |
| New | `src/utils/ocr-consensus-report.ts` |
| Edit | `src/cli/create-cli.ts` (register command + help group) |
| Edit | `src/scripts/generate-stt-consensus-report.ts` (thin wrapper only) |
| Edit | `src/utils/stt-consensus-report.ts` (export `analyzeAndWriteConsensusReports` if not already public) |

No changes to flag files, download steps, or OCR processing steps.

## Test Plan

- CLI validation: `report --help` renders correctly, command appears in the `processing` help group, command normalization handles `report` like other top-level commands.
- STT parity: `bun as report <stt-run>` and `bun src/scripts/generate-stt-consensus-report.ts <stt-run>` produce identical artifacts and batch aggregate behavior.
- OCR single run: two OCR providers with minor disagreements → merged `consensus-extraction.txt` and at least one flagged entry in `consensus-review.md`.
- OCR incomplete run: one provider missing → report generated, missing provider surfaced, no crash.
- OCR batch: batch root with multiple run dirs → per-run artifacts plus one aggregate `consensus-report.md` at root.
- OCR auto-detection failure: mixed STT/OCR directories or no analyzable runs → actionable error, exit non-zero.
- OCR legacy artifact fallback: `result.json` absent, `extraction.txt` present → report generated using fallback content.
- Regression: existing STT consensus tests and OCR resume tests remain green.

## Assumptions and Constraints

- OCR comparison scope is any run that persisted provider artifacts under `providers/`; this includes local (`ocrmypdf`, `paddle-ocr`) and hosted (`mistral`, `glm`) engines, but not article-backend-only runs that never produced provider directories.
- OCR v1 uses `ExtractionResult` (from `result.json`) as its evidence source. A dedicated OCR evidence artifact (analogous to STT's `transcription.evidence.json`) is deferred.
- No new public aliases for `report` in v1.
- The legacy STT script remains supported as a wrapper; docs and examples should point to `bun as report`.
