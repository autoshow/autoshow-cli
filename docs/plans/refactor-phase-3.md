# STT/OCR Compatibility-First Refactor — Phase 3

## Scope

Phase 3 starts only after [refactor-phase-2.md](./refactor-phase-2.md) passes its correctness checks and test gate. This phase removes dead private code after parity has already been demonstrated.

## Inherited Compatibility Invariants

Every constraint from Phase 1 and Phase 2 remains in force:
- No public breaking changes to commands, aliases, flags, artifact paths, report flows, resume behavior, provider coverage, default providers, or lazy bootstrap
- `step-2-stt` and `step-2-ocr` remain the stable feature roots
- Compatibility readers for current artifact directories remain intact
- Existing `src/types` entry points remain source-compatible
- Cleanup must not remove code paths still needed for mixed legacy/refactored artifact trees

## Phase 3 Plan

### Goal

Remove dead private code only after parity is proven, while preserving the required feature roots, compatibility readers, public types, tests, and all user-invocable behavior.

### Detailed Implementation Scope

After all callers are switched and tests pass, delete only dead internal files and duplicate private implementations while keeping `src/cli/commands/process-steps/step-2-stt/`, `src/cli/commands/process-steps/step-2-ocr/`, and the general directory structures intact:
- Duplicated async lifecycle internals replaced by the shared engine
- Dead private resume adapters no longer needed behind compatibility layers
- Redundant private consensus wrappers once stable entry points remain unchanged
- Unused private type helpers after current `src/types` compatibility is preserved
- Internal-only dead code that no command, artifact reader, or public type path still reaches

Do not delete:
- Provider flags, OCR flags, or command aliases that users can invoke today
- Compatibility readers for current `step-2-stt` or `step-2-ocr` artifact directories
- Current `src/types` public entry points
- Tests that assert retained public behavior
- `argv-normalize` behavior unless the replacement is fully backward-compatible

### Correctness Checks

- Each deletion batch is followed by targeted search checks for remaining imports/references and by the relevant `bun:test` suites before further cleanup continues.
- Full public-command compatibility, legacy artifact compatibility, and refactored artifact compatibility are re-run after the last deletion pass.
- Type-entry-point checks confirm that `src/types` re-exports still resolve exactly where downstream callers expect them.
- Resume, report, and batch fixtures are re-run to ensure cleanup did not remove code paths still needed for current and mixed artifact directories.
- Final code search confirms the old duplicated async lifecycle stacks and other superseded private implementations are actually gone, not just unreachable.

### Exit Criteria

- Only dead internal files and duplicate private implementations were removed.
- Required feature roots, compatibility readers, public type surfaces, and public command behavior remain intact.
- The repository no longer carries parallel private implementations for async lifecycle, resume, or report logic where the new stable paths already cover the behavior.

---

## Phase 3 Test Gate

All tests use `bun:test`. No Vitest, Jest, or `node:test`.

- Full `bun:test` suite passes after superseded private files are removed
- Public CLI compatibility tests still pass after cleanup
- Legacy and refactored artifact compatibility tests still pass after cleanup
- Search-based checks confirm no remaining imports or call sites reference deleted private implementations
- `src/types` compatibility tests still pass after cleanup
- Batch, resume, and report regression fixtures still pass after cleanup
