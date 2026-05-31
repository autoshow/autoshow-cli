# autoshow-cli

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
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text

# Render a synced speaker transcript video from a previous media extract run
bun as extract output/<extract-run-dir> --transcript-video

# Render a transcript video from explicit local artifacts
bun as extract --transcript-video --audio https://ajc.pics/autoshow/examples/1-audio.mp3 --transcript-result output/<extract-run-dir>/result.json

# Compare every URL article backend for one remote article
bun as extract https://example.com/article --all-providers

# X Space metadata extraction (auto-detected, requires X_BEARER_TOKEN)
bun as extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# Full write pipeline: download/extract/transcribe + summary output
bun as write "https://www.youtube.com/watch?v=u1-WHqATSQU" --llm openai=gpt-5.5

# Full write pipeline with xAI Grok 4.3
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm grok=grok-4.3

# Full write pipeline with Z.AI GLM 5.1
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm glm=glm-5.1

# Full write pipeline with Kimi K2.6
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm kimi=kimi-k2.6

# Document OCR / extraction
bun as extract input/examples/document/1-document.pdf --format json

# Hosted Kimi OCR for a document
bun as extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6

# Hosted Grok OCR for a document
bun as extract input/examples/document/1-document.pdf --provider grok=grok-4.3

# Standalone text-to-speech from local text
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts

# OpenAI custom voice from reference audio and an existing consent recording
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123

# ElevenLabs Instant Voice Cloning
bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# Hosted Grok text-to-speech
bun as tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve

# Hosted Mistral Voxtral text-to-speech
bun as tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# MiniMax hosted text-to-speech
bun as tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator

# Hume Octave 2 text-to-speech
bun as tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"

# Cartesia Sonic text-to-speech
bun as tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02


# Prompt-driven generation, then edit/reference the generated image; run this block in order
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-1.5 --size 1024x1024 --format png --output-dir output/mug-base
bun as image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-1.5 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit
bun as image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-image-preview --input output/mug-base/generated-image.png --output-dir output/mug-gemini
bun as image "a cinematic product photo of a red enamel camping mug" --provider bfl=flux-2-pro --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl
bun as image "place the same mug in a minimalist editorial product scene" --provider reve=latest --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-reve

# Video from the generated image, then extend/edit the generated video; run this block after output/mug-base exists
bun as video "animate the red enamel mug on a slow turntable with glossy highlights" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/mug-base/generated-image.png --output-dir output/mug-video-base
bun as video "continue the turntable move as the mug rotates toward a warm kitchen window" --provider gemini=veo-3.1-fast-generate-preview --mode extend --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-extend
bun as video "make the lighting moonlit blue while keeping the mug motion intact" --provider grok=grok-imagine-video --mode edit --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-edit

bun as video "a timelapse storm over downtown chicago" --provider gemini=veo-3.1-lite-generate-preview --provider runway=gen4.5
bun as music "an ambient piano instrumental" --provider minimax=music-2.6
bun as music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-clip-preview
bun as music --audio input/examples/lyrics/01-example-song.mp3
bun as extract output/<extract-run-dir> --transcript-video

# Fetch curated OpenAI docs into project/links/openai-all-links.md
bun as links --openai

# Fetch Better Auth docs into project/links/better-auth-all-links.md
bun as links --better-auth

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
| Generate | `tts`, `image`, `video`, `music`, `comic` |
| Setup & Utilities | `config`, `cache`, `setup`, `sock`, `links`, `resume`, `benchmark` |

High-value notes:

- `write` is the central orchestration command. It can summarize transcripts or extracted documents, write JSON outputs, fan out across multiple LLM providers, and optionally continue into TTS, image, video, or music generation.
- `setup --models` lets you pre-download local runtimes without running inference, for example `bun as setup --models tiny` or `bun as setup --models ggml-org/gemma-3-270m-it-GGUF`.
- If YouTube starts blocking `yt-dlp`, follow [docs/cookies.md](./docs/cookies.md) to configure `YTDLP_COOKIES_FROM_BROWSER` or `YTDLP_COOKIES`.

## Usage Basics

Use command-first order for all examples and scripts:

```bash
bun as <command> [input] [flags]
bun as help <command>       # preferred targeted help
bun as <command> --help
bun as --version
```

- Use `bun as extract <input> --provider whisper=tiny`, not `bun as --provider whisper=tiny extract <input>`.
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
bun as config --llm openai=gpt-5.5 --batch-limit 20 --max-cents 50
bun as config --tts elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3
bun as config --tts minimax=speech-2.8-turbo --tts-voice English_expressive_narrator
bun as config --tts hume=octave-2 --tts-voice "Male English Actor"
bun as config --tts cartesia=sonic-3.5 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
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
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --verbose
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --quiet
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --json

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

Most artifact-producing runs write a timestamped directory under `output/` with `run.json` plus the files for the steps that actually ran. Standalone `tts`, `image`, `video`, and hosted `music` accept `--output-dir <dir>` to choose the run directory exactly.

Typical artifacts include:

- downloaded media or normalized documents
- `prompt.md`
- `transcription.txt`
- extracted text or OCR output
- `providers/<backend>/extraction.txt` and `providers/<backend>/result.json` for `extract <url> --all-providers`
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
bun test test/test-cases/validation/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli-usage-errors.test.ts
bun test test/test-cases/validation/option-resolution-contracts.test.ts
```

- `bun run check` is the default verification pass for docs and code changes.
- The three targeted `bun test` commands above are the no-cost smoke set for CLI help, usage errors, and option resolution.
- `bun t`, `bun run t`, and `AGENT=1 bun test/test-runner.ts` are full-runner commands for human service/e2e coverage. They may call paid or quota-limited providers and should only be run when that exact run is explicitly approved.
