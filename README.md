# autoshow-bun-cli

CLI tool for processing media and documents with transcription, extraction, and write workflows on Bun.

## Quick Start

```bash
bun install
bun as setup
```

Top 3 workflows:

```bash
# 1) Transcribe media only (creates transcription + prompt, no summary)
bun as transcribe "https://www.youtube.com/watch?v=u1-WHqATSQU"

# 2) Full write pipeline for media (transcription + prompt + summary)
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --llama ggml-org/gemma-3-4b-it-GGUF

# 3) Document OCR/extraction only
bun as extract "input/1-document.pdf" --out json
```

## Canonical Usage

Use command-first order for all examples and scripts:

```bash
bun as <command> [parameters] [flags]
bun as <input> [flags]              # root shorthand (equivalent to write)
bun as --help                       # global help
bun as <command> --help             # command help
bun as help <command>               # targeted help (preferred)
bun as --version                    # version
```

Unsupported argument orders (fail with usage errors):

```bash
bun as --help write
bun as --whisper transcribe <input>
bun as --version write
```

Version note: use `bun as --version` as the global version command.

Use instead:

```bash
bun as help write
bun as transcribe <input> --whisper tiny
bun as --version
```

## Logging Controls

Logger behavior is controlled by environment variables:

```bash
# auto | human | json | both
AUTOSHOW_LOG_FORMAT=auto

# debug | info | success | warn | error
AUTOSHOW_LOG_LEVEL=info
```

- `AUTOSHOW_LOG_FORMAT=auto` uses JSON logs when `NODE_ENV=production`, otherwise human-readable logs.
- `AUTOSHOW_LOG_FORMAT=both` emits both human and JSON log streams.
- Secrets and credentials are redacted from logger output automatically.

## Commands

### transcribe

Download audio and transcribe only (creates `prompt.md`, skips summary):

```bash
bun as transcribe "URL"
bun as transcribe "/path/to/local-file.ext"
bun as transcribe "/path/to/2-urls.md"
bun as transcribe "/path/to/media-directory"
bun as transcribe input/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize
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
bun as write "input/1.mp3"
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

### extract

Extract text from PDF/EPUB/image files:

```bash
bun as extract input/document.epub
bun as extract input/scanned.pdf --lang eng+fra
bun as extract input/encrypted.pdf --password secret
bun as extract input/1-document.png --lang eng
```

### setup

Install system/runtime dependencies used by the CLI:

```bash
bun as setup
```

## Root Shorthand and Collisions

- `bun as <input>` is shorthand for `bun as write <input>`.
- `bun as setup` resolves to the `setup` command, not an input named `setup`.
- If the literal input is `setup`, use `bun as write setup`.

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
- Directory named `input` such as `bun as transcribe input` or `bun as write /tmp/job/input` processes local files plus `2-urls.md` in that directory.
- Any other directory such as `bun as transcribe /tmp/job/files` processes local files only.
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
