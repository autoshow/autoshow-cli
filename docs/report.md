# Report CLI

Generate, view, and compare detailed setup reports for AutoShow CLI.

## Commands

### `run` - Generate a Report

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

**Available Setup Commands:**

| Command | Type | Default Input |
|---------|------|---------------|
| `setup:tts:qwen3` | TTS | `input/sample.md` |
| `setup:tts:chatterbox` | TTS | `input/sample.md` |
| `setup:tts:fish` | TTS | `input/sample.md` |
| `setup:tts:cosyvoice` | TTS | `input/sample.md` |
| `setup:transcription` | Transcription | `input/audio.mp3` |
| `setup:tts` | TTS | `input/sample.md` |

**All Command Variations:**

```bash
# Basic
bun .github/report/cli.ts run <setup-command>
bun .github/report/cli.ts run <setup-command> --fresh
bun .github/report/cli.ts run <setup-command> --skip-test
bun .github/report/cli.ts run <setup-command> --input <file>
bun .github/report/cli.ts run <setup-command> --model <model>
bun .github/report/cli.ts run <setup-command> --fresh --skip-test
bun .github/report/cli.ts run <setup-command> --fresh --input <file>
bun .github/report/cli.ts run <setup-command> --fresh --model <model>
bun .github/report/cli.ts run <setup-command> --skip-test --input <file>
bun .github/report/cli.ts run <setup-command> --skip-test --model <model>
bun .github/report/cli.ts run <setup-command> --input <file> --model <model>
bun .github/report/cli.ts run <setup-command> --fresh --skip-test --input <file>
bun .github/report/cli.ts run <setup-command> --fresh --skip-test --model <model>
bun .github/report/cli.ts run <setup-command> --fresh --input <file> --model <model>
bun .github/report/cli.ts run <setup-command> --skip-test --input <file> --model <model>
bun .github/report/cli.ts run <setup-command> --fresh --skip-test --input <file> --model <model>
```

### `list` - List Reports

```bash
bun .github/report/cli.ts list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--reports` | List existing reports instead of report types |
| `--json` | Output as JSON |

**All Command Variations:**

```bash
bun .github/report/cli.ts list
bun .github/report/cli.ts list --reports
bun .github/report/cli.ts list --json
bun .github/report/cli.ts list --reports --json
```

### `view` - View a Report

```bash
bun .github/report/cli.ts view <name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--markdown` | Output as Markdown |

**All Command Variations:**

```bash
bun .github/report/cli.ts view <name>
bun .github/report/cli.ts view <name> --json
bun .github/report/cli.ts view <name> --markdown
```

### `compare` - Compare Reports

```bash
bun .github/report/cli.ts compare <report1> <report2> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--markdown` | Output as Markdown |

**All Command Variations:**

```bash
bun .github/report/cli.ts compare <report1> <report2>
bun .github/report/cli.ts compare <report1> <report2> --json
bun .github/report/cli.ts compare <report1> <report2> --markdown
```

## Package.json Scripts

```bash
# Main CLI
bun report                    # Shows help
bun report:run <args>         # Shortcut for run command
bun report:list <args>        # Shortcut for list command

# Quick TTS reports
bun report:tts:fish          # Fish Audio report with sample.md
bun report:tts:qwen3         # Qwen3 report (sample + story)
bun report:tts:chatterbox    # Chatterbox report (sample + story)
bun report:tts:cosyvoice     # CosyVoice report (sample + story)
bun report:tts               # All TTS reports
```

## TTS Models Reference

### Chatterbox Models

| Model | Flag | Size | Notes |
|-------|------|------|-------|
| turbo | `--chatterbox-model turbo` | ~800MB | Default, fastest |
| standard | `--chatterbox-model standard` | ~800MB | Supports exaggeration and CFG weight |

**All Chatterbox Combinations:**

```bash
# Turbo model (default)
bun .github/report/cli.ts run setup:tts:chatterbox
bun .github/report/cli.ts run setup:tts:chatterbox --model turbo

# Standard model
bun .github/report/cli.ts run setup:tts:chatterbox --model standard
```

### Qwen3 Models

| Model | Flag | Size | Streaming | Features |
|-------|------|------|-----------|----------|
| Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice | `--qwen3-model Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` | ~1.2GB | No | Default, lightweight, pre-built voices |
| Qwen/Qwen3-TTS-12Hz-0.6B-Base | `--qwen3-model Qwen/Qwen3-TTS-12Hz-0.6B-Base` | ~1.2GB | No | Lightweight, voice cloning |
| Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice | `--qwen3-model Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` | ~3GB | Yes | Pre-built voices, streaming |
| Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign | `--qwen3-model Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` | ~3GB | Yes | Voice design from descriptions |
| Qwen/Qwen3-TTS-12Hz-1.7B-Base | `--qwen3-model Qwen/Qwen3-TTS-12Hz-1.7B-Base` | ~3GB | No | Voice cloning |

**All Qwen3 Combinations:**

```bash
# 0.6B CustomVoice (default)
bun .github/report/cli.ts run setup:tts:qwen3
bun .github/report/cli.ts run setup:tts:qwen3 --model Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice

# 0.6B Base (voice cloning)
bun .github/report/cli.ts run setup:tts:qwen3 --model Qwen/Qwen3-TTS-12Hz-0.6B-Base

# 1.7B CustomVoice (streaming)
bun .github/report/cli.ts run setup:tts:qwen3 --model Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice

# 1.7B VoiceDesign (voice design from descriptions)
bun .github/report/cli.ts run setup:tts:qwen3 --model Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign

# 1.7B Base (voice cloning)
bun .github/report/cli.ts run setup:tts:qwen3 --model Qwen/Qwen3-TTS-12Hz-1.7B-Base
```

### Fish Audio Models

| Model | Flag | Size | Features |
|-------|------|------|----------|
| s1-mini | `--fish-model s1-mini` | ~2GB | 0.5B parameters, default, open-source |
| s1 | `--fish-model s1` | ~8GB | 4B parameters, best quality and stability |

**All Fish Audio Combinations:**

```bash
# s1-mini (default)
bun .github/report/cli.ts run setup:tts:fish
bun .github/report/cli.ts run setup:tts:fish --model s1-mini

# s1 (best quality)
bun .github/report/cli.ts run setup:tts:fish --model s1
```

### CosyVoice Models

| Model | Flag | Size | Features |
|-------|------|------|----------|
| Fun-CosyVoice3-0.5B | `--cosyvoice-model Fun-CosyVoice3-0.5B` | ~500MB | Latest V3, best quality, 9 languages, 18+ dialects |
| CosyVoice2-0.5B | `--cosyvoice-model CosyVoice2-0.5B` | ~500MB | Version 2, high quality |
| CosyVoice-300M | `--cosyvoice-model CosyVoice-300M` | ~300MB | Base model |
| CosyVoice-300M-SFT | `--cosyvoice-model CosyVoice-300M-SFT` | ~300MB | Fine-tuned with predefined speakers |
| CosyVoice-300M-Instruct | `--cosyvoice-model CosyVoice-300M-Instruct` | ~300MB | Default, instruction-following |
| CosyVoice-ttsfrd | `--cosyvoice-model CosyVoice-ttsfrd` | ~300MB | Text normalization resources |

**All CosyVoice Combinations:**

```bash
# CosyVoice-300M-Instruct (default)
bun .github/report/cli.ts run setup:tts:cosyvoice
bun .github/report/cli.ts run setup:tts:cosyvoice --model CosyVoice-300M-Instruct

# Fun-CosyVoice3-0.5B (latest, best quality)
bun .github/report/cli.ts run setup:tts:cosyvoice --model Fun-CosyVoice3-0.5B

# CosyVoice2-0.5B (version 2)
bun .github/report/cli.ts run setup:tts:cosyvoice --model CosyVoice2-0.5B

# CosyVoice-300M (base)
bun .github/report/cli.ts run setup:tts:cosyvoice --model CosyVoice-300M

# CosyVoice-300M-SFT (fine-tuned)
bun .github/report/cli.ts run setup:tts:cosyvoice --model CosyVoice-300M-SFT

# CosyVoice-ttsfrd (text normalization)
bun .github/report/cli.ts run setup:tts:cosyvoice --model CosyVoice-ttsfrd
```

## Report Contents

### Setup Metrics
- Duration
- Storage Added
- Phases
- Downloads
- Errors

### Test Run Metrics
- Model
- Generation Time
- Input Stats (character count, word count)
- Output Stats (file path, size, audio duration)
- Performance (characters/second, words/second)
- Real-time Ratio (audio duration vs generation time)

### Environment Info
- Platform
- Architecture
- Bun version
- Working directory

## Output Files

Reports are saved to `reports/` directory:

| Format | Filename Pattern |
|--------|------------------|
| JSON | `<command>-<input>-<timestamp>.json` |
| Markdown | `<command>-<input>-<timestamp>.md` |

## Structure

```
.github/report/
├── cli.ts
├── types.ts
├── constants.ts
├── commands/
│   ├── run.ts
│   ├── list.ts
│   ├── view.ts
│   └── compare.ts
└── lib/
    ├── filesystem-tracker.ts
    ├── output-parser.ts
    ├── test-runner.ts
    ├── report-generator.ts
    ├── marker-manager.ts
    ├── formatters.ts
    └── utils.ts
```
