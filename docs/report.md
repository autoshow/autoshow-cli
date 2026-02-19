# Report CLI

Generate, view, and compare setup/runtime performance reports for AutoShow CLI.

## Commands

### `setup` - Setup + Model Preparation Timing (TTS only)

Measures setup command execution and model/download readiness preparation.

```bash
bun .github/report/cli.ts setup <setup-command> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--fresh` | Remove marker files before running to force a complete setup |
| `--model <model>` | Model to use for setup/model preparation |

**Examples:**

```bash
bun .github/report/cli.ts setup setup:tts:qwen3 --fresh
bun .github/report/cli.ts setup setup:tts:chatterbox --model standard
bun .github/report/cli.ts setup setup:tts:fish --model s1-mini
bun .github/report/cli.ts setup setup:tts:cosyvoice --model CosyVoice-300M-Instruct
```

### `runtime` - Ready Runtime Timing (TTS only)

Measures warm-up and measured TTS generation after setup is already ready.

```bash
bun .github/report/cli.ts runtime <setup-command> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--input <file>` | Use a custom input file for runtime timing |
| `--model <model>` | Model to use for runtime timing |

**Important precondition:**
- `runtime` requires a successful matching `setup` report first.
- If readiness is missing, the command fails with guidance.
- For `setup:tts:fish`, Docker daemon availability is required for ready runtime timing.

**Examples:**

```bash
# 1) setup timing + readiness marker
bun .github/report/cli.ts setup setup:tts:qwen3 --fresh

# 2) runtime timing (warm-up + measured)
bun .github/report/cli.ts runtime setup:tts:qwen3 --input input/sample.md
bun .github/report/cli.ts runtime setup:tts:qwen3 --input input/story.md
```

### `run` - Legacy Combined Report

Legacy mode that runs setup and optional post-setup test in one report.

```bash
bun .github/report/cli.ts run <setup-command> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--fresh` | Remove marker files before running to force a complete setup |
| `--skip-test` | Skip the post-setup test run |
| `--input <file>` | Use a custom input file for the test run |
| `--model <model>` | Model to use for the test run |

**Examples:**

```bash
bun .github/report/cli.ts run setup:tts:fish --input input/sample.md
bun .github/report/cli.ts run setup:transcription --input input/audio.mp3
```

### `list` - List Report Types or Existing Reports

```bash
bun .github/report/cli.ts list
bun .github/report/cli.ts list --reports
bun .github/report/cli.ts list --reports --json
```

### `view` - View a Report

```bash
bun .github/report/cli.ts view <name>
bun .github/report/cli.ts view <name> --json
bun .github/report/cli.ts view <name> --markdown
```

### `compare` - Compare Two Reports

```bash
bun .github/report/cli.ts compare <report1> <report2>
bun .github/report/cli.ts compare <report1> <report2> --json
bun .github/report/cli.ts compare <report1> <report2> --markdown
```

**Note:** compare requires both reports to be the same type (`setup/setup`, `runtime/runtime`, or `run/run`).

## Supported Setup Commands

| Command | Type | Split Reporting |
|---------|------|-----------------|
| `setup:tts:qwen3` | TTS | Yes (`setup`, `runtime`, `run`) |
| `setup:tts:chatterbox` | TTS | Yes (`setup`, `runtime`, `run`) |
| `setup:tts:fish` | TTS | Yes (`setup`, `runtime`, `run`) |
| `setup:tts:cosyvoice` | TTS | Yes (`setup`, `runtime`, `run`) |
| `setup:transcription` | Transcription | Legacy only (`run`) |
| `setup:tts` | TTS base env | Legacy only (`run`) |

## Package.json Scripts

```bash
# CLI
bun report
bun report:list --reports

# Split setup reports (TTS only)
bun report:setup:tts:qwen3
bun report:setup:tts:chatterbox
bun report:setup:tts:fish
bun report:setup:tts:cosyvoice
bun report:setup:tts

# Split runtime reports (TTS only)
bun report:runtime:tts:qwen3
bun report:runtime:tts:chatterbox
bun report:runtime:tts:fish
bun report:runtime:tts:cosyvoice
bun report:runtime:tts

# Backward-compatible wrappers (setup + runtime)
bun report:tts:qwen3
bun report:tts:chatterbox
bun report:tts:fish
bun report:tts:cosyvoice
bun report:tts
```

## Report Contents

### Setup Report (`reportType=setup`)
- Setup duration and phases
- Storage changes
- Downloads/sources
- Model preparation timing (`python-prefetch`, `asset-check`, or `docker-health-check`)
- Readiness marker metadata for runtime precondition

### Runtime Report (`reportType=runtime`)
- Warm-up run metrics
- Measured run metrics (benchmark run)
- Throughput metrics (chars/sec, words/sec)
- Real-time ratio

### Legacy Run Report (`reportType=run`)
- Combined setup metrics
- Optional single post-setup test run

## Output Files

Reports are saved under type + status directories:

| Type | Directory |
|------|-----------|
| Setup | `reports/setup/success` or `reports/setup/failed` |
| Runtime | `reports/runtime/success` or `reports/runtime/failed` |
| Legacy run | `reports/run/success` or `reports/run/failed` |

Each report writes:
- JSON: `<timestamp>-<command>-<model>-<input>.json`
- Markdown: `<timestamp>-<command>-<model>-<input>.md`
