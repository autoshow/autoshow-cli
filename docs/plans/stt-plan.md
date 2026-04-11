# Multi-Provider STT Fan-Out With Persistent Media Reuse

## Summary

- Let one `stt` invocation accept multiple STT provider flags and run them against the same inputs in a single pass.
- Split the media pipeline into four phases: `resolve source → acquire shared artifacts once → fan out providers → finalize per-provider outputs`.
- Add a persistent artifact cache under `~/.cache/autoshow-cli/media/` so later runs reuse metadata, duration, download, and transcode work instead of repeating `yt-dlp`, `ffmpeg`, and price-preflight calls.
- Keep existing single-provider `stt` behavior and on-disk output shape byte-for-byte unchanged.

## Scope and non-goals

- In scope: the `stt` command path only. `write`, `download`, `metadata`, `ocr` are untouched.
- In scope: shared media cache reused by both single- and multi-provider `stt` runs (single-provider benefits without layout changes).
- Out of scope: `write` STT fan-out, cross-command cache sharing with `write`/`ocr`, LLM-provider flag support for `stt` (still rejected at `handle-process-target.ts:210`).

## Phased rollout

The change is large enough to land in three mergeable phases. Each phase is releasable on its own and does not require the next.

- **Phase 1 — Media cache + acquisition split**. No user-visible API change. Refactor `transcribe()` and `dl-audio.ts` so the acquisition step produces a set of named artifacts (`metadata`, `duration`, `source_media`, `wav16k_mono`), and so every selected engine reads only the artifacts it needs. Back these artifacts with the persistent cache. Single-provider output layout stays identical; a cache hit should be indistinguishable from a cache miss in the final output directory.
- **Phase 2 — Multi-provider fan-out**. Relax the "one engine at a time" rule in `handle-process-target.ts:235` for `stt` only, introduce `SttTarget[]`, add the provider-concurrency flag, and add the `providers/<service>-<model>/` output layout for runs with two or more engines.
- **Phase 3 — Provider reliability hardening**. Retry/backoff parity across ElevenLabs and AssemblyAI, adaptive `Retry-After`-aware polling for AssemblyAI, and bounded split-segment concurrency with deterministic merge.

Keeping these phases distinct makes it safe to revert phase 2 or 3 without losing the cache wins from phase 1.

## Key changes by area

### Command validation

- `handle-process-target.ts` stops rejecting multiple STT engine flags when `command` is `stt`. The count check at `handle-process-target.ts:235` narrows to `command === 'write'`.
- LLM-provider guard at `handle-process-target.ts:210` is unchanged.
- When only one STT engine flag is set, behavior is identical to today (same code path, same `Step2Metadata` shape, same file names).

### Shared acquisition step

- Introduce an `SttTarget[]` collection analogous to existing multi-target write/TTS/image flows, produced from the resolved runtime options.
- Replace the current "always convert to 16 kHz mono WAV" step (`dl-audio.ts:37`, `dl-audio.ts:146`) with a lazy builder that produces exactly the artifacts the selected engines need:
  - `source_media`: the smallest faithful representation accepted by every selected cloud engine. Prefer the already-compressed download (mp3/m4a/webm). Only transcode when the source is a container that no selected cloud provider accepts.
  - `wav16k_mono`: built only when a local engine (`whisper`, `reverb`) is selected, or when a cloud provider explicitly rejects the compressed artifact.
- Provider adapters switch to reading `audioPath` as a parameter that may be either artifact. Adapters that currently assume a WAV (e.g. `run-mistral-stt.ts`, `run-assemblyai-stt.ts`) are verified against each provider's accepted codecs and updated only if needed.

### Persistent media cache

Location: `~/.cache/autoshow-cli/media/<cache-key>/`. Override via `AUTOSHOW_CACHE_DIR`.

**Cache entry layout**

```
~/.cache/autoshow-cli/media/<cache-key>/
  entry.json              # fingerprint, versions, artifact manifest, timestamps
  metadata.json           # extracted VideoMetadata (title, author, duration, etc.)
  source_media.<ext>      # compressed audio artifact for cloud STT
  wav16k_mono.wav         # optional local-engine artifact
  .lock                   # per-key advisory lock file
```

**Cache key rules**

- Local files: `sha256(abs_path | size | mtimeMs)`.
- Direct media URLs: `sha256(canonical_url | etag_or_content_length)` — fall back to `sha256(canonical_url)` alone when neither header is available, and log `cacheFingerprint=weak`.
- Streaming URLs (YouTube etc.): `sha256(canonical_url | source_id)` where `source_id` is extracted by `yt-utils` before download. Do **not** bake duration or publish date into the key — both require a network round-trip that defeats the point of a cache lookup. Verify duration/publish date after load as a consistency check; rebuild if they disagree.

**Cache versioning**

`entry.json` carries two independent version fields so a change to one pipeline does not bust the other:

- `metadataSchemaVersion`: bump on `VideoMetadata` shape changes.
- `artifactVersions: { source_media, wav16k_mono }`: bump when the ffmpeg flags or yt-dlp format selectors for that specific artifact change.

A missing, corrupt, or version-mismatched artifact is rebuilt in place; other artifacts in the same entry are kept.

**Concurrency and atomicity**

- Per-key advisory lock via `proper-lockfile` (or equivalent) on `<cache-key>/.lock`. Writers take an exclusive lock; readers take a shared lock.
- Atomic publish: write each artifact to `<cache-key>/.tmp-<rand>/` then `rename` into place. `entry.json` is written last to mark the entry as valid.
- Two concurrent processes racing on the same key: loser blocks on the shared lock and observes the winner's published artifacts.

**Eviction and size control**

- Soft cap via `AUTOSHOW_CACHE_MAX_GB` (default 20 GB), evaluated opportunistically after each publish.
- LRU eviction based on `entry.json.lastAccessedAt` updated on read.
- Entries older than `AUTOSHOW_CACHE_MAX_AGE_DAYS` (default 30) are eligible for eviction regardless of cap.
- Add `bun as cache prune` and `bun as cache clear` subcommands so users can manage the cache explicitly.

**Failure handling**

- Any `EACCES`, `ENOSPC`, or unreadable state gracefully degrades to a no-cache run for that invocation; failures are logged once and the pipeline still completes.

### Preflight and pricing

- Batch preflight resolves duration once per item via `resolveSttInputDurationSeconds` (`stt-duration.ts:89`) and stores the result on the `SttTarget` so execution never re-probes.
- When two or more STT engines are selected, price reporting emits one STT step per engine and totals them. `buildAggregatedPriceEstimate` is extended to accept an `engines` array instead of inferring a single engine.
- `reportSuitePriceEstimate` (`handle-process-target.ts:174`) replaces its sequential `for` loop with bounded concurrency (`--stt-preflight-concurrency`, default `4`), since preflight is network-bound and independent per item.

### Execution fan-out

- For a resolved `SttTarget`, acquire shared artifacts once, then run engines through a bounded pool (`--stt-provider-concurrency`).
- **Local vs. cloud concurrency is split.** Local engines (`whisper`, `reverb`) are GPU/CPU-bound and oversubscribing them thrashes. The effective pool is `min(stt-provider-concurrency, 1)` for local engines and the full value for cloud engines, unless the user passes `--stt-local-concurrency` explicitly.
- Each engine writes into its own subdirectory under the shared item root; no engine mutates another engine's files.

### Split-segment handling

- `runSplitTranscription` (`run-transcribe.ts:297`) is rewritten to:
  - Resolve segments once, then dispatch to a bounded pool sized by `--stt-segment-concurrency` (default `2`; clamp to `1` for local engines).
  - Collect segment results into an ordered array keyed by `segmentNumber`; merging must remain deterministic regardless of completion order. Add a unit test that shuffles completion order and compares against the sequential baseline.
  - On first segment failure, cancel remaining in-flight segments (`AbortController`) and surface the underlying error. Partial segment files are left in `segments/` for debugging but not merged.

### Provider reliability

Bundled into phase 3:

- ElevenLabs and AssemblyAI gain `withRetry` parity with Mistral (`run-mistral-stt.ts:112`).
- AssemblyAI polling (`run-assemblyai-stt.ts:108`) switches from fixed 3 s intervals to capped exponential backoff that honors `Retry-After` when present.
- Split-segment concurrency applies to every provider that currently uses sequential segment loops.

## Public API / output

### Flags

- `stt` accepts multiple provider flags together, e.g. `--elevenlabs-stt ... --assemblyai-stt ... --mistral-stt ...`.
- `--stt-provider-concurrency` (default `2`): max engines running in parallel for a single item.
- `--stt-local-concurrency` (default `1`): cap for local (`whisper`/`reverb`) engines; ignored for cloud.
- `--stt-segment-concurrency` (default `2`, clamped to `1` for local): max segments in flight inside one engine on one item.
- `--stt-preflight-concurrency` (default `4`): batch preflight duration-probe parallelism.
- `--refresh-cache`: rebuilds every cache entry touched by the current invocation. Entries not touched are left alone.
- `--no-cache`: bypass the cache entirely for this invocation (neither read nor write).
- `--batch-concurrency` keeps its current meaning (item-level parallelism) and is unchanged.

### Output layout

- **Single-provider runs (1 STT engine selected)**: output layout, file names, and `metadata.json` shape are **byte-for-byte identical** to current behavior. This is a hard compatibility requirement and is asserted by a golden test.
- **Multi-provider runs (≥ 2 STT engines selected)**:

```
output/<timestamp>_<slug>/
  <slug>.<ext>                  # shared compressed source_media artifact
  <slug>.wav                    # present only if a local engine ran
  metadata.json                 # aggregate
  providers/
    elevenlabs-scribe_v1/
      transcription.txt
      metadata.json             # per-provider step2 result
    assemblyai-best/
      transcription.txt
      metadata.json
    mistral-voxtral-mini-latest/
      transcription.txt
      metadata.json
```

  - Provider subdirectory name is `sanitize(service)-sanitize(model)`. Model slashes and other path-unsafe characters are replaced with `_`.
  - Per-provider `metadata.json` carries the existing `Step2Metadata` shape.
  - Aggregate `metadata.json` carries:
    - `step1`: shared source metadata (one entry)
    - `step2[]`: per-provider results keyed by `service`/`model`
    - `cost.aggregate`: sum across providers
    - `timing.aggregate`: wall time + per-provider timing
    - `cache: { sourceMedia: 'hit' | 'miss', wav16k: 'hit' | 'miss' | 'skipped' }`
    - `errors[]`: one entry per failed provider with `service`, `model`, and `error.message` — present only when at least one provider failed

- **Partial failure semantics**: if some providers succeed and others fail, the command exits `0` (batch-style), successful provider outputs are preserved, and failures are summarized in `errors[]` and logged. A dedicated exit code `2` is used only when **all** selected providers fail for an item.

## Observability

- Every cache decision is logged at `l.info` with a structured tag: `cache.hit`, `cache.miss`, `cache.rebuild`, `cache.bypass`, `cache.weak_fingerprint`.
- Aggregate `metadata.json` includes `cache` and per-provider `processingTime` so downstream reports can answer "how much did the cache save."
- Phase 1 adds a one-line per-item summary: `"stt-acquire item=... sourceMedia=hit(850ms) wav16k=skipped"`.

## Test plan

- **Validation tests**
  - Multi-provider flags are accepted for `stt` and still rejected for `write`.
  - All new flags (`--stt-*-concurrency`, `--refresh-cache`, `--no-cache`) validate correctly and integrate with `config-merge.ts`.
- **Unit tests**
  - Cache key generation for every input class (local file, direct URL with/without ETag, streaming URL).
  - Version mismatch on a single artifact rebuilds only that artifact and leaves others intact.
  - Cache lock + atomic publish: two concurrent workers racing on the same key produce exactly one set of published artifacts.
  - Corrupt `entry.json` / missing artifact file is recovered transparently.
  - Preflight duration result is reused by execution (assert `resolveSttInputDurationSeconds` is called once per item when two engines are selected).
  - Concurrent split merge: shuffle segment completion order, assert merged transcript equals the sequential-merge baseline bit-for-bit.
  - Retry classification on ElevenLabs, AssemblyAI, and Mistral 413/429/5xx responses.
  - AssemblyAI `Retry-After` header is honored on poll.
- **Integration tests**
  - First multi-provider batch run: `yt-dlp` and `ffmpeg` are invoked exactly once per item regardless of engine count.
  - Second run on the same inputs: neither `yt-dlp` nor `ffmpeg` is invoked; cache hit is recorded in aggregate `metadata.json`.
  - `--refresh-cache` rebuilds entries; `--no-cache` neither reads nor writes; an `AUTOSHOW_CACHE_DIR=/dev/null`-style failure falls back to no-cache mode.
  - Partial provider failure: one provider intentionally errors, the others complete, `errors[]` is populated, exit code is `0`.
  - All-providers-fail: exit code is `2`, no provider subdirectory is written.
- **E2E tests**
  - Existing single-provider STT suites pass unchanged — this is the single-provider compatibility gate.
  - Golden snapshot: for a single-provider run, the output tree (sorted) and `metadata.json` (normalized timestamps) match the current main branch output.
  - One multi-provider case covering ElevenLabs + AssemblyAI + Mistral on a short clip.
  - One large-file Mistral split regression verifying merged timestamps and transcript stability under segment concurrency.

## Defaults and success criteria

- Persistent cache is on by default across runs.
- Default concurrency stays conservative: `batch-concurrency=1`, `stt-provider-concurrency=2`, `stt-local-concurrency=1`, `stt-segment-concurrency=2`, `stt-preflight-concurrency=4`.
- Default cache limits: 20 GB, 30 days.
- Success criteria:
  - Single-provider `stt` output is byte-identical to the pre-change output (asserted by golden test).
  - First-run multi-provider batches perform acquisition once per item regardless of engine count.
  - Repeat runs on the same inputs skip metadata/download/transcode work entirely.
  - Wall time for a two-engine run trends toward `acquire + max(engine_time)` rather than `acquire + sum(engine_time)`.
