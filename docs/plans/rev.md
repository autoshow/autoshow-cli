# Add Rev Async STT Provider

Add Rev as a hosted STT provider keyed as `rev`, exposed as `--rev-stt`, backed by Rev AI's async REST API. Use `multipart/form-data` upload (not `source_config` URL submission) since audio files are already downloaded locally. The single supported model string is `machine` (Rev's default Reverb ASR model). Diarization is always on (Rev enables it by default). `--speaker-count` is ignored like Deepgram/Soniox/Speechmatics. Known-speaker references are rejected through the existing non-OpenAI path. Use raw `fetch` (no SDK). Do not invent pricing — Rev bills per-second with a 15-second minimum but the exact per-second rate is not published in `docs/links/rev-links.md`, so leave `costPerHour*` unset.

## API Details

**Base URL:** `https://api.rev.ai/speechtotext/v1`
**Auth:** `Authorization: Bearer <REVAI_ACCESS_TOKEN>`
**Env var:** `REVAI_ACCESS_TOKEN` (with optional `REVAI_BASE_URL` override for non-US deployments)

### Submit Job (multipart/form-data)
- `POST /jobs` with `Content-Type: multipart/form-data`
- Form fields: `media` (audio file), `options` (JSON string with `transcriber: "machine"`, `remove_disfluencies: true`)
- 2 GB file size limit, concurrency limit of 5 per user
- Response: `{ id, status: "in_progress", ... }`

### Poll Job Status
- `GET /jobs/{id}`
- Terminal states: `status === "transcribed"` (success), `status === "failed"` (terminal failure with `failure` and `failure_detail` fields)

### Fetch Transcript
- `GET /jobs/{id}/transcript` with `Accept: application/vnd.rev.transcript.v1.0+json`
- Response: `{ monologues: [{ speaker: number, elements: [{ type: "text"|"punct", value, ts?, end_ts?, confidence? }] }] }`

### Delete Job
- `DELETE /jobs/{id}` — only works after job reaches terminal state

### Retryable HTTP Errors
Per Rev docs: 409, 429, 502, 503, 504. Max 5 retries except 429 (can retry more). 413 is terminal (payload too large).

## Files to Modify

### Types
- `src/types/process-steps-dir-types.ts`: Add `'rev'` to `TranscribeEngine` union.
- `src/types/process-types.ts`: Add `'rev'` to `Step2Metadata.transcriptionService` if it's a string literal union (or it may already accept any string from the registry).
- `src/types/cli-types.ts`: Add `revSttModel` to `ProcessingOptions`.
- `src/types/config-types.ts`: Add `revStt` to config defaults type.
- `src/types/utils-dir-types.ts`: Add Rev to any STT service mapping types if present.

### CLI Flags & Config
- `src/cli/flags/shared-flags.ts`: Add `--rev-stt <model>` flag with bare default `machine`.
- `src/cli/argv-normalize.ts`: Add `--rev-stt` bare-flag expansion.
- `src/cli/commands/config/config-merge.ts`: Add `defaults.stt.revStt` config key.
- `src/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags.ts`: Map `revStt` flag to `revSttModel` in runtime options.
- `src/cli/commands/process-steps/step-1-download/targets/handle-process-target.ts`: Add Rev to STT provider allowlist / explicit-selection list.

### Model Registry & Pricing
- `src/cli/commands/models/stt-config.json`: Add `rev` entry with `type: "api"`, single model `machine`, description only, no `costPerHour*` values.
- `src/cli/commands/models/stt-models.ts`: Register service `rev` if manual registration is needed beyond `stt-config.json`.
- `src/utils/pricing/compute-costs.ts`: Map `revSttModel` into estimated-cost logic (will use generic API defaults since no curated pricing).

### STT Pipeline
- `src/cli/commands/process-steps/step-2-stt/stt-targets.ts`: Add Rev target collection with `diarizationOptions` from `resolveDiarizationOptions(options, 'rev')`.
- `src/cli/commands/process-steps/step-2-stt/run-transcribe.ts`: Add `rev` to `TRANSCRIBE_ENGINE_CAPABILITIES` with `{ diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false }`. Add `rev` case to `dispatchTranscribe`. Add Rev as a cloud engine (not local).
- `src/cli/commands/process-steps/process-stt.ts`: Audit any manual STT service lists to include `rev`.
- `src/cli/commands/process-steps/step-2-stt/define-transcribe-command.ts`: Add `--rev-stt` to help text and examples.
- `src/cli/commands/process-steps/step-2-stt/resume-stt-batch.ts`: Add Rev to any provider-specific resume logic if present.

### Setup & Doctor
- `src/cli/commands/process-steps/step-0-setup/run-doctor.ts`: Add `checkEnvVar('REVAI_ACCESS_TOKEN', 'REVAI_ACCESS_TOKEN')`.
- `src/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup.ts`: Add `setupRevStt()` call.
- `src/cli/create-cli.ts`: Wire up Rev setup if providers are registered there.

### Docs
- `docs/commands/step-2-transcribe/transcribe-audio-services.md`: Add Rev section.
- `docs/commands/step-2-transcribe/transcribe-audio-tests-services.md`: Add Rev test docs.
- `docs/tests/service-tests-transcribe.md`: Add Rev entry.
- `docs/commands/config/config.md`: Add `revStt` config key docs.

### Tests
- `test/test-runner/reports.ts`: Add Rev report mapping.
- `test/test-runner/price-commands.ts`: Add Rev price-runner entry.
- `test/test-cases/validation/model-options.test.ts`: Add Rev model validation.
- `test/test-cases/validation/transcribe-routing.test.ts`: Add Rev routing, bare-flag, `buildOptsFromFlags` mapping, `collectSttTargets`, and `--speaker-count` ignored assertions.
- `test/test-cases/validation/command-aliases.test.ts`: Add Rev if alias tests exist for other providers.
- `test/test-cases/validation/compute-costs.test.ts`: Add Rev cost mapping test.
- `test/test-cases/validation/links-command.test.ts`: Verify Rev links are already covered.

## New Files

### `src/cli/commands/process-steps/step-2-stt/stt-services/rev/rev.ts`
- `setupRevStt()`: Read `REVAI_ACCESS_TOKEN` via `readEnvFallback`, log success/warn.
- `ensureRevSttSetup()`: Throw if `REVAI_ACCESS_TOKEN` is missing.

### `src/cli/commands/process-steps/step-2-stt/stt-services/rev/run-rev-stt.ts`
Follow the Speechmatics pattern (closest match — inline upload, no separate asset):

1. **Resume check**: Read persisted runtime metadata via `readPersistedAsyncSttRuntime(outputDir, { transcriptionService: 'rev', transcriptionModel })`. If stage is `created` or `polling`, resume with existing `remoteJobId`.
2. **Job creation**: `POST /jobs` as `multipart/form-data` with the local audio file and `options` JSON (`{ transcriber: "machine", remove_disfluencies: true }`). Use `withRetry` with `retryClass: 'runtime_http_create_conservative'`, max 4 attempts. Persist runtime metadata with `stage: 'polling'` and call `lifecycle.onJobReady()`.
3. **Polling**: Use `pollAsyncSttJobUntilComplete` with `initialPollIntervalMs: 2000`, `maxPollIntervalMs: 10000`, `envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_REV'`. Poll `GET /jobs/{id}`, check `isComplete: status === 'transcribed'`, `isFailed: status === 'failed'` (extract `failure` + `failure_detail`).
4. **Transcript fetch**: `GET /jobs/{id}/transcript` with `Accept: application/vnd.rev.transcript.v1.0+json`. Use `withRetry` with `retryClass: 'runtime_http_read'`.
5. **Normalization**: Iterate `monologues[]`, for each monologue extract `speaker` (numeric), iterate `elements[]`: accumulate `text` type tokens (use `ts` for segment start, `end_ts` for segment end), append `punct` type tokens inline (spaces and punctuation). Flush segment on speaker change or end-of-monologue. Use `buildSegmentsFromWords` or manual accumulation matching the Speechmatics `appendToken` pattern.
6. **Cleanup**: In `finally` block, `DELETE /jobs/{id}` after terminal state. Record `runtime.cleanup.remoteJobDeleted`.
7. **Return**: `{ result: { text, segments }, metadata: Step2Metadata }` with full timing breakdown.

**Error type**: `RevHttpError = Error & { status, headers, stage, retryClass, rawResponse? }` following the Speechmatics pattern.

### `test/test-cases/validation/rev-stt-retries.test.ts`
- Transient create retries (429, 502, 503)
- Transient poll retries
- Resume-from-metadata behavior (persisted `remoteJobId` with `stage: 'polling'`)
- Transcript normalization: multi-speaker monologues, punctuation handling, empty elements
- Cleanup metadata recording
- Failed job terminal handling (`status: 'failed'`, `failure: 'download_failure'`)

### `test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/rev/rev-machine.test.ts`
Standard hosted-provider smoke/price suite:
```ts
defineSTTServiceTest({
  models: ['machine'],
  cliFlag: '--rev-stt',
  sttService: 'rev',
  envVarKey: 'REVAI_ACCESS_TOKEN'
})
```

## No Changes Needed
- `src/cli/commands/links/model-links.json`, `docs/links/rev-links.md`, link-fetcher, and `docs/commands/links/links.md` — Rev curated docs already exist.
- `package.json` — use existing `fetch` + Valibot pattern, no SDK needed.
- `src/cli/commands/models/model-loader.ts`, `src/types/models-dir-types.ts`, `src/utils/pricing/compute-processing-time.ts`, `src/utils/pricing/aggregate-pricing.ts` — already registry-driven, work automatically once `rev` exists in `stt-config.json`.
- `test/test-utils/api-cheap-config.ts` — no Rev pricing data available, skip cheapest-provider helper.
- `.env.example` — does not exist in this repo.

## Implementation Notes

### Why multipart/form-data instead of source_config URL?
Audio files are already downloaded locally by step 1. Using `multipart/form-data` avoids needing to host or expose the file via a public URL. The 2 GB limit is acceptable — files exceeding this would already be auto-split by the existing segment pipeline.

### Why `remove_disfluencies: true`?
Rev supports filtering "ums" and "uhs". Enabling this by default produces cleaner transcripts consistent with the quality expectations of other providers in the pipeline.

### Why `initialPollIntervalMs: 2000` (not 1000)?
Rev docs say "your transcript will be ready in 5 minutes or less" for shorter files and "no longer than 15 minutes" for longer ones. Starting at 2s reduces unnecessary poll requests compared to Speechmatics's 1s start, while still being responsive for quick jobs.

### Transcript normalization detail
Rev's `monologues[].elements[]` format has `type: "punct"` for both actual punctuation (`,`, `.`) and whitespace (` `). The normalizer must not treat whitespace punctuation as sentence boundaries — only flush segments on speaker change (new monologue) or actual sentence-ending punctuation followed by end-of-monologue.

## Verification
- `bun check`
- `bun t test/test-cases/validation/model-options.test.ts test/test-cases/validation/transcribe-routing.test.ts test/test-cases/validation/rev-stt-retries.test.ts`
- `bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/rev/`

## Acceptance Criteria
- `bun as stt file.mp3 --rev-stt` resolves to `rev/machine`
- Rev outputs live under `providers/rev-machine/` in multi-provider runs
- Diarization is always on (Rev default, no extra parameter needed)
- `--speaker-count` yields the shared ignored-provider warning and does not change the Rev request
- Metadata stores `transcriptionService: 'rev'` and resumable `runtime.remoteJobId`
- Successful terminal runs record `runtime.cleanup.remoteJobDeleted: true`
- Remote job is deleted via `DELETE /jobs/{id}` after both success and failure
