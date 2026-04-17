# report

Generate consensus report artifacts for existing STT or OCR run outputs.

## Outline

- [Usage](#usage)
- [Target Detection](#target-detection)
- [STT Reports](#stt-reports)
- [OCR Reports](#ocr-reports)
- [Examples](#examples)
- [Notes](#notes)

## Usage

```bash
bun as report <outputDir>
```

`report` takes one positional path and no report-specific flags.

The target can be:

- a single run directory that already contains `providers/` and `run.json`
- a batch root whose immediate child directories each contain `providers/` and `run.json`

## Target Detection

`bun as report` infers the report kind from persisted run artifacts.

Detection rules:

- if the target itself contains `providers/` and `run.json`, it is treated as one run
- otherwise, `report` scans only the immediate child directories and treats matching children as batch runs
- a run is classified as STT if any provider directory contains `transcription.evidence.json`
- a run is classified as OCR if any provider directory contains `result.json`
- all discovered runs in one invocation must resolve to the same kind

Failures:

- mixed STT and OCR runs under one target fail
- runs that do not contain enough persisted artifacts to classify also fail
- unreadable or missing target paths fail

## STT Reports

STT reporting analyzes persisted evidence-rich STT runs. It is most useful after multi-provider hosted STT runs, but detection is based on artifacts, not on which command produced them.

STT prerequisites and behavior:

- successful provider directories must include `transcription.evidence.json`
- older STT runs without `transcription.evidence.json` are rejected
- when native payloads were available during transcription, provider directories may also contain `transcription.raw.json`
- if the source audio file is still present and `ffmpeg` is available on `PATH`, flagged review windows can also produce `review-clips/*.mp3`

Per run, STT reporting writes:

- `consensus-transcription.txt`
- `consensus-report.md`
- `consensus-report.json`
- `consensus-review.md`

When the target is a batch root with multiple STT runs, `report` also writes:

- batch-root `consensus-report.md`

## OCR Reports

OCR reporting analyzes persisted provider artifacts under `providers/` and surfaces missing providers when the OCR run was incomplete.

OCR provider loading behavior:

- reads provider identity, timing/token metadata, and structured OCR results from provider `result.json`
- incomplete OCR runs are allowed as long as at least one provider artifact is analyzable

Per run, OCR reporting writes:

- `consensus-extraction.txt`
- `consensus-report.md`
- `consensus-report.json`
- `consensus-review.md`

When the target is a batch root with multiple OCR runs, `report` also writes:

- batch-root `consensus-report.md`

## Examples

```bash
# One STT run directory
bun as report output/2026-04-15_episode

# One OCR run directory
bun as report output/2026-04-15_scan

# STT batch root
bun as report output/2026-04-15_stt-batch

# OCR batch root
bun as report output/2026-04-15_ocr-batch
```

## Notes

- `report` has no public `stt` or `ocr` subcommands
- `report` does not expose a public format flag
- batch discovery only scans the immediate children of the supplied target directory
- STT runs write transcript-focused consensus artifacts; OCR runs write extraction-focused consensus artifacts
