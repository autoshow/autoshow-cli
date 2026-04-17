# STT/OCR Compatibility-First Refactor — Phase 1

## Summary

Current STT/OCR surface spans ~22.6k LOC across code, tests, and docs. The main baggage is concentrated in the large orchestrators (`run-stt.ts` 634 LOC, `run-ocr.ts` 840 LOC), batch/resume state readers (`stt-batch-coordinator.ts` 548 LOC, `resume-stt-batch.ts` 471 LOC, `stt-run-state.ts` 453 LOC), duplicated async-provider lifecycle stacks, provider-named CLI flags, and report code that reconstructs state from partial artifact trees.

Refactor both domains substantially in place around the existing `step-2-stt` and `step-2-ocr` roots. This is a deep internal rewrite, not a public reset: keeping both directories and the general directory structures is a hard requirement, even if many files inside them are significantly rewritten, split, or replaced. All functionality for all current commands MUST be fully retained with no public breaking changes at all, including aliases, flags, artifact paths, report flows, resume behavior, provider coverage, default local providers, and lazy bootstrap.

Phase 1 establishes the compatibility contract and refactors the feature roots without switching higher-level callers yet. Phase 2 and Phase 3 inherit every constraint in this file.

**Current providers in scope:**
- STT (13): `whisper` (local, default), `reverb` (local), `deepgram`, `elevenlabs`, `soniox`, `speechmatics`, `rev`, `groq`, `openai`, `mistral`, `assemblyai`, `gladia`
- OCR (5): `tesseract` (local, default), `ocrmypdf` (local), `paddle-ocr` (local), `mistral-ocr` (hosted), `glm-ocr` (hosted)

---

## Public APIs / Types

### CLI Compatibility Requirements

Any generic provider contract is strictly additive. It may be introduced to simplify internals, but it MUST NOT replace or remove any current provider-named flags, aliases, or argument-normalization behavior:

```text
--provider <provider[:model]>
```

Examples: `--provider whisper:large-v3-turbo`, `--provider deepgram:nova-3`, `--provider mistral-ocr`. When `:model` is omitted, the provider's documented default model applies.

Retain all of the following as supported public entry points:
- Provider-specific flags: `--whisper`, `--reverb`, `--deepgram-stt`, `--elevenlabs-stt`, `--soniox-stt`, `--speechmatics-stt`, `--rev-stt`, `--groq-stt`, `--openai-stt`, `--mistral-stt`, `--assemblyai-stt`, `--gladia-stt`
- OCR-specific flags: `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr`
- Aliases: `transcribe`, `extract`
- All existing bare-flag expansion logic in `argv-normalize` (internal rewrites are fine, behavioral regressions are not)

Keep all current cross-provider flags with their existing public semantics. Stricter validation is acceptable only when it does not break any currently supported user flow:

| Flag | Kept | Notes |
|------|------|-------|
| `--provider <spec>` | additive | repeatable additive alias; does not replace existing provider flags |
| `--diarize` | yes | preserve current semantics while keeping unsupported combinations clearly handled |
| `--speaker-count <n>` | yes | preserve current provider constraints without changing supported flows |
| `--speaker-name <name>` | yes | preserve current OpenAI-only behavior |
| `--speaker-reference <path>` | yes | preserve current OpenAI-only behavior |
| `--split` | yes | splits audio into 10-min segments before transcription |
| `--reverb-verbatimicity <0-1>` | yes | Reverb-only; ignored with warning for other providers |
| `--batch`, `--batch-limit`, `--batch-all`, `--batch-order`, `--batch-concurrency` | yes | unchanged semantics |
| `--resume-missing [path]` | yes | must continue to work for current and refactored artifact layouts |
| `--refresh-cache`, `--no-cache` | yes | unchanged semantics |
| `--price`, `--dry-run` | yes | unchanged semantics |
| `--lang <code>` | yes (OCR) | Tesseract language code(s); ignored for hosted OCR |
| `--out <format>` | yes (OCR) | `text\|json\|tsv\|hocr`; default `text` |
| `--password <pwd>` | yes (OCR) | encrypted PDF pass-through |
| `--epub-bun`, `--epub-calibre` | yes (OCR) | EPUB inspection backend |
| `--url-backend <backend>` | yes (OCR) | `defuddle\|firecrawl\|glm-reader`; default `defuddle` |
| `--stt-provider-concurrency <n>` | yes | default 2; cloud provider slots |
| `--stt-local-concurrency <n>` | yes | default 1; local provider slots |
| `--stt-segment-concurrency <n>` | yes | default 2; audio segments per provider |

### Type Changes

Nested feature configs may be introduced internally, but they MUST adapt from the current public/runtime option contracts without removing or renaming fields that existing callers, tests, or type entry points rely on:

```typescript
type ProviderSpec = { provider: string; model?: string }

type SttPolicy = {
  providers: ProviderSpec[]
  batch?: BatchPolicy
  resume?: ResumePolicy
  concurrency?: ConcurrencyPolicy
  diarization?: DiarizationPolicy
  split?: boolean
}

type OcrPolicy = {
  providers: ProviderSpec[]
  batch?: BatchPolicy
  resume?: ResumePolicy
  render?: OcrRenderPolicy
  epubBackend?: 'bun' | 'calibre'
  urlBackend?: 'defuddle' | 'firecrawl' | 'glm-reader'
}
```

Do not remove current persistence or type contracts until compatibility is preserved end-to-end. New internal manifests/contracts may be introduced alongside the current shapes:

```typescript
type SttRunManifest
type OcrRunManifest
type ProviderResult
type ProviderCheckpoint
type BatchManifest
```

Keep existing `src/types` re-exports stable. New feature contracts may be added, but current public type entry points must remain source-compatible.

---

## Artifact Layout

Preserve the current general layout and directory anchors under `step-2-stt` and `step-2-ocr`. The shape below is only acceptable as an additive normalization inside the existing structure; it MUST NOT remove or rename public paths or files that commands, reports, resume flows, or users may rely on:

```text
<run-dir>/
  run.json
  outputs/
    <provider-key>.txt
    report.md
  providers/
    <provider-key>/
      result.json
      checkpoint.json
  reports/
<batch-dir>/
  batch.json
  <item-slug>/
```

Do not delete `info.json`, legacy metadata, or compatibility readers until all public commands transparently support both existing and refactored runs. Remove slug-matching or back-parsing only behind compatibility adapters that preserve current behavior.

---

## Phase 1 Plan

Phase 2 does not start until the Phase 1 gate passes.

### Goal

Restructure STT and OCR internals in place behind stable compatibility boundaries so the current higher-level callers can continue working while the new modules, manifests, and shared engines are introduced.

### Detailed Implementation Scope

Refactor `src/cli/commands/process-steps/step-2-stt/` in place with explicit modules. Existing files may be significantly rewritten, moved, or replaced within this tree, but the root directory and general structure stay:

| Module | Responsibility |
|--------|---------------|
| `cli.ts` | Parse `--provider` specs, validate flag combinations, emit `SttPolicy` |
| `media.ts` | Media acquisition and audio cache |
| `bootstrap.ts` | Delegates to `BootstrapBroker`; never imports setup orchestration directly |
| `sync-runner.ts` | Executes sync providers (`whisper`, `reverb`, `groq`, `openai`, `mistral`, `elevenlabs`, `deepgram`) |
| `async-lifecycle.ts` | Shared poll/checkpoint/cleanup engine for all async providers (`assemblyai`, `gladia`, `soniox`, `speechmatics`, `rev`) |
| `split.ts` | Audio splitting and segment merge |
| `orchestrator.ts` | Multi-provider fan-out, result aggregation |
| `batch.ts` | Batch scheduling and slot management |
| `resume.ts` | Resume/backfill across current artifacts plus `batch.json` and `checkpoint.json` when present |
| `manifest.ts` | `run.json` and `batch.json` read/write plus compatibility adapters |
| `report.ts` | Consensus/report generation from `ProviderResult[]` |

Refactor `src/cli/commands/process-steps/step-2-ocr/` in place with explicit modules. Existing files may be significantly rewritten, moved, or replaced within this tree, but the root directory and general structure stay:

| Module | Responsibility |
|--------|---------------|
| `cli.ts` | Parse `--provider` specs, validate flag combinations, emit `OcrPolicy` |
| `normalize.ts` | Classify inputs into canonical source kinds |
| `capability-matrix.ts` | Declared provider×source-kind compatibility; no inline branches |
| `local-runner.ts` | Executes `tesseract`, `ocrmypdf`, `paddle-ocr` |
| `hosted-runner.ts` | Executes `mistral-ocr`, `glm-ocr` |
| `epub.ts` | EPUB inspection (bun ZIP/XML and calibre backends) |
| `article.ts` | Web/article extraction (`defuddle`, `firecrawl`, `glm-reader`) |
| `orchestrator.ts` | Multi-provider fan-out using capability matrix for routing and fallback |
| `batch.ts` | Batch scheduling |
| `resume.ts` | Resume/backfill across current artifacts plus new manifests when present |
| `manifest.ts` | `run.json` and `batch.json` read/write plus compatibility adapters |
| `report.ts` | Consensus/report generation |

Phase 1 also introduces the shared structures that later phases depend on:

**Canonical OCR source kinds**

| Kind | Inputs |
|------|--------|
| `article` | HTTP URLs (non-file) |
| `epub-inspect` | `.epub` files |
| `pdf` | `.pdf` files |
| `image` | `.png`, `.jpg`, `.tiff`, `.webp`, etc. |
| `office-native` | `.docx`, `.pptx`, `.xlsx`, `.odf` with embedded text |
| `office-pdf` | `.docx`, `.pptx`, `.xlsx`, `.odf` requiring PDF conversion |
| `rtf-pdf` | `.rtf` files |
| `cbz-images` | `.cbz` comic archives |

**OCR capability matrix**

| Provider | article | epub-inspect | pdf | image | office-native | office-pdf | rtf-pdf | cbz-images |
|----------|---------|--------------|-----|-------|---------------|------------|---------|------------|
| tesseract | — | — | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| ocrmypdf | — | — | ✓ | — | — | ✓ | ✓ | — |
| paddle-ocr | — | — | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| mistral-ocr | — | — | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| glm-ocr | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ |

Fallback order is declared alongside the matrix; the orchestrator reads it, not the runners.

**Async STT lifecycle engine**

All five async providers (`assemblyai`, `gladia`, `soniox`, `speechmatics`, `rev`) must share one engine instead of each owning its own persisted-runtime, poll, and cleanup stack. The engine owns:
- Upload → submit → poll loop with configurable intervals per provider
- `checkpoint.json` write after each successful poll
- Idempotent resume from checkpoint on restart
- Timeout and max-retry policy
- Cleanup (delete remote job) on success or terminal failure

Each provider supplies only a thin adapter: `upload()`, `submit()`, `poll()`, `cleanup()`, `defaultPollInterval`.

**BootstrapBroker**

Move lazy setup behind `src/features/bootstrap-broker.ts`. It exposes:

```typescript
function ensureProviderReady(provider: string): Promise<void>
function setupProvider(provider: string): Promise<void>
```

Both feature roots call `ensureProviderReady` before running a provider. Provider runners never import setup orchestration directly. Bootstrap results are cached for the process lifetime.

If shared internals are extracted elsewhere, `step-2-stt` and `step-2-ocr` remain the stable integration roots and directory anchors.

### Correctness Checks

- CLI normalization snapshots still prove that provider-specific flags, aliases, and `argv-normalize` expansions map to the same provider/model selections as before.
- Manifest compatibility fixtures prove that existing `metadata.json` / `info.json` runs remain readable while additive `run.json`, `batch.json`, `result.json`, and `checkpoint.json` shapes round-trip cleanly.
- Provider compliance tests exist for every STT and OCR provider before higher-level callers are switched.
- Async STT tests prove checkpoint write-after-poll, idempotent resume from checkpoint, and cleanup on terminal success/failure.
- OCR routing tests prove that compatibility and fallback decisions come from `capability-matrix.ts`, not ad hoc branches scattered across runners.
- Structural checks confirm provider runners do not import setup orchestration directly and instead route through `BootstrapBroker`.
- Batch, resume, and report logic can operate against fixture runs through the new feature-root modules without changing the public command surfaces yet.

### Exit Criteria

- Both feature roots compile and pass their new module, manifest, and provider-level test coverage.
- Current higher-level callers can continue to run unchanged against compatibility adapters or stable feature-root entry points.
- No public flags, aliases, artifact paths, provider defaults, or type re-exports were removed or renamed.
- Both legacy and additive artifact layouts are readable before Phase 2 begins.

---

## Phase 1 Test Gate

All tests use `bun:test`. No Vitest, Jest, or `node:test`.

### Contract Tests

- `stt`, `ocr`, `transcribe`, and `extract` all continue to resolve
- Existing provider-specific flags still map to the same providers/models
- `--provider whisper` → default model applied; `--provider whisper:large-v3-turbo` → explicit model
- Multiple provider-selection paths normalize to the same `providers` order
- `--diarize`, `--speaker-name`, and `--speaker-reference` preserve current supported behavior and error shapes
- `--resume-missing` works with current `metadata.json` directories and refactored runs

### Manifest Tests

- Existing run directories with current `metadata.json` / `info.json` remain readable
- `run.json` round-trips through `SttRunManifest` and `OcrRunManifest` schemas when introduced
- `batch.json` round-trips through `BatchManifest` schema when introduced
- `result.json` round-trips through `ProviderResult` schema when introduced
- `checkpoint.json` round-trips through `ProviderCheckpoint` schema when introduced
- Backward/forward compatibility: current runs and refactored runs are both accepted

### Provider Compliance Tests

- Sync STT (7): `whisper`, `reverb`, `groq`, `openai`, `mistral`, `elevenlabs`, `deepgram`
  - Asserts adapter satisfies sync interface; mock transport layer
- Async STT (5): `assemblyai`, `gladia`, `soniox`, `speechmatics`, `rev`
  - Asserts adapter satisfies async interface; mock upload/poll/cleanup
  - Asserts checkpoint written after each poll; resume from checkpoint re-enters poll loop
- OCR local (3): `tesseract`, `ocrmypdf`, `paddle-ocr`
- OCR hosted (2): `mistral-ocr`, `glm-ocr`
- OCR capability matrix: each declared cell passes; each absent cell errors immediately

---

## Assumptions

- Breaking the STT/OCR CLI surface, command set, aliases, flags, or disk format is not acceptable. No public breaking changes are allowed.
- Full feature parity is required after the refactor, including batch/resume and consensus/report tooling, for every current command surface.
- All 13 STT providers and all 5 OCR providers stay in scope.
- Default local providers remain `whisper` for STT and `tesseract` for OCR; lazy bootstrap remains supported through `BootstrapBroker`.
- `step-2-stt` and `step-2-ocr` remain required long-term roots/ownership boundaries; files within them can be substantially rewritten, but the directories and general structure stay.
- A migration note may be added only as supplemental documentation. Runtime compatibility with existing `step-2-stt` and `step-2-ocr` artifact directories remains required.
