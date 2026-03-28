# AutoShow Bun CLI v0.1 Release

This document is the release narrative for the Bun CLI.
It explains what the project is, what ships in this release,
and how to use it.

Current CLI help in this repo reports `bun as v0.1.0`.
This document uses `v0.1` as the release label for the Bun CLI package,
not as a separate semver string.

## Outline

- [Release Summary](#release-summary)
- [What AutoShow Is](#what-autoshow-is)
- [What Ships In This Release](#what-ships-in-this-release)
- [Command Surface](#command-surface)
- [Inputs, Formats, And Providers](#inputs-formats-and-providers)
- [Prompts, Structured Output, Config, And Pricing](#prompts-structured-output-config-and-pricing)
- [Setup, Runtime, And Output Layout](#setup-runtime-and-output-layout)

## Release Summary

AutoShow is a Bun-native CLI for turning media, documents, and text prompts into:

- downloaded files and source metadata
- transcripts and prompt-ready text
- OCR and document extraction artifacts
- summaries and structured JSON outputs
- generated speech, images, video, and music

This release brings together:

- a single CLI entrypoint with a root shorthand
- a step-oriented processing model from setup through post-generation
- local and service-backed engines across STT, OCR, LLM, TTS, image, video, and music
- persistent CLI defaults in `config/autoshow.json`
- automatic cost preflight and budget enforcement
- a `links` command for fetching provider documentation into one local markdown file

## What AutoShow Is

AutoShow is not just a transcription tool and not just a media-generation tool.
It is a pipeline-oriented CLI that can:

1. ingest a target
2. classify it as media, document, image, batch source, or direct prompt input
3. run the relevant processing steps
4. persist every useful artifact to a timestamped output directory
5. record step metadata, cost estimates, actual cost, and timing

It supports single targets, directories, markdown/text URL lists, YouTube collections,
podcast feeds, local text files for TTS, and prompt-driven image, video, and music generation.

## What Ships In This Release

### Core workflow coverage

| Area | What it does |
|------|--------------|
| Metadata | Collect and display metadata without downloading (`metadata`, aliases: `meta`, `info`) |
| Download | Fetch or normalize media/documents, then stop after download + metadata |
| OCR | Document OCR and text extraction (`ocr`, alias: `extract`) |
| STT | Audio/video transcription plus prompt artifact (`stt`, alias: `transcribe`) |
| Write | Full download/ocr/stt + prompt + summary pipeline |
| TTS | Generate speech from local markdown or text |
| Image | Generate images from text prompts |
| Video | Generate videos from text prompts |
| Music | Generate music from text prompts |
| Config | Inspect, reset, or persist defaults for providers, prompts, batch/extract settings, post-processing, and budgets |
| Setup | Install local runtimes and verify prerequisites with `--doctor` |
| Models | Download Whisper model IDs or llama.cpp repo IDs without running inference |
| Sample | Generate and validate deterministic fixtures for testing and validation |
| Links | Fetch curated provider documentation markdown into one combined file |

### High-value behaviors

- `bun as <input>` is a root shorthand for `bun as metadata <input>`.
- Command aliases are normalized up front, including `meta`, `info`, `dl`, `model`, `transcribe`, `transcript`, `transcription`, `extract`, `document`, `voice`, `llm`, `llms`, and `samples`.
- Selected bare provider flags expand to default models when the next token is omitted. Examples: `--openai` becomes `--openai gpt-5.2`, `--groq-stt` becomes `--groq-stt whisper-large-v3-turbo`, `--elevenlabs-tts` becomes `--elevenlabs-tts eleven_v3`, `--minimax-image` becomes `--minimax-image image-01`, `--gemini-video` becomes `--gemini-video veo-3.1-fast-generate-preview`, and `--minimax-music` becomes `--minimax-music music-2.5`.
- Batch processing supports `--batch-limit`, `--batch-all`, `--batch-order`, and configurable `--batch-concurrency`, with concurrency defaulting to `1`.
- Runnable commands run an automatic cost preflight before execution.
- `--price` (or `--dry-run`) prints the aggregated estimate and, for single-target runs, previews the expected output files before exiting.
- `write` can run multiple LLM providers in one invocation and will write provider-specific artifacts for each result.
- Post-generation steps on `write` run in parallel after step 3, but only when there is exactly one LLM output to consume.
- `links` can fetch all curated docs or a provider/section subset and writes the combined markdown to `docs/links/bun-links.md`.
- Global runtime flags include `--config-path` for alternate config files plus `--verbose`, `--quiet/-q`, and `--json` for log-output control.

### Quick start

```bash
# check prerequisites without installing
bun as setup --doctor

# install local runtimes and verify core tools
bun as setup

# stt only
bun as stt input/1-audio.mp3

# full media pipeline with service LLM
bun as write input/1-audio.mp3 --openai gpt-5.2

# document OCR/extraction
bun as ocr input/1-document.pdf --out json

# standalone text-to-speech
bun as tts input/1-tts.md --kitten-tts kitten-tts-nano-0.8-int8

# standalone image generation
bun as image "a dramatic fox portrait in snow" --minimax-image image-01

# fetch curated OpenAI provider docs
bun as links --openai
```

### Prompts and the write command

`write` is the project's central orchestration command.
It does not just summarize transcripts. It can:

- summarize media transcripts
- summarize extracted documents
- write markdown or structured JSON artifacts
- fan out across multiple LLM providers in a single run
- pass the final text into TTS, image, video, or music generation

### Outputs and metadata

Artifact-producing processing and generation runs typically write:

- one timestamped output directory
- one `metadata.json`
- the primary artifacts for the steps that actually ran

Notable exceptions:

- `metadata` logs to the terminal by default and only writes `metadata.json` when `--save` is used
- `links` writes to `docs/links/bun-links.md` instead of an `output/` run directory
- utility commands like `config`, `setup`, `sample`, and `models` do not follow the artifact-directory pattern

Metadata records:

- step-by-step provider and model choices
- output filenames and file sizes
- estimated and actual cost
- estimated and actual processing time

## Command Surface

AutoShow exposes 14 workflow/support commands, plus `help`, `version`, and the root shorthand.

| Command | Primary purpose | Typical input |
|---------|-----------------|---------------|
| `(root)` | shorthand for `metadata` | URL, local file, directory, or list |
| `metadata` | metadata-only inspection (`meta`/`info` aliases) | URL, file, directory, list |
| `setup` | install runtimes and verify tools | none |
| `sample` | generate or validate fixtures | none |
| `models` | download a Whisper model or llama repo | model ID |
| `config` | inspect, reset, or persist defaults | none |
| `links` | fetch provider documentation | provider/section filters |
| `download` | download/normalization without OCR, STT, or write | URL, file, directory, list |
| `ocr` | document/image extraction (`extract` alias) | URL, file, directory, list |
| `stt` | media transcription only (`transcribe` alias) | URL, file, directory, list |
| `write` | full pipeline orchestration | URL, file, directory, list |
| `tts` | text-to-speech | local `.md` or `.txt` |
| `image` | text-to-image | prompt |
| `music` | text-to-music | prompt |
| `video` | text-to-video | prompt |

## Inputs, Formats, And Providers

### Input sources

| Input kind | Supported workflows |
|------------|---------------------|
| Streaming URLs | `metadata`, `download`, `stt`, `write` |
| Direct media URLs | `metadata`, `download`, `stt`, `write` |
| Direct document URLs | `metadata`, `download`, `ocr`, `write` |
| Local media files | `metadata`, `download`, `stt`, `write` |
| Local document and image files | `metadata`, `download`, `ocr`, `write` |
| Directories | batch `metadata`, `download`, `ocr`, `stt`, `write` |
| `.md` / `.txt` input lists | batch `metadata`, `download`, `ocr`, `stt`, `write` |
| YouTube channels / playlists | batch media workflows |
| RSS / Atom podcast feeds | batch media workflows |
| Local `.md` / `.txt` content files | `tts` |
| Prompt strings | `image`, `video`, `music` |

### Document and image format coverage

Current extraction and download coverage includes:

- PDF
- EPUB
- MOBI / AZW3 / AZW / FB2 / LIT
- DOCX / PPTX / XLSX
- ODT / ODS / ODP
- RTF
- CSV
- CBZ
- PNG / JPG / JPEG / TIF / TIFF / WebP / BMP / GIF

Notable behavior:

- EPUB defaults to native chapter extraction when no OCR engine is requested.
- EPUB inspect modes are available through `--epub-bun` and `--epub-calibre`, and they write structured EPUB payloads into `metadata.json`.
- MOBI / AZW3 / AZW / FB2 / LIT are normalized through Calibre before downstream extraction.
- Office formats attempt native ZIP/XML extraction first, then fall back to OCR when quality heuristics fail.
- CSV is treated as raw text, not OCR.

### Provider matrix

| Step | Local engines | Service engines |
|------|---------------|-----------------|
| STT | Whisper.cpp, Reverb | Groq, ElevenLabs, OpenAI, Mistral, AssemblyAI |
| Extract / OCR | MuPDF + Tesseract, OCRmyPDF, PaddleOCR, EPUB parser, native ZIP/XML office parsing | Mistral OCR |
| LLM write | llama.cpp | OpenAI, Groq, Anthropic, Gemini, MiniMax |
| TTS | Kitten TTS | ElevenLabs, MiniMax, Groq, OpenAI, Gemini |
| Image | none | Gemini, OpenAI, MiniMax |
| Video | none | OpenAI Sora, Gemini Veo, MiniMax |
| Music | none | ElevenLabs, MiniMax |

### Supported model families in the live flag registry

| Area | Supported model IDs |
|------|---------------------|
| Whisper local | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Reverb | fixed local engine |
| Groq STT | `whisper-large-v3-turbo`, `whisper-large-v3` |
| ElevenLabs STT | `scribe_v2` |
| OpenAI STT | `gpt-4o-transcribe-diarize` |
| Mistral STT | `voxtral-mini-latest`, `voxtral-mini-2602` |
| AssemblyAI STT | `universal-2`, `universal-3-pro` |
| Mistral OCR | `mistral-ocr-latest`, `mistral-ocr-2512` |
| llama.cpp | `ggml-org/gemma-3-270m-it-GGUF`, `ggml-org/Qwen3-0.6B-GGUF` |
| OpenAI LLM | `gpt-5.2`, `gpt-5.1`, `gpt-5.2-pro` |
| Groq LLM | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |
| Anthropic | `claude-sonnet-4-6`, `claude-opus-4-6` |
| Gemini LLM | `gemini-3-flash-preview`, `gemini-3-pro-preview` |
| MiniMax LLM | `MiniMax-M2.5`, `MiniMax-M2.5-highspeed` |
| Kitten TTS | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |
| ElevenLabs TTS | `eleven_flash_v2_5`, `eleven_turbo_v2_5`, `eleven_v3` |
| MiniMax TTS | `speech-2.8-turbo`, `speech-2.8-hd` |
| Groq TTS | `canopylabs/orpheus-v1-english` |
| OpenAI TTS | `gpt-4o-mini-tts` |
| Gemini TTS | `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` |
| Gemini image | `imagen-4.0-fast-generate-001`, `gemini-3-pro-image-preview`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001` |
| OpenAI image | `gpt-image-1-mini`, `gpt-image-1`, `gpt-image-1.5` |
| MiniMax image | `image-01` |
| Sora video | `sora-2`, `sora-2-pro` |
| Gemini video | `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview` |
| MiniMax video | `T2V-01`, `T2V-01-Director`, `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02` |
| ElevenLabs music | `music_v1` |
| MiniMax music | `music-2.5` |

`models` is slightly looser for llama downloads than the flag registry:
it accepts Whisper model IDs directly, but forwards non-Whisper values as llama repo IDs to the local downloader.

## Prompts, Structured Output, Config, And Pricing

### Prompts

The prompt library lives in `src/prompts/prompts.json`.
As of this release, it exposes 37 top-level prompt definitions and presets.

Common built-in prompt names include:

- `shortSummary`
- `longSummary`
- `chapters`
- `bulletPoints`
- `faq`
- `titles`
- `blog`
- `contentStrategy`
- `emailNewsletter`
- `seoArticle`
- `screenplay`
- `shortStory`
- `youtubeDescription`

`default` expands to:

```text
shortSummary + longSummary + chapters
```

### Structured output

Structured output is enabled by default for `write` when a selected provider supports or emulates it.

Key behaviors:

- structured artifacts are written as `text.json` or `text-<model>.json`
- legacy markdown artifacts are still available through `--no-structured`, `--md-output`, or any markdown-only path
- `llama.cpp` remains markdown-oriented and writes `text.md`
- providers that cannot satisfy the target schema natively can fall back to validation/retry or compatibility behavior
- multi-provider `write` runs can mix output filenames by provider and model

### Persistent config

`config/autoshow.json` can persist defaults for:

- STT engines and models
- LLM engines and models
- structured output settings like `structured`, `structured-strict`, and compat retries
- TTS, image, video, and music post-processing defaults
- voice and speaker overrides
- extract defaults
- batch defaults
- default prompt lists
- pricing thresholds

Example capabilities:

```bash
bun as config --show
bun as config --openai gpt-5.2
bun as config --whisper large-v3-turbo
bun as config --batch-limit 20 --batch-order oldest
bun as config --structured --structured-compat-retries 3
bun as config --max-cents 50
bun as config --reset
bun as config --show --config-path /tmp/as-config.json
```

The same global `--config-path` override works on every command, not just `config`.

### Pricing and budget enforcement

All runnable commands perform preflight cost estimation.

Supported behaviors:

- automatic estimate logging before execution
- `--price` or `--dry-run` for estimate-only mode
- per-target and multi-target suite price previews
- `--max-cents` and `--max-usd` for hard budgets
- `--allow-over-budget` for one-off overrides

## Setup, Runtime, And Output Layout

### Setup

`bun as setup` orchestrates the project's runtime prerequisites.

Important setup coverage includes:

- `uv`
- `yt-dlp`
- FFmpeg / ffprobe
- Whisper.cpp binary and default local model download
- llama.cpp binary and default local model download
- Reverb Python environment and models
- Calibre
- local document OCR dependencies
- Kitten TTS environment and default local model download
- provider-specific setup hooks for supported STT, TTS, image, and music services
- `bun as setup --doctor` checks for core tools, API keys, config presence, config validity, and the active Bun version

There are also targeted setup substeps such as:

- `bun as setup --step uv`
- `bun as setup --step yt-dlp`
- `bun as setup --step whisper-binary`
- `bun as setup --step whisper-model`
- `bun as setup --step llama-binary`
- `bun as setup --step reverb`
- `bun as setup --step calibre`
- `bun as setup --step transcription`
- `bun as setup --step write`
- `bun as setup --step tts`
- `bun as setup --step image`
- `bun as setup --step sample`

### Runtime layout

The project standardizes on:

- `runtime/build/` for checked-out build trees such as `whisper.cpp`
- `runtime/bin/` for binaries and virtual environments
- `runtime/models/` for downloaded local models
- `output/` for timestamped run artifacts
- `config/autoshow.json` for persisted defaults

### Output artifacts

Common output artifacts include:

- downloaded media or normalized document/image files
- `prompt.md`
- `transcription.txt`
- extracted text or OCR output in the requested format
- `text.json`, `text.md`, or provider/model-specific variants such as `text-<model>.json`
- `speech.wav` or provider/model-specific variants such as `speech-<service>-<model>.wav`
- `generated-image.*`, including provider/model-scoped filenames on multi-provider runs
- `generated-video.mp4`
- `generated-music.mp3`
- `metadata.json`

Batch runs additionally write:

- `source.json` when the batch came from a structured remote source
- `info.json` as the batch manifest

### Report snapshot from March 19, 2026

These are dated report observations, not timeless guarantees:

| Area | Cheapest / fastest highlight from the report |
|------|----------------------------------------------|
| STT | Groq `whisper-large-v3-turbo` was both the cheapest and fastest service STT in the report snapshot |
| Write | local `llama.cpp` was the cheapest write path; Groq `openai/gpt-oss-20b` was the fastest service write path in the report snapshot |
| TTS | Gemini `gemini-2.5-flash-preview-tts` was the cheapest in the report; ElevenLabs `eleven_turbo_v2_5` was the fastest |
| Image | MiniMax `image-01` was the cheapest in the report; Gemini `imagen-4.0-generate-001` was the fastest |
| Music | ElevenLabs `music_v1` was both the cheapest and fastest successful music path in the report snapshot |
