# Test Runner Tier Removal Plan

## Goal

Remove the entire test-runner tier system so test selection is based only on:

- `bun t` for the full suite
- `bun t <file-or-dir>...` for targeted runs
- `--test-price` for pricing mode on the selected paths
- `--budget <whole-number-cents>` for budget preflight on the selected paths

After this change, `--tier`, `--api`, and all tier-specific routing and reporting should be gone.

## Assumptions

- Targeted execution will be path-based only. There is no replacement grouping flag after tiers are removed.
- `--test-price` and `--budget` operate on the same path selection that normal test mode uses.
- `bun t --test-price` with no path filters should still work, but it should mean "all mapped priceable tests" rather than "all tiers".
- Some tests are price-reportable but not budget-skippable. That distinction should be explicit in the new mapping layer.

## Current Tier Dependencies

The current tier model affects five separate surfaces:

1. CLI parsing and execution filtering
   - `test/test-runner/args.ts`
   - `test/test-runner/runner.ts`
   - `test/test-runner/constants.ts`
   - `src/types/tests-dir-types.ts`

2. Price command selection and evaluation
   - `test/test-runner/price-commands.ts`
   - `test/test-runner/price-evaluation.ts` — `groupCommandsByKey()` and `evaluatePriceObservations()` use tier-derived suite names
   - `test/test-runner/runner.ts`

3. Reporting and budget summaries
   - `test/test-runner/reports.ts` — `BudgetPreflightSummary.suiteName` currently stores tier labels
   - `test/test-runner/artifacts.ts` — creates run directories and artifact paths

4. Validation coverage
   - `test/test-cases/validation/tier-routing.test.ts`
   - `test/test-cases/validation/test-runner-args.test.ts`
   - `test/test-cases/validation/test-runner-price-evaluation.test.ts`

5. Documentation
   - `docs/tests/local-tests.md`
   - `docs/tests/service-tests.md`
   - command-specific test docs under `docs/commands/**`

Note: `test/test-utils/budget.ts` (the `budgetedTest()` wrapper itself) is not tier-dependent but must stay aligned with registry keys throughout the migration.

## Important Implementation Constraint

Removing tiers from execution is easy. Removing them from price and budget behavior is the real work.

Today:

- standard execution can already run by path
- price mode still depends on tier-level command builders
- path-based price selection falls back to keyword heuristics
- budget skipping only works for tests wrapped in `budgetedTest()`

That means tier removal should not start by deleting the routing tables. It should start by replacing the pricing and budget-selection model with an explicit path-based registry.

## Proposed End State

The runner should have one selection model:

- discover all tests from `test/test-cases/**/*.test.ts`
- if no path filters are passed, operate on the full suite
- if path filters are passed, operate only on matching files
- if `--test-price` is present, resolve price commands from the same selected files
- if `--budget` is present in normal mode, run budget preflight against the same selected files before launching Bun tests

The runner should no longer know what `smoke`, `local`, `api`, `slow-local`, or `slow-api` mean.

## Migration Plan

The phases below are numbered in the recommended safe implementation order. This ordering prevents a temporary state where tier deletion breaks `--test-price` and `--budget` before the replacement model exists.

### Phase 1: Define the Explicit Path-Based Price Registry

This is the critical foundation. Everything else depends on it.

The current implementation builds pricing commands from tiers in `test/test-runner/price-commands.ts` and only narrows them by path later using `filterCommandsByPaths()`. That heuristic is not strong enough to become the primary selection model.

Replace it with a new path-first registry. The registry should declare:

- the file or directory prefix it covers
- the price command name (for reports and grouping)
- the price command key (for budget skip matching)
- the command args
- whether the command is report-only or also budget-skippable

Suggested shape:

```ts
type PriceSelectionEntry = {
  selector: string
  selectorKind: 'file' | 'prefix'
  name: string
  key: string
  args: string[]
  budgetSkippable: boolean
}
```

The `name` field replaces the current `ApiCheapPriceCommand.name` used in reports and by `groupCommandsByKey()` in `price-evaluation.ts`. The `key` field is the budget skip key that must exactly match the string passed to `budgetedTest()` in test files.

Behavior:

- `bun t --test-price` with no paths resolves the union of all registered entries
- `bun t path/to/file.test.ts --test-price` resolves only entries whose selectors match that file
- `bun t path/to/dir/ --test-price` resolves the union for that directory
- suite labels become path-based, not tier-based

Examples of labels:

- `All mapped tests`
- `Selected paths: step-2-transcribe-e2e/transcribe-local/whisper`
- `Selected paths: step-4-tts-e2e/tts-local/kitten-tts.test.ts`

This phase should also remove:

- `buildTierPriceCommands()` from `test/test-runner/price-commands.ts`
- `filterCommandsByPaths()` from `test/test-runner/price-commands.ts` (replaced by registry-native selection)
- `resolvePriceTierSelection()` from `test/test-runner/runner.ts`
- tier-derived suite labels like `Tier api` and `All tiers`

Report metadata should become selection-based at this point. Update report wording in `test/test-runner/runner.ts` and `test/test-runner/reports.ts` so fields like `budgetPreflightSuite` contain neutral labels such as:

- `All mapped tests`
- `Selected paths: step-3-write-e2e/write-services/openai`

Update `groupCommandsByKey()` in `test/test-runner/price-evaluation.ts` to derive grouping from the registry `name` field instead of tier-based command names.

### Phase 2: Wire Price Mode to the Registry

Connect `runPriceMode()` in `test/test-runner/runner.ts` to resolve commands from the new registry instead of iterating tiers with `buildTierPriceCommands()`.

### Phase 3: Wire Budget Preflight to the Registry

Connect `runBudgetPreflight()` in `test/test-runner/runner.ts` to resolve budget-skippable commands from the registry instead of tier-based selection.

### Phase 4: Align Price Keys With Budget Skip Keys

The budget system is only useful if price preflight keys map to real test skip keys.

Today, many service helper tests already do this through `budgetedTest()` in:

- `test/test-utils/define-stt-service-test.ts`
- `test/test-utils/define-tts-service-test.ts`
- `test/test-utils/define-image-service-test.ts`
- `test/test-utils/define-video-service-test.ts`
- `test/test-utils/define-music-service-test.ts`
- `test/test-utils/define-ocr-service-test.ts`
- `test/test-utils/define-llm-write-test.ts`

But several local and mixed tests still rely on tier-level pricing or standalone `--price` assertions without stable budget keys. Those need to be normalized so budget behavior stays meaningful after tiers are removed.

Representative files to normalize:

- `test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-default.test.ts`
- `test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-models-price.test.ts`
- `test/test-cases/e2e/step-3-write-e2e/write-local/llama/llama-smoke.test.ts`
- `test/test-cases/e2e/step-3-write-e2e/write-local/llama/llama-qwen.test.ts`
- `test/test-cases/e2e/step-3-write-e2e/write-local/write-subcommand-local.test.ts`
- `test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts`
- `test/test-cases/e2e/step-2-extract-e2e/extract-local/extract-paddle-ocr-image.test.ts`

Rules for this phase:

- if a test should be skippable under `--budget`, wrap it with `budgetedTest()` and give it a stable key
- if a test only contributes price-report coverage, register it as report-only
- do not keep tier-prefixed synthetic names like `smoke-*` or `slow-api-*`
- use stable test-intent keys such as `transcribe-whisper-base`, `write-llama-qwen3-0.6b`, or `tts-kitten-mini`

### Phase 5: Rewrite Validation Tests

After the new selection model exists, rewrite validation coverage around it.

Note: non-tier-dependent validation tests (`test-budget-helper.test.ts`, junit parsing, model calibration, etc.) are not being rewritten — only the three tier-dependent files listed below.

Work:

- delete `test/test-cases/validation/tier-routing.test.ts`
- rewrite `test/test-cases/validation/test-runner-args.test.ts` to cover:
  - rejection of removed tier flags
  - path filter parsing
  - `--budget` behavior
  - `--test-price` behavior
- rewrite `test/test-cases/validation/test-runner-price-evaluation.test.ts` to stop expecting `Tier api`
- add tests for:
  - explicit file selection to price-command resolution
  - directory selection to price-command resolution
  - mixed path selection
  - budget skip key propagation into `AUTOSHOW_TEST_BUDGET_SKIP_KEYS`
  - empty price resolution for unmapped selections
  - registry key to `budgetedTest()` key alignment (assert every registry key with `budgetSkippable: true` has a corresponding `budgetedTest()` call, and vice versa)

This phase should verify the new model directly instead of recreating tier semantics under a different name.

### Phase 6: Remove Tier Parsing and Tier Routing Code

With the registry in place and validated, remove all tier infrastructure.

CLI cleanup:

- remove `--tier` parsing from `test/test-runner/args.ts`
- remove the `--api` alias
- remove the old `slow` shorthand behavior
- `--api-cheap` already throws a removal error — keep it during the transition
- `--timestamps` is already silently ignored — no action needed
- keep a hard error for removed flags for one transition cycle, with a message that points users to path-based usage plus `--test-price` and `--budget`

Recommended error direction:

```text
Error: --tier has been removed. Run bun t <file-or-dir>... and use --test-price or --budget on that selection.
```

This keeps the breakage explicit and avoids silent behavior changes in existing scripts.

Execution cleanup:

- delete `Tier` from `src/types/tests-dir-types.ts`
- delete `ALL_TIERS` and `TIER_RULES` from `test/test-runner/constants.ts`
- delete `selectedTiers`, `parseTier`, and `SLOW_TIERS` from `test/test-runner/args.ts`
- delete `getTier()` and `buildExcludedPaths()` from `test/test-runner/runner.ts`
- simplify `runStandardTestMode()` so it uses either:
  - all discovered files, or
  - files matched by path filters

Note: if `matchPathFilters()` does not exist yet, it needs to be written as part of this phase.

Logging updates:

- replace tier summaries like `smoke:12, api:40`
- log either:
  - `Running all discovered tests (N files)`
  - `Running selected tests (N files from M path filters)`

### Phase 7: Rewrite Documentation

The documentation currently teaches the tier model in multiple places, so it must change in the same refactor.

Primary docs to update:

- `docs/tests/local-tests.md`
- `docs/tests/service-tests.md`

Command docs with tier references:

- `docs/commands/sample/sample-tests.md`
- `docs/commands/step-0-setup/setup-tests.md`
- `docs/commands/step-1-download/download-file-tests.md`
- `docs/commands/step-2-extract/extract-document-local.md`
- `docs/commands/step-2-extract/extract-document-tests-services.md`
- `docs/commands/step-2-transcribe/transcribe-audio-local.md`
- `docs/commands/step-2-transcribe/transcribe-audio-tests-services.md`
- `docs/commands/step-3-write/write-text-local.md`
- `docs/commands/step-3-write/write-text-tests-services.md`
- `docs/commands/step-4-tts/text-to-speech-local.md`
- `docs/commands/step-4-tts/text-to-speech-tests-services.md`
- `docs/commands/step-5-image/text-to-image-tests-services.md`
- `docs/commands/step-6-video/text-to-video-tests-services.md`
- `docs/commands/step-7-music/text-to-music-tests-services.md`

Documentation changes:

- remove `Tier Map` sections
- remove `**Tier:** ...` labels
- remove `--tier ...` examples
- replace them with explicit file and directory commands
- explain pricing as path-based:
  - `bun t <path> --test-price`
  - `bun t <path> --budget 5`
  - `bun t <path> --test-price --budget 5`

The docs should still group tests conceptually as "local/runtime" versus "service/network" when that helps readers, but that grouping should be documentation-only, not runner behavior.

### Phase 8: Verify and Clean Up

Verification should happen in this order:

1. runner validation tests
2. representative path-based `--test-price` runs
3. representative path-based `--budget` runs
4. full `bun t`
5. final source and docs sweep for removed tier terms

Recommended verification commands:

```bash
bun t test/test-cases/validation/
bun t test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/ --test-price
bun t test/test-cases/e2e/step-3-write-e2e/write-services/openai/ --test-price
bun t test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts --budget 5
bun t
```

Final cleanup sweep:

```bash
rg -n --fixed-strings -- '--tier' test docs src
rg -n --fixed-strings -- '--api' test docs src
rg -n 'ALL_TIERS|TIER_RULES|\\bTier\\b' test docs src
```

Expected result:

- no tier parsing
- no tier routing
- no tier-labeled reports
- no tier-specific docs
- path-based pricing and budget behavior work consistently

## Risks

### Risk 1: Price Selection Regressions

If the explicit path registry is incomplete, `--test-price` and `--budget` will silently lose coverage after tiers are removed.

Mitigation:

- add validation tests for selector coverage
- prefer exact file and prefix mappings over heuristics
- keep suite labeling explicit so empty resolutions are obvious

### Risk 2: Budget Skip Coverage Remains Partial

Even with correct price selection, `--budget` only skips tests that use `budgetedTest()`.

Mitigation:

- normalize the local and mixed tests listed above
- explicitly mark non-skippable mappings as report-only

### Risk 3: External Automation Still Uses `--tier`

There is no `.github` directory or other visible CI config in this repository, but external automation may still call `bun t --tier ...`.

Mitigation:

- keep explicit removal errors during the transition
- update any external scripts at the same time as the code change

### Risk 4: Registry Key / budgetedTest Key Mismatch

A mismatch between registry `key` values and the strings passed to `budgetedTest()` in test files will silently break budget skipping with no error. Tests will run (and incur cost) even when the budget preflight determined they should be skipped.

Mitigation:

- add a validation test in Phase 5 that asserts all registry entries with `budgetSkippable: true` have a corresponding `budgetedTest()` call using the same key
- assert the reverse: every `budgetedTest()` key in test files has a matching registry entry
- fail loudly on orphaned keys in either direction
