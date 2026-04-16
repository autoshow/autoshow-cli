# Extract `--resume-missing` Into Shared Resume Infrastructure (Phase 1: `ocr` / `document`)

## Summary

Build a command-agnostic resume subsystem so `--resume-missing` works for both `stt` and `ocr`/`document`. The current STT-specific resume logic in `resume-stt-batch.ts` becomes one adapter behind a shared dispatch layer. The first new consumer is `ocr` (and its `document` alias). STT behavior stays compatible; pre-refactor OCR batches do not need backward-compatible resume support because they never emitted resumable state.

## Current State

Resume is fully STT-specific today:
- **Flag**: hard-coded STT description in `shared-flags.ts:151-154`
- **Guard**: `handle-process-target.ts:298-301` rejects non-STT commands
- **Dispatch**: `handle-process-target.ts:312-326` calls `resolveResumeSttBatchDir` and `resumeSttMissingFromBatchDir` directly
- **Core logic**: `resume-stt-batch.ts` owns manifest parsing, batch autodiscovery, entry resolution, multi-pass retry, and summary reporting
- **Metadata**: STT batches emit `providerStates`, `completionStatus`, `missingProviders`, and `requestedProviders` into `info.json` entries; OCR batches do not emit any of these fields today

## Implementation Steps

### 1. Emit resumable metadata from document batches

**Why first**: Nothing else works until OCR batches produce the state that resume needs to read.

- After multi-provider `processDocument` runs (`process-document.ts:128-201`), persist per-item resume metadata into the batch `info.json` entry using the same field names STT uses: `completionStatus`, `requestedProviders`, `providerStates`, `missingProviders`.
- Map `ExtractTarget` (`{ service, model }`) into `providerStates` entries with `service`, `model`, `artifactDir`, `status` (`succeeded` | `failed`), `attempts: 1`, and optional `lastError`.
- Mark the entry `completionStatus: 'incomplete'` when `failures.length > 0 && successes.length > 0`, `'failed'` when `successes.length === 0`, `'full'` otherwise.
- Add an explicit `source` object (`{ filePath?, url? }`) so resume can reconstruct the input without depending on `step1` fields. For local files use the original path; for direct-document URLs use the pre-download URL.
- Single-provider OCR runs (only one explicit target) should still write `completionStatus: 'full'` but skip `providerStates` — there is nothing to resume with one provider.

### 2. Extract the direct-document URL temp download helper

- The temp download path in `single-target.ts` that fetches a document URL into a temp file before calling `processDocument` should be extracted into a shared helper (e.g., `step-1-download/document/resolve-document-source.ts`).
- Both normal execution and resume need this path so they don't duplicate the "is this a URL? download it first" logic.

### 3. Make `processDocument` accept resume-mode options

Add an optional `resumeRun` parameter to `processDocument`:

```typescript
resumeRun?: {
  outputDir: string           // reuse existing output directory
  requestedTargets: ExtractTarget[]  // original full set
  targetsToRun: ExtractTarget[]      // subset to rerun now
}
```

When `resumeRun` is set:
- Skip `downloadDocument` / directory creation — `outputDir` already exists.
- Load existing successful provider outputs from `providers/` so they are not re-run.
- Run only `targetsToRun` providers.
- Keep existing provider artifacts intact (do not delete `providers/<succeeded>/`).
- Rewrite the root `extraction.txt` and `metadata.json` from the first successful target in `requestedTargets` order (not `targetsToRun` order), so the primary output reflects the user's original priority.

### 4. Create shared resume module

Create `src/cli/commands/process-steps/resume-missing/` with:

| File | Responsibility |
|---|---|
| `resume-registry.ts` | Maps canonical command names to adapter modules; `getResumeAdapter(command)` returns the adapter or `undefined` for unsupported commands |
| `resume-manifest.ts` | Reads and validates `info.json`; normalizes both legacy STT metadata and the new shared format into a common `ResumeManifestEntry` |
| `resume-discover.ts` | Scans `./output` for the newest batch directory whose `info.json` has at least one entry with `completionStatus !== 'full'` that matches the requested command |
| `resume-dispatch.ts` | Validates shared preconditions (no positional input, no `--price`/`--dry-run`, skip budget preflight), resolves the batch directory (explicit or autodiscovered), and delegates to the adapter |

**Shared `ResumeManifestEntry` shape:**

```typescript
type ResumeManifestEntry = {
  outputDir: string
  source: { url?: string, filePath?: string }
  requestedProviders: Array<{ service: string, model: string }>
  providerStates: Array<{
    service: string
    model: string
    artifactDir: string
    status: 'succeeded' | 'missing' | 'failed' | 'skipped'
    attempts: number
    retryable?: boolean
    lastError?: { message: string, retryable: boolean }
  }>
  missingProviders: Array<{ service: string, model: string }>
  completionStatus: 'full' | 'incomplete' | 'failed'
  raw: Record<string, unknown>  // original info.json entry for adapter-specific fields
}
```

### 5. Rework STT resume into an adapter

- Move the core of `resume-stt-batch.ts` behind an adapter interface.
- The adapter provides: `parseEntry(raw, batchDir)`, `runResume(entries, opts)`, and `formatSummary(results)`.
- STT's multi-pass backfill, retryable async-job probing, `SttBatchCoordinator`, and final summary stay inside the STT adapter — they are STT-specific concerns.
- The shared manifest reader calls `toSourceFromStep1` for legacy STT entries (no top-level `source` field) and uses the top-level `source` for new-format entries.

### 6. Add OCR resume adapter

- Uses `collectExplicitExtractTargets` for provider subset selection (same as normal OCR flag parsing).
- Validates that the user's provider flags are a subset of the original batch's `requestedProviders`.
- Only treats batches with more than one explicit OCR provider as resumable (single-provider runs have nothing to selectively resume).
- Calls `processDocument` with the `resumeRun` parameter for each incomplete entry.
- Single-pass only in phase 1 (no multi-pass retry loop like STT has for async jobs).

### 7. Update the dispatch in `handle-process-target.ts`

Replace the STT-specific block at lines 298-327:

```typescript
if (resumeMissingRequested) {
  const adapter = getResumeAdapter(command)
  if (!adapter) {
    throw CLIUsageError(`--resume-missing is not supported with "${displayCommand}".`)
  }
  // shared validations (no positional input, no --price, etc.)
  await resumeDispatch(adapter, command, opts, explicitFlags)
  return
}
```

### 8. Update flag description and help text

- Change `--resume-missing` description from `'STT: reuse an existing batch...'` to a generic description: `'Reuse an existing batch directory and rerun only missing provider outputs; omit the path to auto-pick the newest resumable batch under ./output'`.
- Update help output so `ocr` and `document` show `--resume-missing` in their flag list.
- Ensure unsupported commands (`write`, `download`, `metadata`, `tts`, etc.) do not advertise the flag.

## Test Plan

### Shared resume infrastructure
- Batch autodiscovery finds the newest directory with incomplete entries
- Manifest parser normalizes legacy STT entries (no top-level `source`, `requestedProviders` inferred from `providerStates`)
- Manifest parser normalizes new-format entries
- Provider subset validation rejects supersets of original providers
- Unsupported commands get a clear usage error

### STT (regression)
- Explicit batch-dir resume works unchanged
- Bare `--resume-missing` autodiscovery works unchanged
- Subset-provider resume works unchanged
- Multi-pass retry still runs for async jobs
- Existing usage-error cases still throw

### OCR / document
- `ocr --resume-missing <batch-dir>` reruns only failed providers
- Bare `ocr --resume-missing` autodiscovers the newest incomplete OCR batch
- Subset-provider resume (e.g., `ocr --resume-missing --mistral-ocr pixtral --paddle-ocr` when original had all three)
- Local-file batches resume correctly (source path still valid)
- Direct-document-URL batches resume correctly (re-downloads to temp)
- Successful provider artifacts are preserved (not deleted or overwritten)
- Root `extraction.txt` reflects the first successful target in original request order after resume

### Negative cases
- Positional input with `--resume-missing` throws
- `--price` / `--dry-run` with `--resume-missing` throws
- `write --resume-missing` throws (unsupported command)
- Provider flags that are not a subset of the original batch providers throw
- Single-provider OCR batches are not treated as resumable

### Flag / help tests
- `ocr --help` shows `--resume-missing`
- `stt --help` still shows `--resume-missing`
- `write --help` does not show `--resume-missing`

## Assumptions
- `document` means the existing `ocr` alias, not `write <document>`. The shared primitives should still be shaped so `write` can adopt them later.
- `--resume-missing` keeps current STT semantics: batch-directory based, omitted path means autodiscover under `./output`, provider flags must be a subset of the original.
- Existing STT batch outputs must remain resumable. Pre-refactor OCR batches do not need backward-compatible resume support because they never emitted resumable state.
- STT retry/backfill behavior stays behaviorally unchanged even though its call path moves behind the adapter boundary.

## Suggested Implementation Order

1. **Step 1** (emit metadata) — unblocks everything else, zero risk to existing behavior
2. **Step 2** (extract URL helper) — small standalone refactor
3. **Step 3** (processDocument resume mode) — can be developed and tested in isolation
4. **Step 4** (shared module) — the new abstraction layer
5. **Step 5** (STT adapter) — refactor existing code behind the adapter interface
6. **Step 6** (OCR adapter) — first new consumer
7. **Step 7** (dispatch update) — wire it all together
8. **Step 8** (flags/help) — cosmetic, do last
