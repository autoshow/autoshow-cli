# Sample Tests

```bash
bun t \
  test/test-cases/smoke/sample/sample-command.test.ts \
  test/test-cases/local/sample/sample-generate.test.ts
```

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [Sample Fixture Generation](#sample-fixture-generation)

## Validation / Price / Non-E2E

```bash
bun t test/test-cases/smoke/sample/sample-command.test.ts
```

Coverage (no tools required):
- `setup --help` exposes `--sample` plus the expected fixture flags (`--out`, `--refresh`, `--verify-only`, `--valid-only`)
- removed `sample` command returns an unknown-command usage error
- `setup --sample --verify-only` with a nonexistent output directory fails with non-zero exit
- `setup --sample --verify-only` against the preflight-generated `input/samples` passes (skipped if preflight did not run)
- `manifest.json` schema validation: `schemaVersion`, `generatedAt`, `fixtures[]`, `skipped[]`, `summary` fields
- Fixture entries have all required fields: `path`, `format`, `supportLevel`, `validity`, `requiredTools`, `verified`
- Invalid fixtures are tagged with `invalidReason`
- Verified valid fixtures exist on disk

No assertions on human log strings; all assertions use exit codes, `fileExists`, and structured `manifest.json` fields.

## Sample Fixture Generation

```bash
bun t test/test-cases/local/sample/sample-generate.test.ts
```

Coverage (requires ffmpeg and ffprobe):
- `setup --sample --out <dir>` creates `manifest.json`, `valid/`, and `invalid/` directories
- Manifest `schemaVersion` is 1 and `summary.generated > 0`
- Manifest summary counts are internally consistent (`generated == fixtures.length`, `total == generated + skipped`)
- Current-support valid fixtures are all verified and exist on disk
- Invalid fixtures exist on disk and are tagged with `invalidReason`
- `setup --sample --verify-only` passes after successful generation
- `setup --sample --refresh` regenerates and produces a valid manifest
- `setup --sample --valid-only` produces a manifest with no invalid fixtures
- Invalid corrupt PDF causes `extract` to fail with non-zero exit
- Valid PDF fixture extracts successfully
- Valid CSV fixture extracts as raw text
- Binary `.csv` invalid fixture is rejected as non-text content

Local setup prerequisites are in [`03-extract-ocr.md#ocr-setup`](../../process-steps/step-2-extract/03-extract-ocr.md#ocr-setup) and [`sample.md`](./sample.md).
