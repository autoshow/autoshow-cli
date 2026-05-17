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
# Metadata only (no download)
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Metadata as Markdown frontmatter YAML
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# Download only
bun as download "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Extraction only (media routes to STT, documents to OCR, articles to URL extraction)
bun as extract "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Hosted Grok speech-to-text
bun as extract input/examples/audio/1-audio.mp3 --grok-stt speech-to-text

# Render a synced speaker transcript video from a previous media extract run
bun as extract output/<extract-run-dir> --transcript-video

# Render a transcript video from explicit local artifacts
bun as extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-result output/<extract-run-dir>/result.json

# Compare every URL article backend for one remote article
bun as extract https://example.com/article --all-url

# X Space metadata extraction (auto-detected, requires X_BEARER_TOKEN)
bun as extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# Full write pipeline: download/extract/transcribe + summary output
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --openai gpt-5.4

# Full write pipeline with Z.AI GLM 5.1
bun as write input/examples/audio/1-audio.mp3 --glm glm-5.1

# Full write pipeline with Kimi K2.6
bun as write input/examples/audio/1-audio.mp3 --kimi kimi-k2.6

# Document OCR / extraction
bun as extract input/examples/document/1-document.pdf --out json

# Hosted Kimi OCR for a document
bun as extract input/examples/document/1-document.pdf --kimi-ocr kimi-k2.6

# Standalone text-to-speech from local text
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts

# OpenAI custom voice from reference audio and an existing consent recording
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --openai-tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123

# ElevenLabs Instant Voice Cloning
bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_v3 --elevenlabs-tts-ref-audio input/examples/audio/anthony-voice.mp3

# ElevenLabs Professional Voice Clone synthesis
bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_v3 --elevenlabs-tts-pvc-voice pvc_voice_123

# Hosted Grok text-to-speech
bun as tts input/examples/tts/1-tts.md --grok-tts grok-tts --grok-tts-voice eve

# Hosted Mistral Voxtral text-to-speech
bun as tts input/examples/tts/1-tts.md --mistral-tts voxtral-mini-tts-2603 --mistral-tts-ref-audio input/examples/audio/anthony-voice.mp3

# MiniMax hosted text-to-speech
bun as tts input/examples/tts/1-tts.md --minimax-tts speech-2.8-turbo --minimax-tts-voice English_expressive_narrator

# Hume Octave 2 text-to-speech
bun as tts input/examples/tts/1-tts.md --hume-tts octave-2 --hume-tts-voice "Male English Actor"

# Cartesia Sonic text-to-speech
bun as tts input/examples/tts/1-tts.md --cartesia-tts sonic-3.5 --cartesia-tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02

# deAPI Qwen3 voice cloning
bun as tts input/examples/tts/1-tts.md --deapi-tts Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/0-audio-short.mp3

# Prompt-driven generation
bun as image "a dramatic fox portrait in snow" --minimax-image image-01
bun as image "a cinematic product photo of a red enamel camping mug" --bfl-image flux-2-pro-preview --image-size 1024x1024
bun as video "a timelapse storm over downtown chicago" --gemini-video veo-3.1-lite-generate-preview --runway-video gen4.5
bun as music "an ambient piano instrumental" --minimax-music music-2.5
bun as music "bright 90s pop rock with a huge chorus" --gemini-music lyria-3-clip-preview
bun as music --audio input/examples/lyrics/01-example-song.mp3
bun as extract output/<extract-run-dir> --transcript-video

# Fetch curated OpenAI docs into project/links/openai-all-links.md
bun as links --openai

# Fetch curated Kimi docs into project/links/kimi-all-links.md
bun as links --kimi

# Fetch STT docs across providers into project/links/all-stt-links.md
bun as links stt

# Fetch docs listed in a local URL file into project/links/urls-links.md
bun as links urls.md
```

## Command Map

| Area | Commands |
|------|----------|
| Inspect and process | `metadata`, `download`, `extract`, `write` |
| Generate | `tts`, `image`, `video`, `music` |
| Setup & Utilities | `config`, `cache`, `setup`, `links`, `resume`, `benchmark` |

High-value notes:

- `write` is the central orchestration command. It can summarize transcripts or extracted documents, write JSON outputs, fan out across multiple LLM providers, and optionally continue into TTS, image, video, or music generation.
- `setup --models` lets you pre-download local runtimes without running inference, for example `bun as setup --models tiny` or `bun as setup --models ggml-org/gemma-3-270m-it-GGUF`.
- `setup --sample` generates or validates the deterministic fixture set used by tests.
- If YouTube starts blocking `yt-dlp`, follow [docs/cookies.md](./docs/cookies.md) to configure `YTDLP_COOKIES_FROM_BROWSER` or `YTDLP_COOKIES`.

## Usage Basics

Use command-first order for all examples and scripts:

```bash
bun as <command> [input] [flags]
bun as help <command>       # preferred targeted help
bun as <command> --help
bun as --version
```

- Use `bun as extract <input> --whisper-stt tiny`, not `bun as --whisper-stt tiny extract <input>`.
- Inputs can be URLs, local files, directories, `.md`/`.txt` URL lists, or prompt strings for `image`, `video`, and `music`.
- If an input begins with `-`, end flag parsing first: `bun as write -- -myfile`.
- If the literal input collides with a command name, use the explicit command form: `bun as metadata setup`.

### Batch Inputs

Batch mode is selected from the input type rather than a separate subcommand:

```bash
# Newline-delimited URLs
bun as write input/examples/batch/2-urls.md

# Process files plus 2-urls.md inside the directory
bun as extract input

# Process local files in an input subdirectory
bun as extract input/examples/document
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
bun as config --openai gpt-5.4 --batch-limit 20 --max-cents 50
bun as config --elevenlabs-tts eleven_v3 --elevenlabs-tts-ref-audio input/examples/audio/anthony-voice.mp3
bun as config --elevenlabs-tts eleven_v3 --elevenlabs-tts-pvc-voice pvc_voice_123
bun as config --minimax-tts speech-2.8-turbo --minimax-tts-voice English_expressive_narrator
bun as config --hume-tts octave-2 --hume-tts-voice "Male English Actor"
bun as config --cartesia-tts sonic-3.5 --cartesia-tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun as config --deapi-tts Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/0-audio-short.mp3
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
NO_COLOR=1                 # disable ANSI color in human logs and help
FORCE_COLOR=1              # force ANSI color in redirected output
```

- `AUTOSHOW_LOG_FORMAT=auto` uses JSON logs when `NODE_ENV=production`, otherwise human-readable logs.
- Human-readable logs color table columns and log prefixes when output is a TTY; `NO_COLOR` disables this and `FORCE_COLOR` enables it for captured output.
- JSON logs and `--json` output stay machine-readable and uncolored.
- Secrets and credentials are redacted from logger output.

## Output Layout

Most artifact-producing runs write a timestamped directory under `output/` with `run.json` plus the files for the steps that actually ran.

Typical artifacts include:

- downloaded media or normalized documents
- `prompt.md`
- `transcription.txt`
- extracted text or OCR output
- `providers/<backend>/extraction.txt` and `providers/<backend>/result.json` for `extract <url> --all-url`
- `text.json`
- generated speech, image, video, or music files
- `run.json`
- `metadata.md` for `metadata --markdown --save`

`extract` batches write a parent `extract-batch.json` plus nested `media/`, `document/`, and `x-space/` child batches when those routed items are present. Other batch runs write `batch.json`, and some structured remote sources add `source.json`.

Notable exceptions:

- `metadata --save` reports `run.json`, and `metadata --markdown --save` also reports `metadata.md`
- `links` writes to a selection-based file under `project/links/`, for example `project/links/all-all-links.md`
- utility commands such as `config`, `setup`, and `links` do not use the `output/` run-directory pattern

## Development

```bash
bun run check
bun t
```

- `bun t` uses the repo's custom test runner and performs setup/sample preflight, so run `bun as setup` first if local dependencies are missing.
- `bun as setup --sample --verify-only` validates the deterministic fixture set used by tests.
