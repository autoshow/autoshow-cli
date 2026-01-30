# Report CLI

Generate, view, and compare detailed setup reports for AutoShow CLI.

## Quick Start

```bash
# Generate a report for a setup command
bun report:run setup:tts:fish --input input/sample.md

# List existing reports
bun report:list --reports

# View a report
bun report view tts-fish-sample-2026-01-30

# Compare two reports
bun report compare tts-fish-sample tts-qwen3-sample
```

## Commands

### `run` - Generate a Report

Run a setup command and generate a detailed report with metrics.

```bash
bun .github/report/cli.ts run <setup-command> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--fresh` | Remove marker files before running to force a complete setup |
| `--skip-test` | Skip the post-setup test run |
| `--input <file>` | Use a custom input file for the test run |

**Examples:**

```bash
# Basic report generation
bun .github/report/cli.ts run setup:tts:fish

# Fresh run (removes cached setup markers)
bun .github/report/cli.ts run setup:tts:qwen3 --fresh

# Skip the test run after setup
bun .github/report/cli.ts run setup:tts:chatterbox --skip-test

# Use a custom input file for testing
bun .github/report/cli.ts run setup:tts:fish --input input/story.md
```

**Available Setup Commands:**

| Command | Type | Default Input |
|---------|------|---------------|
| `setup:tts:qwen3` | TTS | `input/sample.md` |
| `setup:tts:chatterbox` | TTS | `input/sample.md` |
| `setup:tts:fish` | TTS | `input/sample.md` |
| `setup:tts:cosyvoice` | TTS | `input/sample.md` |
| `setup:transcription` | Transcription | `input/audio.mp3` |
| `setup:tts` | TTS | `input/sample.md` |

### `list` - List Reports

List available report types or existing reports.

```bash
bun .github/report/cli.ts list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--reports` | List existing reports instead of report types |
| `--json` | Output as JSON |

**Examples:**

```bash
# List available setup commands
bun .github/report/cli.ts list

# List existing reports
bun .github/report/cli.ts list --reports

# Get reports as JSON (for scripting)
bun .github/report/cli.ts list --reports --json
```

### `view` - View a Report

Display details of a specific report.

```bash
bun .github/report/cli.ts view <name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--markdown` | Output as Markdown |

**Examples:**

```bash
# View report summary
bun .github/report/cli.ts view tts-fish-sample-2026-01-30

# Partial name matching (if unique)
bun .github/report/cli.ts view qwen3

# Get full JSON report
bun .github/report/cli.ts view tts-fish-sample --json

# Get Markdown report
bun .github/report/cli.ts view tts-fish-sample --markdown
```

### `compare` - Compare Reports

Compare metrics between two reports.

```bash
bun .github/report/cli.ts compare <report1> <report2> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--markdown` | Output as Markdown |

**Examples:**

```bash
# Compare two reports
bun .github/report/cli.ts compare tts-fish-sample tts-fish-story

# Compare different TTS engines
bun .github/report/cli.ts compare tts-fish-sample tts-qwen3-sample

# Get comparison as JSON
bun .github/report/cli.ts compare fish qwen3 --json
```

## Package.json Scripts

Convenient shortcuts are available in `package.json`:

```bash
# Main CLI
bun report                    # Shows help
bun report:run               # Shortcut for run command
bun report:list              # Shortcut for list command

# Quick TTS reports
bun report:tts:fish          # Fish Audio report with sample.md
bun report:tts:qwen3         # Qwen3 report (sample + story)
bun report:tts:chatterbox    # Chatterbox report (sample + story)
bun report:tts:cosyvoice     # CosyVoice report (sample + story)
bun report:tts               # All TTS reports
```

## Report Contents

Each report captures:

### Setup Metrics
- **Duration**: Total time for setup
- **Storage Added**: Disk space used by new files
- **Phases**: Installation phases detected from logs
- **Downloads**: External resources fetched (git repos, pip packages, models)
- **Errors**: Any errors encountered during setup

### Test Run Metrics (if not skipped)
- **Generation Time**: Time to process input
- **Input Stats**: Character count, word count
- **Output Stats**: File path, size, audio duration
- **Performance**: Characters/second, words/second
- **Real-time Ratio**: Audio duration vs generation time

### Environment Info
- Platform (darwin, linux)
- Architecture (arm64, x64)
- Bun version
- Working directory

## Output Files

Reports are saved to the `reports/` directory in two formats:

| Format | File | Purpose |
|--------|------|---------|
| JSON | `<command>-<input>-<timestamp>.json` | Machine-readable, full data |
| Markdown | `<command>-<input>-<timestamp>.md` | Human-readable, for documentation |

**Example filenames:**
```
reports/tts-fish-sample-2026-01-30T19-29-06.json
reports/tts-fish-sample-2026-01-30T19-29-06.md
```

## Use Cases

### Benchmarking TTS Engines

Compare performance across different TTS engines:

```bash
# Generate reports for each engine
bun .github/report/cli.ts run setup:tts:fish --input input/sample.md
bun .github/report/cli.ts run setup:tts:qwen3 --input input/sample.md
bun .github/report/cli.ts run setup:tts:chatterbox --input input/sample.md

# Compare results
bun .github/report/cli.ts compare fish qwen3
bun .github/report/cli.ts compare fish chatterbox
```

### Testing Different Input Sizes

Measure performance with different content lengths:

```bash
# Short content
bun .github/report/cli.ts run setup:tts:fish --input input/sample.md

# Long content
bun .github/report/cli.ts run setup:tts:fish --input input/story.md

# Compare
bun .github/report/cli.ts compare tts-fish-sample tts-fish-story
```

### Fresh vs Cached Setup

Compare fresh installation vs cached run:

```bash
# Cached run (uses existing markers)
bun .github/report/cli.ts run setup:tts:fish

# Fresh run (removes markers first)
bun .github/report/cli.ts run setup:tts:fish --fresh

# Compare setup times
bun .github/report/cli.ts list --reports
```

### CI/CD Integration

Generate reports in CI pipelines:

```bash
# Generate report with JSON output
bun .github/report/cli.ts run setup:tts:fish --skip-test

# Check report programmatically
bun .github/report/cli.ts view tts-fish --json | jq '.success'

# Compare against baseline
bun .github/report/cli.ts compare current-report baseline-report --json
```

## Report Comparison Output

The compare command shows a side-by-side comparison:

```
======================================================================
Report Comparison
======================================================================

Metric              Report 1                 Report 2                 Difference
----------------------------------------------------------------------
Command             setup:tts:fish           setup:tts:fish
Date                1/30/2026, 1:19:02 PM    1/30/2026, 1:29:09 PM
Status              Success                  Success
Duration            1m 12.6s                 1m 11.9s                 760ms
Storage Added       853.91 MB                853.94 MB                +26.02 KB
Phases              1                        1                        0
Downloads           0                        0                        0
Errors              0                        0                        0

----------------------------------------------------------------------
Test Run Comparison
----------------------------------------------------------------------
Generation Time     8m 51.4s                 126m 8.3s                +117m 17.0s
Chars/Second        0.2                      0.3                      +0.1
Real-time Ratio     0.01x                    0.00x                    -0.01x
```

## Troubleshooting

### Report Not Found

If `view` can't find a report:

```bash
# List all reports to see exact names
bun .github/report/cli.ts list --reports

# Use full name
bun .github/report/cli.ts view tts-fish-sample-2026-01-30T19-29-06
```

### Multiple Matches

If partial name matches multiple reports:

```bash
# Error: Multiple reports match 'fish'
# Solution: Be more specific
bun .github/report/cli.ts view tts-fish-sample-2026-01-30
```

### Fresh Run Not Working

If `--fresh` doesn't trigger a full reinstall:

```bash
# Check which markers exist
ls -la build/config/

# Manually remove all markers
rm -f build/config/.*-installed

# Run fresh
bun .github/report/cli.ts run setup:tts:fish --fresh
```

## Architecture

The Report CLI is organized as a modular TypeScript application:

```
.github/report/
├── cli.ts                    # Main entry point (Commander.js)
├── types.ts                  # TypeScript interfaces
├── constants.ts              # Configuration constants
├── commands/
│   ├── run.ts                # Run setup and generate report
│   ├── list.ts               # List reports/report types
│   ├── view.ts               # View a specific report
│   └── compare.ts            # Compare two reports
└── lib/
    ├── filesystem-tracker.ts # FileSystemTracker class
    ├── output-parser.ts      # OutputParser class
    ├── test-runner.ts        # Test execution logic
    ├── report-generator.ts   # JSON + Markdown generation
    ├── marker-manager.ts     # Marker file operations
    ├── formatters.ts         # formatBytes, formatDuration, etc.
    └── utils.ts              # fileExists, ensureDir, etc.
```
