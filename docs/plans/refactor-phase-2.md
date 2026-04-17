# STT/OCR Compatibility-First Refactor — Phase 2

## Scope

Phase 2 starts only after [refactor-phase-1.md](./refactor-phase-1.md) passes its correctness checks and test gate. This phase switches real callers onto the refactored feature roots without changing anything users depend on.

## Inherited Compatibility Invariants

Every constraint from Phase 1 remains in force:
- No public breaking changes to commands, aliases, flags, artifact paths, report flows, resume behavior, provider coverage, default providers, or lazy bootstrap
- `step-2-stt` and `step-2-ocr` remain the stable feature roots
- Existing `src/types` entry points remain source-compatible
- Legacy artifact layouts and additive manifests must both remain readable
- Provider-specific flags and `argv-normalize` behavior remain backward-compatible

## Phase 2 Plan

### Goal

Move all internal callers onto the refactored STT/OCR feature APIs while preserving current commands, aliases, flags, artifact locations, report flows, resume behavior, lazy bootstrap, and observable output.

### Detailed Implementation Scope

Rewire the following to call the refactored feature APIs while preserving current command names, aliases, flags, artifact paths, and observable behavior:
- `handle-process-target`, `single-target`, `process-video`
- Pricing/preflight module
- `cache` commands
- `setup`/model commands
- `report` commands

Phase 2 is where the compatibility promises become end-to-end guarantees rather than module-level guarantees:
- Public command dispatch for `stt`, `ocr`, `transcribe`, and `extract` must route through the refactored internals without changing how users invoke them.
- Report and resume flows must accept both current artifact trees and additive manifests, including partially completed async runs and mixed batch directories.
- Pricing, setup, and cache surfaces must keep the same provider naming, defaults, and lazy bootstrap behavior while consuming the new orchestration internals.
- Higher-level callers may stop using superseded private code paths, but no user-visible output, flag contract, or artifact expectation may change in this phase.

### Correctness Checks

- Contract tests prove that all command aliases, provider-specific flags, generic `--provider` parsing, and cross-provider flag behavior still match the current public contract.
- End-to-end STT and OCR fixtures cover single-provider, multi-provider, batch, resume, report, and provider-specific capability flows through the real public commands.
- Legacy-artifact fixtures and refactored-artifact fixtures are both exercised by the same report/resume commands to prove forward and backward compatibility.
- Artifact comparison checks confirm that required output paths, filenames, report locations, and batch directory shapes remain valid for existing consumers.
- Pricing/preflight, cache, setup, and report integration tests run through the refactored internal APIs without changing their documented external behavior.
- Failure-path tests verify that unsupported provider/flag combinations, unsupported OCR source/provider pairs, and diarization constraints still fail with compatible error semantics.

### Exit Criteria

- All public STT/OCR command surfaces run through the refactored internals.
- End-to-end compatibility is proven for both current and additive artifact layouts.
- Report, resume, cache, setup, pricing, and process-target integrations pass without introducing public regressions.
- No Phase 1 compatibility adapter needed for current functionality remains untested at a public-command level.

---

## Phase 2 Test Gate

All tests use `bun:test`. No Vitest, Jest, or `node:test`.

### End-to-End STT Tests

- Single provider, sync: whisper default, whisper explicit model
- Single provider, async: assemblyai with checkpoint recovery simulation
- Multi-provider: two providers fan-out → both results in `providers/`; report generated
- Batch: multiple items → `batch.json` written; per-item `run.json` written
- Resume/backfill: batch dir with one missing provider → backfill runs only missing
- Diarization: provider that supports it + `--diarize`; provider that does not + `--diarize` → error
- Split: `--split` produces segments, merge produces unified transcript
- Report: `report.ts` consumes refactored result data without breaking current report commands or artifact readers

### End-to-End OCR Tests

- PDF via tesseract (default)
- PDF via mistral-ocr
- Image via tesseract; image via paddle-ocr
- EPUB inspect via bun backend; EPUB inspect via calibre backend
- Office native text (docx with embedded text)
- Office OCR fallback (docx requiring PDF conversion)
- RTF → PDF → tesseract
- CBZ images → per-page OCR
- Article/web via defuddle, firecrawl, glm-reader
- Multi-provider OCR run → both results in `providers/`; report generated
- Capability matrix: source kind with no compatible provider → clear error

### Integration Tests

- `write`, `video`, pricing/preflight, `setup`, and `cache` retain current public behavior while consuming the refactored internals
- Integration tests continue to cover `step-2-stt` and `step-2-ocr` paths plus current artifact layouts
- Report/resume commands accept both legacy artifact trees and additive manifests in the same suite
