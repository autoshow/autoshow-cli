# Migrate `autoshow-cli` to TypeScript 7

## Summary
- Adopt TypeScript 7 as the repo’s primary type-checking tool by switching from TS6 `tsc` to TS7 `tsgo`.
- Keep the migration narrow: update package/tooling only, not source code or editor config, unless TS7 exposes a real diagnostic during implementation.
- Current repo state is favorable: `bunx tsc --noEmit` passes today, and a one-off `tsgo --noEmit` check also passes with no source changes.

## Implementation Changes
- Update [package.json](/Users/ajc/c/as/autoshow-cli/package.json):
  - Replace `devDependencies.typescript` with `@typescript/native-preview@beta`.
  - Change `scripts.check` from `bunx tsc --noEmit` to `bunx tsgo --noEmit`.
  - Keep all runtime scripts and dependencies unchanged.
- Refresh [bun.lock](/Users/ajc/c/as/autoshow-cli/bun.lock) after the dependency change.
- Leave [tsconfig.json](/Users/ajc/c/as/autoshow-cli/tsconfig.json) unchanged for the initial migration:
  - It already uses TS7-safe settings like `strict: true`, `moduleResolution: "bundler"`, explicit `types`, and `noUncheckedSideEffectImports: true`.
  - It does not use removed/deprecated settings called out in `docs/tsv7.md` such as `baseUrl`, `moduleResolution: node10`, `target: es5`, or `module: amd/umd/system`.
  - `stableTypeOrdering` is now `true` by default in TS7 and cannot be turned off; this tsconfig does not set it, so the new default applies cleanly.
  - `libReplacement` defaults to `false` in TS7; this tsconfig does not set it, so the new default applies silently — no action needed.
  - `rootDir` now defaults to `./` in TS7; this tsconfig does not set `rootDir`, so the new default applies. Because `noEmit: true` is set, output directory structure is irrelevant and this change has no practical effect.
  - `alwaysStrict: true` is explicitly set; TS7 only forbids setting it to `false`, so `true` is redundant but not an error. It can be removed as a follow-up cleanup once the migration is confirmed stable.
  - `allowJs: true` is set. TS7 significantly reworks JavaScript analysis (see `docs/tsv7.md` § "JavaScript Differences"). Verify during the test run that no `.js` files under the include globs (`src/**/*.ts`, `test/**/*.ts`) are inadvertently checked and surfacing new diagnostics.
- Do not add `--checkers`, `--builders`, or `--singleThreaded` in v1. Start with TS7 defaults (4 type-checking workers) and only tune if reproducibility or CI resource issues appear later. If CI runners have fewer than 4 cores, consider `--checkers 2` to reduce overhead.
- Do not add a permanent TS6 fallback script. This is a direct swap.
- Ignore TS7 JavaScript/JSDoc migration work for now; the include globs target `.ts` files only. However, `allowJs: true` means any `.js` files that fall under `src/` could be picked up — confirm none exist or are inadvertently included before closing the migration.

## Public Interfaces / Workflow
- Developer-facing type-check entrypoint remains `bun run check`; only the underlying compiler changes from TS6 `tsc` to TS7 `tsgo`.
- No runtime CLI commands, config schema, or exported project types should change as part of this migration.
- No repo-tracked editor or workspace configuration should be added.

## Test Plan
- Record the pre-change baseline with `bunx tsc --noEmit`.
- After the dependency/script update, run `bun install` and verify `bun run check` succeeds with TS7.
- Run `bun t` to confirm the toolchain swap did not disturb test or setup assumptions.
- During migration validation, run one explicit TS7 comparison command such as `npx -y -p @typescript/native-preview@beta tsgo --noEmit`; this is for validation only, not a permanent repo script.
- Acceptance criteria:
  - `bun run check` passes under TS7.
  - `bun t` passes unchanged.
  - No source-file edits are needed unless TS7 surfaces a genuine new diagnostic.
  - Contributor workflow stays `bun run check` / `bun t`.

## Assumptions
- Direct swap means TS6 should not remain a first-class repo workflow after the migration lands.
- If `bun install` or another dev tool unexpectedly requires a package literally named `typescript`, add `typescript: "npm:@typescript/typescript6@^6.0.0"` only as a compatibility alias while keeping TS7 as the active checker. This is a fallback, not the default plan.
- No README update is required unless you want a brief note that `bun run check` is now backed by TS7 internally.
- Track the upstream plan to rename `@typescript/native-preview` to `typescript` and switch the entry point from `tsgo` back to `tsc`. When that stable release lands, a follow-up PR will be needed to update the package name and `check` script again.
