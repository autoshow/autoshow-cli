# autoshow-bun-cli

Bun-native CLI for turning media, documents, and text prompts into metadata, downloads, transcripts, OCR extracts, summaries, and generated speech, images, video, or music.

It supports both local and API-backed engines across STT, OCR, LLM, TTS, image, video, and music workflows. Defaults can be persisted in `config/autoshow.json`, and runnable commands perform cost preflight before execution.

For command-specific details, use `bun as help <command>` or browse the docs in [`docs/`](./docs/).

## Quick Start

```bash
bun install
bun as setup --doctor
bun as setup
```

- `setup --doctor` verifies prerequisites, API keys, and config without installing anything.
- Local workflows can run without service API keys; service-backed commands require the relevant provider credentials.

### YouTube Auth After Setup

If YouTube starts challenging `yt-dlp` requests with a bot-check or sign-in prompt, follow the exact browser-profile or `cookies.txt` setup commands in [docs/cookies.md](./docs/cookies.md).

Short version:

- `YTDLP_COOKIES_FROM_BROWSER=chrome` is the easiest path when yt-dlp can read your logged-in browser profile.
- `YTDLP_COOKIES=/absolute/path/to/cookies.txt` is the fallback when you want a dedicated Netscape cookie jar.
- `YTDLP_COOKIES` wins when it is set and readable; otherwise AutoShow uses `YTDLP_COOKIES_FROM_BROWSER`.

## Common Workflows

```bash
# Metadata only (default command, no download)
bun as "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Metadata as Markdown frontmatter YAML
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# Download only
bun as download "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Transcription only
bun as stt "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Full write pipeline: download/extract/transcribe + summary output
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --openai gpt-5.2

# Document OCR / extraction
bun as ocr input/examples/document/1-document.pdf --out json

# Standalone text-to-speech from local text
bun as tts input/examples/document/1-tts.md --openai-tts gpt-4o-mini-tts

# Prompt-driven generation
bun as image "a dramatic fox portrait in snow" --minimax-image image-01
bun as video "a timelapse storm over downtown chicago" --gemini-video veo-3.1-fast-generate-preview
bun as music "an ambient piano instrumental" --minimax-music music-2.5

# Fetch curated provider docs into docs/links/bun-links.md
bun as links --openai
```

## Command Map

| Area | Commands |
|------|----------|
| Inspect and process | `metadata`, `download`, `ocr`, `stt`, `write` |
| Generate | `tts`, `image`, `video`, `music` |
| Utilities | `config`, `cache`, `setup`, `sample`, `models`, `links` |

High-value notes:

- `bun as <input>` is shorthand for `bun as metadata <input>`.
- `write` is the central orchestration command. It can summarize transcripts or extracted documents, write markdown or structured JSON outputs, fan out across multiple LLM providers, and optionally continue into TTS, image, video, or music generation.
- `models` lets you pre-download local runtimes without running inference, for example `bun as models tiny` or `bun as models ggml-org/gemma-3-270m-it-GGUF`.
- If YouTube starts blocking `yt-dlp`, follow [docs/cookies.md](./docs/cookies.md) to configure `YTDLP_COOKIES_FROM_BROWSER` or `YTDLP_COOKIES`.
- `metadata` aliases: `meta`, `info`
- `download` alias: `dl`
- `stt` aliases: `transcribe`, `transcript`, `transcription`
- `ocr` aliases: `extract`, `document`
- `tts` alias: `voice`
- `write` aliases: `llm`, `llms`
- `sample` alias: `samples`

## Usage Basics

Use command-first order for all examples and scripts:

```bash
bun as <command> [input] [flags]
bun as <input>              # shorthand for metadata
bun as help <command>       # preferred targeted help
bun as <command> --help
bun as --version
```

- Use `bun as stt <input> --whisper tiny`, not `bun as --whisper tiny stt <input>`.
- Inputs can be URLs, local files, directories, `.md`/`.txt` URL lists, or prompt strings for `image`, `video`, and `music`.
- If an input begins with `-`, end flag parsing first: `bun as write -- -myfile`.
- If the literal input collides with a command name, use the explicit command form: `bun as metadata setup`.

### Batch Inputs

Batch mode is selected from the input type rather than a separate subcommand:

```bash
# Newline-delimited URLs
bun as write input/examples/document/2-urls.md

# Process files plus 2-urls.md inside the directory
bun as stt input

# Process only local files in a non-input directory
bun as ocr /tmp/job/files
```

Common batch controls:

- `--batch-limit`
- `--batch-all`
- `--batch-order newest|oldest`
- `--batch-concurrency`

## Config, Pricing, and Logging

Persistent defaults live in `config/autoshow.json`. You can save provider choices, model defaults, prompts, extract options, voices, batch settings, and pricing thresholds.

```bash
bun as config --show
bun as config --openai gpt-5.2 --batch-limit 20 --max-cents 50
bun as config --reset
```

Pricing and budget behavior:

- Runnable commands estimate cost before execution.
- `--price` is the estimate-only mode.
- `--allow-over-budget` overrides a configured hard budget for a single run.
- `--config-path` lets you use an alternate config file on any command.

Logging controls:

```bash
# CLI flags
bun as write input/examples/audio/1-audio.mp3 --verbose
bun as write input/examples/audio/1-audio.mp3 --quiet
bun as write input/examples/audio/1-audio.mp3 --json

# Environment variables
AUTOSHOW_LOG_FORMAT=auto   # auto | human | json | both
AUTOSHOW_LOG_LEVEL=info    # debug | info | success | warn | error
```

- `AUTOSHOW_LOG_FORMAT=auto` uses JSON logs when `NODE_ENV=production`, otherwise human-readable logs.
- Secrets and credentials are redacted from logger output.

## Output Layout

Most artifact-producing runs write a timestamped directory under `output/` with `run.json` plus the files for the steps that actually ran.

Typical artifacts include:

- downloaded media or normalized documents
- `prompt.md`
- `transcription.txt`
- extracted text or OCR output
- `text.json`
- generated speech, image, video, or music files
- `run.json`
- `metadata.md` for `metadata --markdown --save`

Batch runs write `batch.json`, and some structured remote sources add `source.json`.

Notable exceptions:

- `metadata --save` reports `run.json`, and `metadata --markdown --save` also reports `metadata.md`
- `links` writes to `docs/links/bun-links.md`
- utility commands such as `config`, `setup`, `sample`, and `models` do not use the `output/` run-directory pattern

## Development

```bash
bun run check
bun t
```

- `bun t` uses the repo's custom test runner and performs setup/sample preflight, so run `bun as setup` first if local dependencies are missing.
- `bun as sample --verify-only` validates the deterministic fixture set used by tests.
