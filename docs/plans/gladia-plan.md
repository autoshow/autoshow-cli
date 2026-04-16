# Plan: Add Gladia STT Provider

## Summary

- Expose Gladia as `--gladia-stt`; bare flag expands to `default` (one synthetic model id, since the pre-recorded API has no model selector).
- Implement with raw REST `upload → create → poll` (no `@gladiaio/sdk`), using the same `pollAsyncSttJobUntilComplete` / `withRetry` / `classifyFetchRetry` infrastructure as AssemblyAI. Follow `run-assemblyai-stt.ts` as the primary implementation reference.
- Always send `diarization: true`. Map `--speaker-count N` to `diarization_config.number_of_speakers = N` (`supportsSpeakerCountHint: true`).
- Pricing: Gladia Starter async `$0.61/hr` (61 cents/hr), verified 2026-04-16. No remote cleanup in v1 (no delete endpoint in reference docs).
- Gladia upload responses carry word-level timings in milliseconds, same unit as AssemblyAI — use `buildSegmentsFromWords` from `transcription-utils.ts` when `utterances` is absent.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `GLADIA_API_KEY` | Yes | Auth for all Gladia API requests |
| `GLADIA_BASE_URL` | No | Base URL override (defaults to `https://api.gladia.io`) |
| `AUTOSHOW_STT_POLL_DEADLINE_MS_GLADIA` | No | Override polling deadline (passed as `envSpecificDeadlineKey`) |

## API Endpoints

- **Upload**: `POST /v2/upload` — multipart or binary body; returns `{ audio_url: string }`
- **Create**: `POST /v2/pre-recorded` — body `{ audio_url, diarization: true, diarization_config?: { number_of_speakers: N } }`; returns `{ id: string, result_url: string }`
- **Poll**: `GET /v2/pre-recorded/{id}` — returns `{ id, status: 'queued'|'processing'|'done'|'error', result?: { ... } }`

## Key Utilities to Leverage

These already exist and must be reused rather than reimplemented:

| Utility | Location | Purpose |
|---|---|---|
| `pollAsyncSttJobUntilComplete` | `stt-utils/async-stt-job-runner.ts` | Exponential-backoff poll loop with resume-probe mode |
| `readPersistedAsyncSttRuntime` | `stt-utils/async-stt-job-runner.ts` | Load prior job state for `--resume-missing` |
| `writeAsyncSttProgressMetadata` | `stt-utils/async-stt-job-runner.ts` | Persist `Step2Metadata` + `Step2RuntimeMetadata` after each phase |
| `withRetry` / `classifyFetchRetry` | `~/utils/retries` | Retry upload/create/poll with correct `RetryClass` values |
| `buildSegmentsFromWords` | `stt-utils/transcription-utils.ts` | Convert word-level arrays (ms) into `TranscriptionSegment[]` |
| `resolveTranscriptionOutput` | `stt-utils/transcription-utils.ts` | Reconcile segments vs plain text, apply offset |
| `toTimestamp`, `countTokens`, `formatTranscriptText`, `buildTranscriptionOutputBase` | `stt-utils/transcription-utils.ts` | Standard output helpers |
| `validateData` | `~/utils/validate/validation` | Parse and validate Valibot schemas |
| `readEnv`, `readEnvFallback` | `~/utils/validate/env-utils` | Read `GLADIA_API_KEY` / `GLADIA_BASE_URL` |

## Files to Modify

### CLI/config surface

- **`src/cli/flags/shared-flags.ts`** — add `'gladia-stt'` flag using `buildModelDescription(...)` with `SUPPORTED_GLADIA_STT_MODELS`.
- **`src/cli/commands/process-steps/step-2-stt/define-transcribe-command.ts`** — include `--gladia-stt` in help examples and provider-selection lists used by `stt` and `write`.
- **`src/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags.ts`** — map `gladia-stt` flag to `gladiaStt` option.
- **`src/cli/commands/process-steps/step-1-download/targets/handle-process-target.ts`** — include Gladia in STT-provider detection and `--resume-missing` subset validation.
- **`src/cli/commands/setup-and-utilities/config/config-merge.ts`** — add `gladiaStt` to `STT_PROVIDER_FLAGS`, the `mergeConfigIntoRawFlags` injection block, and the `FLAG_TO_CONFIG_PATH` mapping.
- **`src/cli/argv-normalize.ts`** — add `gladia-stt` to `BARE_FLAG_DEFAULTS` so bare `--gladia-stt` expands to `default`.

### Types and model registry

- **`src/types/process-steps-dir-types.ts`** — add `'gladia'` to `TranscribeEngine` union.
- **`src/types/process-types.ts`** — add Valibot schemas: `GladiaUploadResponseSchema` (`{ audio_url: string }`), `GladiaCreateResponseSchema` (`{ id: string, result_url: string }`), `GladiaStatusResponseSchema` (`{ id, status, result? }` with nested `utterances` and `words` arrays). Export them.
- **`src/types/utils-dir-types.ts`** — export `GladiaSttModel = typeof SUPPORTED_GLADIA_STT_MODELS[number]`.
- **`src/types/cli-types.ts`** — add `gladiaStt: string | undefined` to `RuntimeOptions`.
- **`src/types/config-types.ts`** — add `gladiaStt: string | undefined` to the config shape.
- **`src/cli/commands/setup-and-utilities/models/stt-models.ts`** — export `SUPPORTED_GLADIA_STT_MODELS = ['default'] as const` and `validateGladiaSttModel`.
- **`src/cli/commands/setup-and-utilities/models/stt-config.json`** — add `"gladia"` entry with `type: "api"`, model `"default"`, `costPerHourUSD: 0.61`, `costPerHourCents: 61`, and a representative `msPerSecond` estimate (e.g. `200`).

### Dispatch, splitting, and setup

- **`src/cli/commands/process-steps/step-2-stt/run-transcribe.ts`**:
  - Add `'gladia'` to `TRANSCRIBE_ENGINE_CAPABILITIES` with `{ diarizationByDefault: true, supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false }`.
  - Add `GLADIA_MAX_ATTACHMENT_BYTES = 1000 * 1024 * 1024` (1 GB public limit) and register it in `AUTO_SPLIT_ATTACHMENT_CAP_BYTES`.
  - Add `'gladia'` to `SPLIT_RETRY_ON_TOO_LARGE_ENGINES`.
  - Import `runGladiaStt` and `ensureGladiaSttSetup`; wire into `resolveTranscribeEngine`, `ensureTranscribeTargetSetup`, and `dispatchTranscribe`.
- **`src/cli/commands/process-steps/step-2-stt/stt-targets.ts`** — add Gladia branch in `collectSttTargets()`.
- **`src/cli/commands/process-steps/step-2-stt/stt-batch/stt-run-state.ts`** — no type changes needed; `Step2RuntimeMetadata.stage` reaches `'completed'` only (no cleanup stages in v1).
- **`src/cli/commands/process-steps/process-stt.ts`** — pass source duration into `transcribeTarget` for Gladia (same pattern as AssemblyAI).
- **`src/cli/commands/process-steps/process-video.ts`** — same duration-passing update as `process-stt.ts`.
- **`src/cli/create-cli.ts`** — register `--gladia-stt` in the CLI command builder.
- **`src/cli/commands/setup-and-utilities/setup/run-doctor.ts`** — add `GLADIA_API_KEY` doctor check.
- **`src/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup.ts`** — call `setupGladiaStt()` during setup.

### Price/report/test plumbing

- **`test/test-runner/price-commands.ts`** — add Gladia to the price-matrix generator.
- **`test/test-runner/reports.ts`** — add Gladia to flag-to-service report parsing.
- **`test/test-utils/api-cheap-config.ts`** — add Gladia default model to cheap config.
- **`test/test-cases/validation/model-options.test.ts`** — add invalid-model and bare-flag coverage for `--gladia-stt`.
- **`test/test-cases/validation/command-aliases.test.ts`** — add `--gladia-stt` alias/flag coverage.
- **`test/test-cases/validation/stt-runtime.test.ts`** — add Gladia to target collection and speaker-count behavior checks.

### Docs

- **`docs/commands/step-2-transcribe/transcribe-audio-services.md`** — document `--gladia-stt`, env vars, always-on diarization, `--speaker-count` mapping, 1 GB / 135-min public limits, and the E2E command.
- **`docs/commands/step-2-transcribe/transcribe-audio-tests-services.md`** — add Gladia test instructions.

## New Files

### `src/cli/commands/process-steps/step-2-stt/stt-services/gladia/gladia.ts`

```
setupGladiaStt()   — readEnvFallback('GLADIA_API_KEY'), log success or warn
ensureGladiaSttSetup() — throw if GLADIA_API_KEY is missing
```
Mirror `assemblyai.ts` exactly.

### `src/cli/commands/process-steps/step-2-stt/stt-services/gladia/run-gladia-stt.ts`

Follow `run-assemblyai-stt.ts` as the reference. Key differences from AssemblyAI:

1. **Upload** — `POST /v2/upload` with binary body; validate response with `GladiaUploadResponseSchema`; field is `audio_url` (not `upload_url`).
2. **Create** — `POST /v2/pre-recorded` with `{ audio_url, diarization: true, diarization_config?: { number_of_speakers: N } }`; validate with `GladiaCreateResponseSchema`.
3. **Poll** — `GET /v2/pre-recorded/{id}`; validate with `GladiaStatusResponseSchema`; terminal states: `status === 'done'` (complete), `status === 'error'` (failed).
4. **Segment normalization** — if `result.utterances` present, map to `TranscriptionSegment[]` (times are ms, divide by 1000 + add offset); else fall back to `buildSegmentsFromWords` from word-level data.
5. **Evidence** — emit `words` evidence array with `timingSource: 'native'`; set `hasNativeWordTiming`, `hasConfidence`, `hasSpeakerLabels` capabilities; `timingQuality: 'native_word'` when words present.
6. **Retry classes** — upload/create use `'runtime_http_create_conservative'`; poll uses `'runtime_http_read'`.
7. **Deadline key** — `envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_GLADIA'`.
8. **No cleanup stage** — `runtime.stage` goes `'created' → 'polling' → 'completed'` only.

### `test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/gladia/gladia-models.test.ts`

```typescript
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

Unit-test coverage for:
- Transient upload/create/poll failures trigger retry via `classifyFetchRetry`.
- Non-retryable 4xx request errors surface immediately.
- Persisted `Step2RuntimeMetadata` with `stage: 'polling'` is picked up by `readPersistedAsyncSttRuntime` and skips upload/create.
- Resume-probe mode enforces bounded probe count before throwing.

## No Changes Needed

- `package.json` — no new SDK; use Bun `fetch` + existing repo utilities.
- `model-links.json` / `docs/commands/links/links.md` — Gladia reference links already present.
- `src/cli/commands/setup-and-utilities/models/model-loader.ts` — STT registry schema is already generic; only `stt-config.json` needs a new entry.
- `src/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner.ts` — no changes; reuse as-is.
- `src/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils.ts` — no changes; reuse `buildSegmentsFromWords`, `resolveTranscriptionOutput`, etc.

## Verification

```sh
bun check

bun t test/test-cases/validation/model-options.test.ts \
       test/test-cases/validation/command-aliases.test.ts \
       test/test-cases/validation/stt-runtime.test.ts \
       test/test-cases/validation/gladia-stt-retries.test.ts

# Requires GLADIA_API_KEY
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/gladia/gladia-models.test.ts
```

Manual smoke tests:

```sh
bun as stt input/examples/audio/1-audio.mp3 --gladia-stt --price
bun as stt input/examples/audio/1-audio.mp3 --gladia-stt --speaker-count 2
bun as stt input/examples/audio/1-audio.mp3 --gladia-stt --assemblyai-stt universal-2
```

Confirm: provider directory naming, diarized transcript output, metadata persistence (`transcription.step2.json` includes `runtime.stage: 'completed'`), and prompt-source selection in multi-provider runs.
