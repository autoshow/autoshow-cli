# AutoShow Bun CLI v0.1 Release

This document is the release narrative for the Bun CLI.
It explains what the project is, what ships in this release,
and how to use it.

Current CLI help in this repo reports `bun as v0.1.0`.
This document uses `v0.1` as the release label for the Bun CLI package.

One versioning detail matters up front:

- the package version is `0.1.0`
- persisted config requires `version: 2`
- run manifests use schema version `2`

Those are different version scopes, not a contradiction.

## Outline

- [Release Summary](#release-summary)
- [What AutoShow Is](#what-autoshow-is)
- [What Ships In This Release](#what-ships-in-this-release)
- [Command Surface](#command-surface)
- [Inputs, Formats, And Providers](#inputs-formats-and-providers)
- [Prompts, JSON Output, Config, And Pricing](#prompts-json-output-config-and-pricing)
- [Setup, Runtime, And Output Layout](#setup-runtime-and-output-layout)

## Release Summary

AutoShow is a Bun-native CLI for turning media, documents, HTML/articles, and text prompts into:

- downloaded files and source metadata
- transcripts and prompt-ready text
- OCR and document extraction artifacts
- JSON write outputs
- generated speech, images, video, and music
- local lyric videos from repo audio
- consensus review artifacts for STT and OCR runs

This release brings together:

- a single CLI entrypoint with explicit command-first invocation
- a step-oriented processing model from setup through post-generation
- local and service-backed engines across STT, OCR, LLM, TTS, image, video, and music
- persistent CLI defaults in `config/autoshow.json`
- automatic cost preflight and budget enforcement for hosted and mixed-provider runs
- a persistent STT media cache plus cache-management utilities
- a `links` command for fetching provider documentation into one local markdown file
- a `lyrics` command for local lyric-video rendering with Whisper captions

## What AutoShow Is

AutoShow is not just a transcription tool and not just a media-generation tool.
It is a pipeline-oriented CLI that can:

1. ingest a target
2. classify it as media, document, article/HTML, image, batch source, or direct prompt input
3. run the relevant processing steps
4. persist every useful artifact to a timestamped output directory
5. record step metadata, cost estimates, actual cost, and timing in versioned manifests

It supports single targets, directories, markdown/text URL lists, YouTube collections,
podcast feeds, local text files for TTS, and prompt-driven image, video, and music generation.

## What Ships In This Release

### Core workflow coverage

| Area | What it does |
|------|--------------|
| Metadata | Collect and display metadata without downloading, as terminal JSON by default or frontmatter YAML with `--markdown` |
| Download | Fetch or normalize media/documents, then stop after download + metadata |
| OCR | Document OCR and text extraction (`ocr`) |
| STT | Audio/video transcription plus prompt artifact (`stt`) |
| Write | Full download/ocr/stt + prompt + summary pipeline |
| TTS | Generate speech from local markdown or text |
| Image | Generate images from text prompts |
| Video | Generate videos from text prompts |
| Music | Generate music from text prompts |
| Lyrics | Render local lyric videos from repo audio plus Whisper or edited captions |
| Config | Inspect, reset, or persist selected defaults for batch, STT, OCR, write, and post-generation |
| Cache | Prune or clear the persistent STT media cache |
| Setup | Install local runtimes and verify prerequisites with `--doctor` |
| Models | Download a Whisper model or llama.cpp repo without running inference |
| Sample | Generate and validate deterministic fixtures for all supported formats |
| Links | Fetch curated provider documentation markdown into one combined file |

### High-value behaviors

- Hosted and mixed-provider runnable commands run an automatic cost preflight before execution.
- `--price` prints the aggregated estimate and, for single-target runs, previews the expected output files before exiting. Local-only commands such as `lyrics` are excluded.
- Batch processing supports `--batch-limit`, `--batch-all`, `--batch-order`, and configurable `--batch-concurrency`, with concurrency defaulting to `1`.
- `write` can run multiple LLM providers in one invocation and writes provider-specific JSON artifacts for each result.
- Multi-provider STT runs write provider-specific transcripts and result envelopes under `providers/<service>-<model>/`.
- STT batch runs can resume missing provider outputs with `--resume-missing`; supported diarization services accept `--speaker-count`.
- HTML/article inputs can use `defuddle`, `firecrawl`, or `glm-reader` backends through `--url-backend`.
- Native EPUB text extraction writes cleaned section-aware text by default, strips common footnote/reference noise, and can additionally emit `chapters/` or `chunks/` side artifacts.
- The persistent STT cache can be managed with `bun as cache prune` and `bun as cache clear`, and runs can force refresh or bypass via `--refresh-cache` and `--no-cache`.
- Global runtime flags include `--config-path` for alternate config files plus `--verbose`, `--quiet/-q`, and `--json` for log-output control.

### Quick start

```bash
# check prerequisites without installing
bun as setup --doctor

# install local runtimes and verify core tools
bun as setup

# metadata as Markdown frontmatter YAML
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# stt only
bun as stt input/examples/audio/1-audio.mp3

# full media pipeline with service LLM
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4

# document OCR/extraction
bun as ocr input/examples/document/1-document.pdf --out json

# native EPUB extraction with chapter side artifacts
bun as ocr input/examples/document/1-epub.epub --chapters --length 50

# article extraction with a hosted backend
bun as ocr https://ajcwebdev.com --url-backend firecrawl

# standalone text-to-speech
bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-nano-0.8-int8

# standalone image generation
bun as image "a dramatic fox portrait in snow" --minimax-image image-01

# local lyric-video render from repo audio
# bundled lyrics fixtures: input/examples/lyrics/01-example-song.mp3,
# input/examples/lyrics/01-cover.jpeg, and input/examples/lyrics/01-example-song.txt
bun as lyrics --audio input/examples/lyrics/01-example-song.mp3

# fetch curated OpenAI provider docs
bun as links --openai
```

### Prompts and the write command

`write` is the project's central orchestration command.
It does not just summarize transcripts. It can:

- summarize media transcripts
- summarize extracted documents and HTML/article content
- write JSON artifacts
- fan out across multiple LLM providers in a single run
- pass the final text into TTS, image, video, or music generation

### Outputs and manifests

Artifact-producing runs typically write:

- one timestamped output directory
- one `run.json`
- the primary artifacts for the steps that actually ran

Batch runs additionally write:

- one `batch.json`
- one content-derived child output directory per processed item (`YYYY-MM-DD-slug` when dated, otherwise `slug`)

Provider subruns can additionally write:

- `providers/<service>-<model>/result.json`
- `providers/<service>-<model>/checkpoint.json` for resumable provider progress

Metadata records step-by-step provider and model choices, output filenames,
estimated and actual cost, and estimated and actual processing time.

## Command Surface

AutoShow exposes 16 workflow/support commands, plus `help` and `version`.

| Command | Primary purpose | Typical input |
|---------|-----------------|---------------|
| `metadata` | metadata-only inspection | URL, file, directory, list |
| `download` | download/normalization without OCR, STT, or write | URL, file, directory, list |
| `ocr` | document/image/article extraction | URL, file, directory, list |
| `stt` | media transcription only | URL, file, directory, list |
| `write` | full pipeline orchestration | URL, file, directory, list |
| `tts` | text-to-speech | local `.md` or `.txt` |
| `image` | text-to-image | prompt |
| `music` | text-to-music | prompt |
| `video` | text-to-video | prompt |
| `lyrics` | local lyric-video rendering | repo-local audio or edited captions |
| `config` | inspect, reset, or persist defaults | none |
| `cache` | prune or clear STT media cache | `prune` or `clear` |
| `setup` | install runtimes and verify tools | none |
| `sample` | generate or validate fixtures | none |
| `models` | download a Whisper model or llama repo | model ID |
| `links` | fetch provider documentation | provider/section filters |

## Inputs, Formats, And Providers

### Input sources

| Input kind | Supported workflows |
|------------|---------------------|
| Streaming URLs | `metadata`, `download`, `stt`, `write` |
| Direct media URLs | `metadata`, `download`, `stt`, `write` |
| Direct document URLs | `metadata`, `download`, `ocr`, `write` |
| Direct HTML/article URLs | `metadata`, `ocr`, `write` |
| Local media files | `metadata`, `download`, `stt`, `write` |
| Local document and image files | `metadata`, `download`, `ocr`, `write` |
| Local `.html` / `.htm` files | `metadata`, `ocr`, `write` |
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
- HTML / article content
- PNG / JPG / JPEG / TIF / TIFF / WebP / BMP / GIF

Notable behavior:

- EPUB defaults to cleaned native text extraction when no OCR engine is requested.
- EPUB inspect modes are available through `--epub-bun` and `--epub-calibre`, and they write structured EPUB payloads into `run.json`.
- Native EPUB text cleanup removes common footnote/reference noise, normalizes section text, and drops empty sections before export.
- Native EPUB text runs can additionally write `chapters/` with `--chapters` and bounded `chunks/` with `--length <n>`; `--length` is expressed in thousands of characters, and with `--chapters` it hard-splits long sections into multiple chapter files.
- MOBI / AZW3 / FB2 / LIT are normalized through Calibre before downstream extraction.
- Office formats attempt native ZIP/XML extraction first, then fall back to OCR when quality heuristics fail.
- CSV is treated as raw text, not OCR.
- HTML/article extraction supports `defuddle`, `firecrawl`, and `glm-reader`.
- OCR flags are ignored for HTML/article inputs because those inputs follow the article extraction path rather than the page-rendering OCR path.

### Provider matrix

| Step | Local engines | Service engines |
|------|---------------|-----------------|
| STT | Whisper.cpp, Reverb | Deepgram, ElevenLabs, Soniox, Speechmatics, Rev, Groq, OpenAI, Mistral, AssemblyAI, Gladia |
| Extract / OCR | MuPDF + Tesseract, OCRmyPDF, PaddleOCR, EPUB parser, native ZIP/XML office parsing, Defuddle article extraction | Mistral OCR, GLM OCR, OpenAI OCR, Anthropic OCR, Gemini OCR, Firecrawl article extraction |
| LLM write | llama.cpp | OpenAI, Groq, Anthropic, Gemini, MiniMax, Grok |
| TTS | Kitten TTS | ElevenLabs, MiniMax, Groq, OpenAI, Gemini |
| Image | none | Gemini, OpenAI, MiniMax |
| Video | none | Gemini Veo, MiniMax |
| Music | none | ElevenLabs, MiniMax |

### Supported model families in the live flag registry

| Area | Supported model IDs |
|------|---------------------|
| Whisper local | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Reverb | fixed local engine |
| Deepgram STT | `nova-3` |
| ElevenLabs STT | `scribe_v2` |
| Soniox STT | `stt-async-v4` |
| Speechmatics STT | `standard`, `enhanced` |
| Rev STT | `machine`, `low_cost` |
| Groq STT | `whisper-large-v3-turbo`, `whisper-large-v3` |
| Mistral STT | `voxtral-mini-2602` |
| AssemblyAI STT | `universal-3-pro` |
| Gladia STT | `default` |
| Mistral OCR | `mistral-ocr-2512` |
| GLM OCR | `glm-ocr` |
| OpenAI OCR | `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Anthropic OCR | `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7` |
| Gemini OCR | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview` |
| Firecrawl extract | `firecrawl` |
| llama.cpp | setup-managed defaults `ggml-org/gemma-3-270m-it-GGUF`, `ggml-org/Qwen3-0.6B-GGUF`, plus arbitrary Hugging Face repo IDs in `namespace/repo_name` form |
| OpenAI LLM | `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Groq LLM | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |
| Anthropic | `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-6` |
| Gemini LLM | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview` |
| MiniMax LLM | `MiniMax-M2.5`, `MiniMax-M2.5-highspeed` |
| Grok LLM | `grok-4.20-reasoning`, `grok-4.20-non-reasoning` |
| Kitten TTS | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |
| ElevenLabs TTS | `eleven_flash_v2_5`, `eleven_turbo_v2_5`, `eleven_v3` |
| MiniMax TTS | `speech-2.8-turbo`, `speech-2.8-hd` |
| Groq TTS | `canopylabs/orpheus-v1-english` |
| OpenAI TTS | `gpt-4o-mini-tts` |
| Gemini TTS | `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` |
| Gemini image | `imagen-4.0-fast-generate-001`, `gemini-3-pro-image-preview`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001` |
| OpenAI image | `gpt-image-1-mini`, `gpt-image-1`, `gpt-image-1.5` |
| MiniMax image | `image-01` |
| Gemini video | `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview` |
| MiniMax video | `T2V-01`, `T2V-01-Director`, `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02` |
| ElevenLabs music | `music_v1` |
| MiniMax music | `music-2.5` |

`models` and `write --llama` both accept arbitrary llama Hugging Face repo IDs.
`models` also accepts Whisper model IDs directly for local Whisper downloads.

## Prompts, JSON Output, Config, And Pricing

### Prompts

The prompt library lives in `src/prompts/entries/*.json`.
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
- `questions`
- `keyMoments`
- `takeaways`

`default` expands to:

```text
shortSummary + longSummary + chapters
```

### JSON write output

`write` is JSON-only in the current runtime contract.

Key behaviors:

- single-provider runs write `text.json`
- multi-provider runs write `text-<model>.json`
- local llama output is also written as `text.json`
- prompt artifacts remain `prompt.md`
- run-level metadata is always recorded in `run.json`

### Persistent config

`config/autoshow.json` requires:

```json
{
  "version": 2
}
```

It can persist defaults for:

- STT engines, models, speaker-count hints, concurrency, split mode, and cache behavior
- selected write-provider defaults
- TTS, image, video, and music post-processing defaults
- OCR defaults like language, output format, DPI, rotation, service model, and EPUB chapter/chunk export settings
- batch defaults
- default prompt lists
- pricing thresholds

Example capabilities:

```bash
bun as config --show
bun as config --openai gpt-5.4
bun as config --whisper large-v3-turbo
bun as config --batch-limit 20 --batch-order oldest
bun as config --max-cents 50
bun as config --reset
bun as config --show --config-path /tmp/as-config.json
```

The same global `--config-path` override works on every command, not just `config`.

### Pricing and budget enforcement

Hosted or mixed-provider runnable commands perform preflight cost estimation. `lyrics` is local-only and skips pricing preflight.

Supported behaviors:

- automatic estimate logging before execution
- `--price` for estimate-only mode
- per-target and multi-target suite price previews
- configured `max-cents` hard budgets, typically set through `bun as config`
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
- provider-specific setup hooks for supported STT, OCR, TTS, image, and music services
- a `lyrics` setup step that verifies `ffmpeg`/`ffprobe`, ensures `whisper-cli`, and downloads `large-v3-turbo`
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
- `bun as setup --step lyrics`
- `bun as setup --step sample`

`setup` also supports `--force-redownload` for reinstalling artifacts and `--repeat <n>` for benchmark-oriented repeated setup runs.

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
- `result.json` for canonical structured STT or OCR payloads
- extracted text or OCR output in the requested format such as `extraction.txt`, `result.json`, `*.tsv`, or `*.hocr`
- `chapters/*.txt` or `chunks/*.txt` for native EPUB text runs, plus `chapters/*.txt` for PDF chapter autodetection when `--chapters` is active
- `text.json` or `text-<model>.json`
- `speech.wav` or provider/model-specific variants
- generated image files
- generated video files
- generated music files
- lyric-video outputs (`.mp4`, `.vtt`, `.srt`) for `lyrics`
- `run.json`
- `metadata.md` for `metadata --markdown --save`

Provider directories can additionally include:

- `providers/<service>-<model>/transcription.txt`
- `providers/<service>-<model>/result.json`
- `providers/<service>-<model>/checkpoint.json`

Batch runs additionally write:

- `batch.json`
- one child lyric run directory per discovered audio file for `lyrics --batch`

### Report snapshot as of April 17, 2026

Historical benchmark artifacts belong under `project/reports/`.
No benchmark report artifact is currently checked into this repo.

As of April 17, 2026, these are still the closest recorded benchmark highlights bundled with the repo.
They predate later additions such as Deepgram, Soniox, Speechmatics, Rev, Gladia, GLM OCR, and Firecrawl article extraction, and they also predate some current model-registry refreshes in the live flag surface.

For current cost decisions, trust `--price` and the live model registries over this historical table.

| Area | Cheapest / fastest highlight from the report |
|------|----------------------------------------------|
| STT | Groq `whisper-large-v3-turbo` was both the cheapest and fastest service STT in the report snapshot |
| Write | local `llama.cpp` was the cheapest write path; Groq `openai/gpt-oss-20b` was the fastest service write path in the report snapshot |
| TTS | Gemini `gemini-2.5-flash-preview-tts` was the cheapest in the report; ElevenLabs `eleven_turbo_v2_5` was the fastest |
| Image | MiniMax `image-01` was the cheapest in the report; Gemini `imagen-4.0-generate-001` was the fastest |
| Music | ElevenLabs `music_v1` was both the cheapest and fastest successful music path in the report snapshot |
