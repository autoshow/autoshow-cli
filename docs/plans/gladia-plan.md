# Plan: Add Gladia STT Provider

## Status

- Checked against the current repo structure on 2026-04-16.
- Gladia is not implemented yet anywhere in `src/` or `test/`.
- Gladia reference material already exists in `docs/links/gladia-links.md`, `docs/commands/links/links.md`, and `src/cli/commands/setup-and-utilities/links/model-links.json`; this document covers the remaining CLI/runtime/test integration work.

## Summary

- Expose Gladia as `--gladia-stt`; bare flag expands to `default` because the current plan treats Gladia pre-recorded STT as a single-model provider.
- Implement with raw REST `upload -> create -> poll` using the existing async STT infrastructure (`pollAsyncSttJobUntilComplete`, `withRetry`, `classifyFetchRetry`) instead of adding `@gladiaio/sdk`.
- Always send `diarization: true`. Map `--speaker-count N` to `diarization_config.number_of_speakers = N`; Gladia should advertise `supportsSpeakerCountHint: true`.
- Prefer `result.utterances` when available. If Gladia returns only word-level timing, feed the words through `buildSegmentsFromWords` from `stt-utils/stt-utils.ts`.
- Re-verify pricing and public size/duration limits from the captured Gladia reference material immediately before implementation lands; the repo does not have a Gladia entry in `stt-config.json` yet.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `GLADIA_API_KEY` | Yes | Auth for all Gladia API requests |
| `GLADIA_BASE_URL` | No | Base URL override (defaults to `https://api.gladia.io`) |
| `AUTOSHOW_STT_POLL_DEADLINE_MS_GLADIA` | No | Override polling deadline for Gladia async jobs |

## API Endpoints

- **Upload**: `POST /v2/upload` -> `{ audio_url: string }`
- **Create**: `POST /v2/pre-recorded` -> `{ id: string, result_url: string }`
- **Poll**: `GET /v2/pre-recorded/{id}` -> `{ id, status: 'queued'|'processing'|'done'|'error', result?: { ... } }`

## Key Utilities to Reuse

| Utility | Location | Purpose |
|---|---|---|
| `pollAsyncSttJobUntilComplete` | `src/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner.ts` | Exponential-backoff poll loop with resume-probe mode |
| `readPersistedAsyncSttRuntime` | `src/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner.ts` | Load prior job state for `--resume-missing` |
| `writeAsyncSttProgressMetadata` | `src/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner.ts` | Persist `Step2Metadata` + `Step2RuntimeMetadata` into `metadata.json` |
| `withRetry` / `classifyFetchRetry` | `src/utils/retries` | Retry upload/create/poll with existing retry classes |
| `buildSegmentsFromWords` | `src/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils.ts` | Convert word-level arrays into `TranscriptionSegment[]` |
| `resolveTranscriptionOutput` | `src/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils.ts` | Reconcile segments vs plain text and apply offsets |
| `toTimestamp`, `countTokens`, `formatTranscriptText`, `buildTranscriptionOutputBase` | `src/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils.ts` | Standard output helpers |
| `validateData` | `src/utils/validate/validation` | Parse and validate Valibot schemas |
| `readEnv`, `readEnvFallback` | `src/utils/validate/env-utils` | Read `GLADIA_API_KEY` / `GLADIA_BASE_URL` |

## Files to Modify

### CLI, flags, and config

- **`src/cli/flags/shared-flags.ts`** — add `'gladia-stt'` to `transcriptionFlags` using `buildModelDescription(...)` with `SUPPORTED_GLADIA_STT_MODELS`.
- **`src/cli/commands/process-steps/step-2-stt/define-stt-command.ts`** — add `stt` help examples for `--gladia-stt`.
- **`src/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags.ts`** — validate `gladia-stt` via `model-options.ts` and map it to `gladiaSttModel`.
- **`src/cli/commands/process-steps/step-1-download/targets/handle-process-target.ts`** — add `gladia-stt` to `STT_PROVIDER_SELECTION_FLAGS` so provider conflict detection and `--resume-missing` subset validation understand it.
- **`src/cli/commands/setup-and-utilities/config/config-merge.ts`** — add `gladia-stt` to `STT_PROVIDER_FLAGS`, inject `defaults.stt.gladiaStt`, and add the `FLAG_TO_CONFIG_PATH` entry.
- **`src/cli/argv-normalize.ts`** — add `--gladia-stt: 'default'` to `BARE_FLAG_DEFAULTS`.
- **No direct `src/cli/create-cli.ts` change is required.** STT provider flags are surfaced through the shared flag sets, not registered one by one in the CLI builder.

### Types and model registry

- **`src/types/process-steps-dir-types.ts`** — add `'gladia'` to `TranscribeEngine`.
- **`src/types/process-types.ts`** — add `gladiaSttModel` to `ProcessingOptionsSchema`, add `'gladia'` to `Step2Metadata['transcriptionService']`, and add Gladia response schemas (`Upload`, `Create`, `Status`) plus nested utterance/word shapes.
- **`src/types/cli-types.ts`** — add `gladiaSttModel: string | undefined` to `RuntimeOptions`.
- **`src/types/config-types.ts`** — add `gladiaStt` to `SttDefaultsSchema`.
- **`src/types/utils-dir-types.ts`** — export `GladiaSttModel = typeof SUPPORTED_GLADIA_STT_MODELS[number]`.
- **`src/cli/commands/setup-and-utilities/models/stt-models.ts`** — add `SUPPORTED_GLADIA_STT_MODELS = ['default'] as const` and `validateGladiaSttModel`.
- **`src/cli/commands/setup-and-utilities/models/stt-config.json`** — add the Gladia pricing/runtime entry.
- **No dedicated `src/cli/commands/setup-and-utilities/models/model-options.ts` edit is required** if it continues to re-export `stt-models.ts`.

### Dispatch, runtime, and setup

- **`src/cli/commands/process-steps/step-2-stt/run-stt.ts`**
  - add `'gladia'` to `STT_ENGINE_CAPABILITIES` with `{ diarizationByDefault: true, supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false }`
  - add `GLADIA_MAX_ATTACHMENT_BYTES` and register it in `AUTO_SPLIT_ATTACHMENT_CAP_BYTES`
  - add `'gladia'` to `SPLIT_RETRY_ON_TOO_LARGE_ENGINES`
  - import `runGladiaStt` and `ensureGladiaSttSetup`
  - wire Gladia into `resolveSttEngine`, `ensureSttTargetSetup`, and `dispatchStt`
- **`src/cli/commands/process-steps/step-2-stt/stt-targets.ts`** — add the Gladia branch in `collectSttTargets()`.
- **`src/cli/commands/process-steps/process-stt.ts`** — continue passing `audioDurationSeconds` into `sttTarget(...)`; Gladia should follow the same async-provider pattern already used by AssemblyAI, Rev, Soniox, and Speechmatics.
- **`src/cli/commands/process-steps/process-video.ts`** — same `audioDurationSeconds` handling as `process-stt.ts`.
- **`src/cli/commands/process-steps/step-2-stt/stt-batch/stt-run-state.ts`** — no schema change is required unless Gladia adds remote cleanup. The repo-wide runtime metadata shape already allows cleanup stages, but Gladia can stop at `'completed'`.
- **`src/cli/commands/setup-and-utilities/setup/run-doctor.ts`** — add a `GLADIA_API_KEY` doctor check.
- **`src/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup.ts`** — call `setupGladiaStt()` alongside the other STT providers.

### Price, reporting, and tests

- **`test/test-runner/price-commands.ts`** — add a `prefix('test/test-cases/e2e/step-2-stt-e2e/stt-services/gladia/', [...])` entry to `PRICE_SELECTION_REGISTRY`.
- **`test/test-runner/reports.ts`** — add `--gladia-stt` to `ARG_SERVICE_FLAGS` and `gladia` to `KNOWN_SERVICE_HINTS`.
- **`test/test-utils/api-cheap-config.ts`** — if Gladia should participate in API-cheap coverage, add it to the `sttSelections` list returned by `buildApiCheapSelections()`.
- **`test/test-cases/validation/model-options.test.ts`** — add invalid-model coverage, bare-flag expansion coverage, and `buildOptsFromFlags()` mapping coverage for `--gladia-stt`.
- **`test/test-cases/validation/command-aliases.test.ts`** — add help-surface coverage for `--gladia-stt`.
- **`test/test-cases/validation/stt-runtime.test.ts`** — add Gladia service/runtime metadata coverage.
- **`test/test-cases/validation/gladia-stt-retries.test.ts`** — add provider-specific retry/resume coverage following the existing pattern used by `assemblyai-stt-retries.test.ts`, `rev-stt-retries.test.ts`, `soniox-stt-retries.test.ts`, and the other async STT providers.
- **`test/test-cases/e2e/step-2-stt-e2e/stt-services/gladia/`** — add a Gladia e2e smoke test.

### Docs

- **`docs/commands/step-2-stt/stt-audio-services.md`** — document `--gladia-stt`, env vars, diarization behavior, `--speaker-count` mapping, current service limits, and the e2e command.
- **`docs/commands/step-2-stt/stt-audio-tests-services.md`** — add Gladia service test instructions.

## New Files

### `src/cli/commands/process-steps/step-2-stt/stt-services/gladia/gladia.ts`

```ts
setupGladiaStt()          // readEnvFallback('GLADIA_API_KEY'), log success or warn
ensureGladiaSttSetup()    // throw if GLADIA_API_KEY is missing
```

Mirror the existing provider setup helpers used by the async STT services.

### `src/cli/commands/process-steps/step-2-stt/stt-services/gladia/run-gladia-stt.ts`

Follow `run-assemblyai-stt.ts` as the closest reference. Main differences:

1. **Upload** — `POST /v2/upload` with binary or multipart body; validate with `GladiaUploadResponseSchema`; response field is `audio_url`.
2. **Create** — `POST /v2/pre-recorded` with `{ audio_url, diarization: true, diarization_config?: { number_of_speakers: N } }`; validate with `GladiaCreateResponseSchema`.
3. **Poll** — `GET /v2/pre-recorded/{id}`; validate with `GladiaStatusResponseSchema`; terminal states are `done` and `error`.
4. **Segments** — map `result.utterances` to `TranscriptionSegment[]`; if utterances are absent, fall back to `buildSegmentsFromWords` using the word-level timing payload.
5. **Evidence** — emit word evidence when available and preserve native timing metadata.
6. **Retry classes** — upload/create should use the conservative create retry class; poll should use the read retry class.
7. **Deadline key** — use `envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_GLADIA'`.
8. **Runtime persistence** — persist `Step2Metadata.runtime` through `writeAsyncSttProgressMetadata`; no separate `transcription.step2.json` artifact is expected.

### `test/test-cases/e2e/step-2-stt-e2e/stt-services/gladia/gladia-models.test.ts`

```ts
import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['default'],
  cliFlag: '--gladia-stt',
  sttService: 'gladia',
  envVarKey: 'GLADIA_API_KEY',
  envVarDescription: 'Gladia transcription',
})
```

### `test/test-cases/validation/gladia-stt-retries.test.ts`

Cover the same async-provider cases that already exist for other services:

- transient upload/create/poll failures retry through `classifyFetchRetry`
- non-retryable 4xx errors surface immediately
- persisted `stage: 'polling'` state resumes through `readPersistedAsyncSttRuntime`
- resume-probe mode stays bounded before failing

## No Changes Needed

- **`package.json`** — no Gladia SDK dependency is required.
- **`src/cli/flags/stt-flags.ts`** — it already spreads `transcriptionFlags`.
- **`src/cli/flags/write-flags.ts`** — it already groups `transcriptionFlags` under `step-2-stt`.
- **`src/cli/commands/setup-and-utilities/models/model-loader.ts`** — the model registry shape is already generic; only `stt-config.json` needs the new Gladia entry.
- **`src/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner.ts`** — reuse as-is.
- **`src/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils.ts`** — reuse `buildSegmentsFromWords`, `resolveTranscriptionOutput`, and the existing formatting helpers.
- **`src/cli/commands/setup-and-utilities/links/model-links.json`**, **`docs/commands/links/links.md`**, and **`docs/links/gladia-links.md`** — Gladia reference links are already present.

## Verification

```sh
bun run check

bun t test/test-cases/validation/model-options.test.ts \
       test/test-cases/validation/command-aliases.test.ts \
       test/test-cases/validation/stt-runtime.test.ts \
       test/test-cases/validation/gladia-stt-retries.test.ts

# Requires GLADIA_API_KEY
bun t test/test-cases/e2e/step-2-stt-e2e/stt-services/gladia/gladia-models.test.ts
```

Manual smoke tests after implementation:

```sh
bun as stt input/examples/audio/1-audio.mp3 --gladia-stt --price
bun as stt input/examples/audio/1-audio.mp3 --gladia-stt --speaker-count 2
```

Confirm: provider directory naming, diarized transcript output, `metadata.json` persistence with `transcriptionService: 'gladia'`, and completed async runtime metadata in the Gladia run output.
