# autoshow-bun-cli

CLI tool for processing media and documents with transcription, extraction, and write workflows on Bun.

## Quick Start

```bash
bun install
bun as setup
```

Top 4 workflows:

```bash
# 1) Collect metadata only (default command, no download)
bun as "https://www.youtube.com/watch?v=u1-WHqATSQU"

# 2) Transcribe media only (creates transcription + prompt, no summary)
bun as stt "https://www.youtube.com/watch?v=u1-WHqATSQU"

# 3) Full write pipeline for media (transcription + prompt + summary)
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --llama ggml-org/gemma-3-4b-it-GGUF

# 4) Document OCR/extraction only
bun as ocr "input/1-document.pdf" --out json
```

## Canonical Usage

Use command-first order for all examples and scripts:

```bash
bun as <command> [parameters] [flags]
bun as <input> [flags]              # root shorthand (equivalent to metadata)
bun as --help                       # global help
bun as --help write                 # show help for write
bun as <command> --help             # command help
bun as help <command>               # targeted help (preferred)
bun as --version                    # version
bun as setup --doctor               # check prerequisites and config
```

Unsupported argument orders (fail with usage errors):

```bash
bun as --whisper stt <input>
```

Use instead:

```bash
bun as stt <input> --whisper tiny
```

## Logging Controls

Control log output with CLI flags or environment variables:

```bash
# CLI flags (override env vars)
bun as write input/1-audio.mp3 --verbose   # debug-level logging
bun as write input/1-audio.mp3 --quiet     # errors only
bun as write input/1-audio.mp3 --json      # structured JSON output
```

```bash
# Environment variables
AUTOSHOW_LOG_FORMAT=auto   # auto | human | json | both
AUTOSHOW_LOG_LEVEL=info    # debug | info | success | warn | error
```

- `--verbose` sets log level to `debug`, `--quiet` sets it to `error`, `--json` switches to JSON output.
- `AUTOSHOW_LOG_FORMAT=auto` uses JSON logs when `NODE_ENV=production`, otherwise human-readable logs.
- `AUTOSHOW_LOG_FORMAT=both` emits both human and JSON log streams.
- Secrets and credentials are redacted from logger output automatically.

## Commands

### metadata

Collect and display metadata for media or documents without downloading. Default command. Aliases: `meta`, `info`.

```bash
bun as "URL"                              # default command
bun as metadata "URL"                     # explicit
bun as metadata "URL" --save              # save metadata.json to disk
bun as metadata "/path/to/local-file.ext"
bun as metadata "/path/to/document.pdf" --password secret
```

### stt

Download audio and transcribe only (creates `prompt.md`, skips summary). Alias: `transcribe`.

```bash
bun as stt "URL"
bun as stt "/path/to/local-file.ext"
bun as stt "/path/to/2-urls.md"
bun as stt "/path/to/media-directory"
bun as stt input/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize
```

### write

Download audio, transcribe, and generate summary artifacts:

```bash
bun as write "URL" [flags]
bun as write "/path/to/local-file.ext" [flags]
bun as write "/path/to/2-urls.md" [flags]
bun as write "/path/to/media-directory" [flags]
```

Examples:

```bash
bun as write "input/1-audio.mp3"
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --openai gpt-5.2
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --whisper tiny --llama ggml-org/gemma-3-4b-it-GGUF
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --reverb --reverb-verbatimicity 1.0 --llama ggml-org/Phi-4-GGUF
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --split --llama ggml-org/gemma-3-4b-it-GGUF
```

### tts

Generate speech from local markdown/txt files:

```bash
bun as tts input/1-tts.md --openai-tts gpt-4o-mini-tts
bun as tts input/1-tts.md --gemini-tts gemini-2.5-flash-preview-tts
```

### ocr

Extract text from PDF/EPUB/image files. Alias: `extract`.

```bash
bun as ocr input/document.epub
bun as ocr input/scanned.pdf --lang eng+fra
bun as ocr input/encrypted.pdf --password secret
bun as ocr input/1-document.png --lang eng
```

### setup

Install system/runtime dependencies used by the CLI:

```bash
bun as setup
```

### Doctor

Check prerequisites, API keys, and configuration without installing anything:

```bash
bun as setup --doctor
```

### Dry Run

Preview what a command would do without executing:

```bash
bun as write input/1-audio.mp3 --openai gpt-5.2 --dry-run
bun as stt input/1-audio.mp3 --elevenlabs-stt scribe_v2 --dry-run
```

`--dry-run` is equivalent to `--price` — it shows the cost estimate and expected output files, then exits.

## Root Shorthand and Collisions

- `bun as <input>` is shorthand for `bun as metadata <input>`.
- `bun as setup` resolves to the `setup` command, not an input named `setup`.
- If the literal input is `setup`, use `bun as metadata setup`.

If an input starts with `-`, end flag parsing with `--`:

```bash
bun as write -- -myfile
```

## Batch Input Detection

Create `input/2-urls.md` as newline-delimited URLs:

```text
https://www.youtube.com/watch?v=MORMZXEaONk
https://www.youtube.com/watch?v=u1-WHqATSQU
```

Batch behavior is selected from the input type:

- URL-list file (`.md`/`.txt`) such as `bun as write input/2-urls.md` processes URLs from that file.
- Directory named `input` such as `bun as stt input` or `bun as write /tmp/job/input` processes local files plus `2-urls.md` in that directory.
- Any other directory such as `bun as stt /tmp/job/files` processes local files only.
- `urls`, `files`, and `input` are no longer reserved aliases; they are treated as normal paths/tokens.

Batch runs produce:

```text
./output/
  YYYY-MM-DD_HH-MM-SS_label/
    info.json
    YYYY-MM-DD_HH-MM-SS_item-title/
      ...
```

## Testing

```bash
bun test
```
