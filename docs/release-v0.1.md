# AutoShow Bun CLI v0.1 Release

This document is the release narrative for the Bun CLI.
It explains what the project is, what ships in this release,
and how to use it.

As of March 19, 2026, live help output in this repo reports `bun as v1.0.0`.
This document uses `v0.1` as the release label for the Bun CLI merge package,
not as the current internal semver string exposed by `--help`.

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

- downloaded audio and metadata
- transcripts and prompt-ready text
- OCR and document extraction artifacts
- summaries and structured JSON outputs
- generated speech, images, video, and music

This release brings together:

- a single CLI entrypoint
- a step-oriented processing model from setup through post-generation
- local and service-backed engines across STT, OCR, LLM, TTS, image, video, and music
- persistent CLI defaults in `config/autoshow.json`
- automatic cost preflight and budget enforcement

## What AutoShow Is

AutoShow is not just a transcription tool and not just a media-generation tool.
It is a pipeline-oriented CLI that can:

1. ingest a target
2. classify it as media, document, image, batch source, or direct prompt input
3. run the relevant processing steps
4. persist every useful artifact to a timestamped output directory
5. record step metadata, cost estimates, actual cost, and timing

It supports single targets, directories, markdown/text URL lists, YouTube collections,
podcast feeds, local text files for TTS, and prompt-driven image/video/music generation.

## What Ships In This Release

### Core workflow coverage

| Area | What it does |
|------|--------------|
| Download | Fetch or normalize media/documents and collect metadata only |
| Extract | OCR and text extraction for documents and images |
| Transcribe | Audio/video transcription without LLM summarization |
| Write | Full download/extract/transcribe + prompt + summary pipeline |
| TTS | Generate speech from local markdown or text |
| Image | Generate images from text prompts |
| Video | Generate videos from text prompts |
| Music | Generate music from text prompts |
| Config | Persist defaults, prompts, batch settings, extract settings, and budgets |
| Setup | Install local runtimes, tools, and provider prerequisites |
| Models | Pre-download Whisper or llama.cpp models |
| Sample | Build deterministic fixtures for testing and validation |

### High-value behaviors

- `bun as <input>` is a root shorthand for `bun as write <input>`.
- Command aliases are normalized up front, including `dl`, `llm`, `llms`, `model`, `download-llama`, `transcript`, `transcription`, and `samples`.
- Bare provider flags expand to default models, so `--openai` becomes `--openai gpt-5.2`, `--groq-stt` becomes `--groq-stt whisper-large-v3-turbo`, and similar for the rest of the provider surface.
- Batch processing supports configurable concurrency with `--batch-concurrency` and defaults to `1`.
- Runnable commands run an automatic cost preflight before execution.
- `--price` prints the aggregated estimate and expected output files, then exits.
- `write` can run multiple LLM providers in one invocation and will write provider-specific artifacts for each result.
- Post-generation steps on `write` run in parallel after step 3, but only when there is exactly one LLM output to consume.

### Quick start

```bash
# install local runtimes and verify core tools
bun as setup

# transcribe only
bun as transcribe input/1-audio.mp3

# full media pipeline with service LLM
bun as write input/1-audio.mp3 --openai gpt-5.2

# document extraction
bun as extract input/1-document.pdf --out json

# standalone text-to-speech
bun as tts input/1-tts.md --kitten-tts kitten-tts-nano-0.8-int8

# standalone image generation
bun as image "a dramatic fox portrait in snow" --minimax-image image-01
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

Every meaningful run writes:

- one timestamped output directory
- one `metadata.json`
- the primary artifacts for the steps that actually ran

Metadata records:

- step-by-step provider and model choices
- output filenames and file sizes
- estimated and actual cost
- estimated and actual processing time

## Command Surface

AutoShow exposes 12 workflow/support commands, plus `help`, `version`, and the root shorthand.

| Command | Primary purpose | Typical input |
|---------|-----------------|---------------|
| `(root)` | shorthand for `write` | URL, local file, directory, or list |
| `setup` | install runtimes and verify tools | none |
| `sample` | generate or validate fixtures | none |
| `models` | download Whisper or llama.cpp models | model ID |
| `config` | inspect or persist defaults | none |
| `download` | metadata-only acquisition | URL, file, directory, list |
| `extract` | document/image extraction | URL, file, directory, list |
| `transcribe` | media transcription only | URL, file, directory, list |
| `write` | full pipeline orchestration | URL, file, directory, list |
| `tts` | text-to-speech | local `.md` or `.txt` |
| `image` | text-to-image | prompt |
| `music` | text-to-music | prompt |
| `video` | text-to-video | prompt |

## Inputs, Formats, And Providers

### Input sources

| Input kind | Supported workflows |
|------------|---------------------|
| Streaming URLs | `download`, `transcribe`, `write` |
| Direct media URLs | `download`, `transcribe`, `write` |
| Direct document URLs | `download`, `extract`, `write` |
| Local media files | `download`, `transcribe`, `write` |
| Local document and image files | `download`, `extract`, `write` |
| Directories | batch `download`, `extract`, `transcribe`, `write` |
| `.md` / `.txt` input lists | batch `download`, `extract`, `transcribe`, `write` |
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
- EPUB deep-inspect modes are available through `--epub-bun` and `--epub-calibre`.
- MOBI / AZW3 / FB2 / LIT are normalized through Calibre before downstream extraction.
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

### Supported model families in the live registry

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

## Prompts, Structured Output, Config, And Pricing

### Prompts

The prompt library lives in `src/prompts/prompts.json`.
As of this release, it exposes 37 top-level prompt definitions and presets.

Common built-in prompt names include:

- `shortSummary`
- `longSummary`
- `chapters`
- `default`
- `rapSong`
- `bulletPoints`
- `faq`
- `titles`
- `blog`
- `screenplay`
- `shortStory`

`default` expands to:

```text
shortSummary + longSummary + chapters
```

### Structured output

Service `write` runs default to structured JSON output.

Key behaviors:

- structured artifacts are written as `text.json` or `text-<model>.json`
- legacy markdown artifacts are still available through `--no-structured`
- `llama.cpp` remains markdown-oriented
- providers that cannot satisfy the target schema natively can fall back to validation-and-retry or compatibility behavior

### Persistent config

`config/autoshow.json` can persist defaults for:

- STT engines and models
- LLM engines and models
- TTS, image, video, and music post-processing defaults
- extract defaults
- batch defaults
- default prompt lists
- pricing thresholds

Example capabilities:

```bash
bun as config --openai gpt-5.2
bun as config --whisper large-v3-turbo
bun as config --batch-limit 20 --batch-order oldest
bun as config --max-cents 50
```

### Pricing and budget enforcement

All runnable commands perform preflight cost estimation.

Supported behaviors:

- automatic estimate logging before execution
- `--price` for estimate-only mode
- `--max-cents` and `--max-usd` for hard budgets
- `--allow-over-budget` for one-off overrides

## Setup, Runtime, And Output Layout

### Setup

`bun as setup` orchestrates the project's runtime prerequisites.

Important setup coverage includes:

- `uv`
- `yt-dlp`
- FFmpeg
- Whisper.cpp binary and local model download
- llama.cpp binary and local model download
- Reverb Python environment and models
- Calibre
- document OCR dependencies
- Kitten TTS environment and local model downloads
- service-provider environment validation for supported APIs

There are also targeted setup substeps such as:

- `bun as setup --step transcription`
- `bun as setup --step write`
- `bun as setup --step tts`
- `bun as setup --step image`
- `bun as setup --step sample`

### Runtime layout

The project standardizes on:

- `runtime/bin/` for binaries and virtual environments
- `runtime/models/` for downloaded local models
- `output/` for timestamped run artifacts
- `config/autoshow.json` for persisted defaults

### Output artifacts

Common output artifacts include:

- `prompt.md`
- `transcription.txt`
- `extraction.<format>`
- `text.json` or `text.md`
- `speech.wav`
- `generated-image.*`
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
