# Add Deepgram STT (`nova-3`, diarization-on)

## Summary

Add Deepgram as a hosted STT provider using raw `fetch` against `POST /v1/listen` with binary audio upload. Ship with `nova-3` as the only supported model, diarization always on (`diarize=true`, `utterances=true`, `punctuate=true`, `smart_format=true`). Normalize Deepgram's utterance-based diarization output to the existing `[speaker-N] HH:MM:SS` transcript format.

## API Details

- **Endpoint**: `POST {DEEPGRAM_BASE_URL}/v1/listen` (default `https://api.deepgram.com`)
- **Auth header**: `Authorization: Token <DEEPGRAM_API_KEY>` (not `Bearer`)
- **Content-Type**: binary upload — detect MIME from file extension (e.g. `audio/wav`, `audio/mpeg`, `audio/mp4`)
- **Query params**: `model=nova-3&diarize=true&utterances=true&punctuate=true&smart_format=true`
- **Response**: synchronous JSON — `{ metadata, results: { channels, utterances? } }` (no polling needed, unlike AssemblyAI)
- **Utterance shape**: `{ start: number, end: number, transcript: string, speaker: number, words: [...] }`
- **Speaker field**: integer starting at 0, map to `speaker-0`, `speaker-1`, etc. via existing `formatSpeaker` pattern

## Diarization & Flag Behavior

- Diarization is always on (baked into query params), no opt-out needed.
- `--speaker-count`: warn and ignore (Deepgram pre-recorded has no `speakers_expected` param). Follow the Mistral pattern in `resolveDiarizationOptions` — warn but still return a diarization options object so processing continues.
- `--speaker-name` / `--speaker-reference`: remain OpenAI-only. The `supportsKnownSpeakerReferences` capability stays `false`.
- `TRANSCRIBE_ENGINE_CAPABILITIES` entry: `{ supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false }`.

## Pricing

PAYG Nova-3 pre-recorded: `$0.0077/min` base + `$0.0020/min` diarization = `$0.0097/min` = `$0.582/hour`.

```json
"deepgram": {
  "description": "Deepgram cloud speech-to-text",
  "type": "api",
  "models": {
    "nova-3": {
      "description": "Nova-3 — diarization-inclusive pre-recorded transcription",
      "costPerHourUSD": 0.582,
      "costPerHourCents": 58.2,
      "estimation": {
        "costMultiplier": 1.0,
        "msPerSecond": 200
      }
    }
  }
}
```

> **Note**: `estimation.msPerSecond` is a placeholder — calibrate from actual runs before merging.

## Phase 1 — Types & Model Registry

### Types

- `src/types/process-steps-dir-types.ts`: add `'deepgram'` to `TranscribeEngine` union.
- `src/types/process-types.ts`: add `'deepgram'` to `Step2Metadata['transcriptionService']` union; add `deepgramSttModel: v.optional(v.string(), undefined)` to `ProcessingOptionsSchema`.
- `src/types/cli-types.ts`: add `deepgramSttModel` field to `RuntimeOptions`.
- `src/types/utils-dir-types.ts`: export `DeepgramSttModel` type alias from `SUPPORTED_DEEPGRAM_STT_MODELS`.

### Valibot Response Schema

- `src/types/process-steps-dir-types.ts` (or co-located types file): add `DeepgramResponseSchema` for response validation. Model only the fields we use:
  - `results.utterances[]`: `{ start, end, transcript, speaker, words[] }`
  - `results.channels[].alternatives[].transcript` (fallback plain text)

### Model Registry

- `src/cli/commands/models/stt-models.ts`: add `SUPPORTED_DEEPGRAM_STT_MODELS = ['nova-3'] as const`, create `validateDeepgramSttModel` via `createModelValidator`.
- `src/cli/commands/models/stt-config.json`: add `deepgram` entry (see Pricing section above).

## Phase 2 — CLI Flags & Config

### Flag Definition

- `src/cli/flags/shared-flags.ts`: add `'deepgram-stt'` to `transcriptionFlags` with the same shape as `'assemblyai-stt'`.

### Bare-Flag Default

- `src/cli/argv-normalize.ts`: add `'--deepgram-stt': 'nova-3'` to `BARE_FLAG_DEFAULTS`.

### Config Merge

- `src/cli/commands/config/config-merge.ts`: add `'deepgram-stt'` to `STT_PROVIDER_FLAGS` array; add `['deepgram-stt', d.stt.deepgramStt]` entry to `injectProviderGroup` call.
- `src/types/config-types.ts`: add `deepgramStt?: string` to the config STT defaults type.

### Flag-to-Options Mapping

- `src/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags.ts`: add `const deepgramSttModel = readValidated('deepgram-stt', validateDeepgramSttModel)` and include in the returned options object.

### Command Definition

- `src/cli/commands/process-steps/step-2-stt/define-transcribe-command.ts`: include `--deepgram-stt` in help text and examples.

## Phase 3 — Provider Implementation

### Setup File (new)

- `src/cli/commands/process-steps/step-2-stt/stt-services/deepgram/deepgram.ts`
  - `setupDeepgramStt()`: check `DEEPGRAM_API_KEY`, log success/warn.
  - `ensureDeepgramSttSetup()`: throw if `DEEPGRAM_API_KEY` missing.
  - Follow the pattern in `assemblyai.ts` / `openai.ts`.

### Runner File (new)

- `src/cli/commands/process-steps/step-2-stt/stt-services/deepgram/run-deepgram-stt.ts`
  - Signature matches existing runners: `(audioPath, outputDir, options) => Promise<{ result, metadata }>`.
  - Read audio as `Bun.file(audioPath).arrayBuffer()`, POST to `/v1/listen` with query params.
  - Use `withRetry` + `classifyFetchRetry` from `~/utils/retries` (follow AssemblyAI/Mistral pattern).
  - Validate response with `validateData(DeepgramResponseSchema, ...)`.
  - **Primary path**: iterate `results.utterances[]`, map each to `TranscriptionSegment` with `speaker: speaker-${utterance.speaker}`, timestamps in seconds (Deepgram returns seconds, not ms like AssemblyAI).
  - **Fallback path**: if no utterances, use `results.channels[0].alternatives[0].words[]` via `buildSegmentsFromWords`.
  - **Last resort**: use `results.channels[0].alternatives[0].transcript` as plain text.
  - Write `transcription.txt` via `formatTranscriptText`, return `TranscriptionResult` + `Step2Metadata`.

## Phase 4 — Dispatcher & Target Integration

### Dispatcher (`src/cli/commands/process-steps/step-2-stt/run-transcribe.ts`)

- Import `runDeepgramTranscribe` and `ensureDeepgramSttSetup`.
- Add `deepgram` entry to `TRANSCRIBE_ENGINE_CAPABILITIES`.
- Add `hasDeepgram` check in `resolveTranscribeEngine()` and include in `engineCount` mutual-exclusion validation + error message.
- Add `ensureDeepgramSttSetup()` branch in `ensureTranscribeTargetSetup()`.
- Add `dispatchTranscribe` branch for `target.service === 'deepgram'` (before `assertNever`).
- Add `'deepgram'` to `SPLIT_RETRY_ON_TOO_LARGE_ENGINES` set (no file-size cap, but handles 413 gracefully if it occurs).
- Do NOT add to `AUTO_SPLIT_ATTACHMENT_CAP_BYTES` (Deepgram has no documented file size limit for pre-recorded).

### Target Collection (`src/cli/commands/process-steps/step-2-stt/stt-targets.ts`)

- Add `deepgram` case to `collectSttTargets()` checking `options.deepgramSttModel`.

### Diarization Handling

- In `resolveDiarizationOptions`: add `'deepgram'` case alongside `'mistral'` for the `!capabilities.supportsSpeakerCountHint` warn-and-ignore branch.

## Phase 5 — Setup & Doctor

### Setup Orchestrator

- `src/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup.ts`: import `setupDeepgramStt`, call via `await withCompactSetup(setupDeepgramStt)`.

### Doctor

- `src/cli/commands/process-steps/step-0-setup/run-doctor.ts`: add `checks.push(checkEnvVar('DEEPGRAM_API_KEY', 'DEEPGRAM_API_KEY'))`.

### Env Example

- `.env.example`: add `DEEPGRAM_API_KEY=` and `DEEPGRAM_BASE_URL=` entries.

## Phase 6 — Pricing & Test Infrastructure

### Pricing

- `src/utils/pricing/compute-costs.ts`: add Deepgram to STT cost routing (follow existing provider pattern).
- `test/test-runner/reports.ts`: add `deepgramStt` to flag maps.
- `test/test-runner/price-commands.ts`: add Deepgram to price registry coverage.
- `test/test-utils/api-cheap-config.ts`: include Deepgram in cheapest-service selection if it's the cheapest option.

## Phase 7 — Tests

### Unit/Validation Tests (new + modified)

- `test/test-cases/validation/deepgram-stt-retries.test.ts` (new): mock `globalThis.fetch`, test:
  - Transient HTTP failures (502, 429) retry correctly.
  - Non-retryable errors (400) fail immediately.
  - Multi-speaker utterance response maps to `[speaker-0]`, `[speaker-1]` format.
  - Fallback to `channels[0].alternatives[0].words[]` when `utterances` is empty/missing.
  - Fallback to plain transcript text when both utterances and words are missing.
- `test/test-cases/validation/model-options.test.ts`: add invalid Deepgram model rejection test.
- `test/test-cases/validation/transcribe-routing.test.ts`: add Deepgram help output, bare-flag, config plumbing, and mutual-exclusion tests.
- `test/test-cases/validation/compute-costs.test.ts`: add Deepgram pricing-route test.
- `test/test-cases/validation/command-aliases.test.ts`: add Deepgram alias coverage.

### E2E Test (new)

- `test/test-cases/e2e/step-2-transcribe-e2e/transcribe-services/deepgram/deepgram-nova-3.test.ts`: use `defineSTTServiceTest` helper with `cliFlag: 'deepgram-stt'`, `sttService: 'deepgram'`, `envVarKey: 'DEEPGRAM_API_KEY'`, `models: ['nova-3']`.

## Phase 8 — Documentation

- `docs/commands/step-2-transcribe/transcribe-audio-services.md`: add Deepgram to supported-provider list with flag, model, and examples.
- `docs/commands/step-2-transcribe/transcribe-audio-tests-services.md`: add Deepgram test instructions.
- `docs/tests/service-tests-transcribe.md`: add Deepgram to test matrix.
- `docs/commands/config/config.md`: add `defaults.stt.deepgramStt` config key.
- `docs/commands.md`: mention `--deepgram-stt` in STT flags section.
- `docs/release-v0.1.md`: add Deepgram to release notes.
- `docs/diagrams/`: update STT provider diagrams if applicable.

## No Changes Needed

- `src/cli/commands/models/model-loader.ts`: already provider-agnostic once `stt-config.json` contains the `deepgram` entry.
- `src/utils/pricing/aggregate-pricing.ts`: cloud STT estimates are generic via `collectSttTargets` + registry cost lookup.
- `src/cli/commands/process-steps/process-stt.ts`: provider ordering, prompt selection, and metadata aggregation are generic and pick up Deepgram through `collectSttTargets`.
- `package.json` / `bun.lock`: using raw `fetch`, no new dependencies.
- `src/cli/commands/links/model-links.json` / `docs/commands/links/links.md`: Deepgram doc curation already exists.

## Verification

1. Run `bun check` — no type errors.
2. `bun as stt <audio> --deepgram-stt` resolves to `nova-3`, transcribes with diarization, writes `transcription.txt` with `[speaker-N]` labels.
3. `bun as stt <audio> --deepgram-stt --price` shows estimated cost using the diarization-inclusive rate.
4. `--deepgram-stt` is mutually exclusive with other hosted STT flags — combining with `--openai-stt` etc. produces a clear error.
5. `--deepgram-stt` appears in `stt --help` output.
6. `--speaker-count N --deepgram-stt` warns and ignores the count (does not fail).
7. `metadata.json` records `transcriptionService: "deepgram"` and `transcriptionModel: "nova-3"`.
8. Retry test passes: transient 502/429 retry, 400 fails immediately.
9. All existing tests still pass (`bun test`).
