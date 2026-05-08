# AutoShow Bun CLI v0.1 Release

This is the release narrative for the Bun CLI. It explains what AutoShow is,
what ships in v0.1, and how to start using the tool.

Current CLI help in this repo reports `bun as v0.1.0`; this document uses
`v0.1` as the release label. The package version, persisted config version,
and run-manifest schema version are separate scopes: the package is `0.1.0`,
persisted config requires `"version": 2`, and run manifests use schema
version `2`.

## Release Summary

AutoShow is a Bun-native, pipeline-oriented CLI for turning media, documents,
HTML/articles, X/Twitter Space metadata, raw text, and text prompts into:

- downloaded files and source metadata
- transcripts, OCR output, article extracts, and prompt-ready text
- X Space metadata reports
- JSON write outputs from one or more LLM providers
- generated speech, images, video, and music
- local lyric videos from repo audio
- checked-in benchmark/provider comparison artifacts

The v0.1 release brings those workflows behind one command-first entrypoint:

- `bun as <command> [input] [flags]`
- local and service-backed engines across STT, OCR, LLM, TTS, image, video, and music
- persistent CLI defaults in `config/autoshow.json`
- automatic cost preflight and budget enforcement for hosted and mixed-provider runs
- persistent STT media cache management
- resume, benchmark, setup, config, and provider-link utility commands

AutoShow classifies each target as media, document, article/HTML, image, X
Space input, batch source, raw text, or direct prompt input. Artifact-producing
runs write a timestamped output directory with the files produced by each step,
plus manifest metadata for provider/model choices, timing, estimated cost, and
actual cost when available.

## Workflow Coverage

| Area | What it does |
|------|--------------|
| Metadata | Collect and display metadata without downloading, as terminal JSON by default or frontmatter YAML with `--markdown` |
| Download | Fetch or normalize media, documents, and articles, then stop after download plus metadata |
| Extract | Route media through STT, documents/images through OCR or native extraction, articles through article extraction, and X Space inputs through the X API |
| Write | Run the full media/document/article/raw-text pipeline with prompt rendering, JSON LLM output, and optional downstream TTS/image/video/music generation |
| TTS | Generate speech from local markdown or text |
| Image | Generate images from text prompts |
| Video | Generate videos from text prompts |
| Music | Generate hosted music from prompts or render local lyric videos from repo audio |
| Config | Inspect, reset, or persist selected defaults for batch, STT, OCR, write, and post-generation |
| Cache | Prune or clear the persistent STT media cache |
| Setup | Install local runtimes, verify prerequisites, check cloud auth, generate fixtures, and download local models |
| Links | Fetch curated provider documentation markdown into one combined local file |
| Resume | Fill missing STT, OCR, TTS, image, video, or music provider outputs in existing runs or batches |
| Benchmark | Benchmark STT transcription quality across compression levels and playback speeds |

High-value behaviors:

- Hosted and mixed-provider runnable commands run an automatic cost preflight before execution.
- `--price` provides hosted or mixed-provider estimate-only previews, including expected output files for single-target runs.
- Batch processing supports `--batch-limit`, `--batch-all`, `--batch-order`, and configurable `--batch-concurrency`, with concurrency defaulting to `1`.
- `write` can run multiple LLM providers in one invocation and writes provider-specific JSON artifacts for each result.
- `write` accepts at most one STT provider and at most one OCR provider for a single pipeline run, while `extract` supports multi-provider STT and OCR runs.
- Existing STT, OCR, TTS, image, video, and music outputs can be filled in with the top-level `resume` command.
- HTML/article inputs can use `defuddle`, `firecrawl`, or `glm-reader` backends through `--url-backend`.
- X Space extraction accepts X/Twitter Space URLs, X post URLs that reference Spaces, and raw Space IDs.
- The persistent STT cache can be managed with `bun as cache prune` and `bun as cache clear`; runs can force refresh or bypass via `--refresh-cache` and `--no-cache`.
- Global runtime flags include `--config-path`, `--verbose`, `--quiet/-q`, and `--json`.

Quick start:

```bash
# check prerequisites without installing
bun as setup --doctor

# install local runtimes and verify core tools
bun as setup

# check Google Cloud or AWS readiness
bun as setup --gcloud
bun as setup --aws

# download local Whisper and llama.cpp models without inference
bun as setup --models base --models ggml-org/gemma-3-270m-it-GGUF

# metadata as Markdown frontmatter YAML
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# extract media through the STT route
bun as extract input/examples/audio/1-audio.mp3

# full media pipeline with service LLM
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4

# document OCR/extraction
bun as extract input/examples/document/1-document.pdf --out json

# article extraction with a hosted backend
bun as extract https://ajcwebdev.com --url-backend firecrawl

# X Space extraction through the X API
bun as extract https://x.com/i/spaces/1DXxyRYNejbKM

# raw text/project lyric draft mode
bun as write ./output/demo/text --prompt rockSong
bun as write ./notes/source.md --text-input --openai gpt-5.4 --prompt folkSong

# standalone generation
bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-nano-0.8-int8
bun as image "a clean product photo of a red enamel camping mug" --openai-image gpt-image-2 --image-size 1024x1024
bun as video "a cinematic mountain sunrise" --gemini-video veo-3.1-lite-generate-preview
bun as music "bright 90s pop rock with a huge chorus" --gemini-music lyria-3-clip-preview

# local lyric-video render from repo audio
bun as music --audio input/examples/lyrics/01-example-song.mp3

# fill missing provider outputs from an existing run or batch
bun as resume ./output/<run-or-batch-dir> --deepinfra-stt

# STT quality benchmark
bun as benchmark input/examples/audio/1-audio.mp3 --stt-services whisper --skip-speed

# fetch curated provider docs
bun as links stt
```

`write` is the central orchestration command. It can summarize media
transcripts, extracted documents, and article content; process raw `.md` or
`.txt` files with `--text-input`; process project text directories under
`output/<project>/text` into `output/<project>/lyrics`; fan out across multiple
LLM providers; and pass final text into TTS, image, video, or music generation.

STT is not a standalone top-level command in v0.1. It is the media route inside
`extract` and `write`.

## Command Surface

AutoShow exposes 14 workflow/support commands, plus the root `help` and
`version` commands.

| Command | Primary purpose | Typical input |
|---------|-----------------|---------------|
| `metadata` | metadata-only inspection | URL, file, directory, list |
| `download` | download/normalization without OCR, STT, or write | URL, file, directory, list |
| `extract` | media STT, document/image/article extraction, and X Space metadata | URL, file, directory, list, X Space link/post/ID |
| `write` | full pipeline orchestration | URL, file, directory, list, raw text file |
| `tts` | text-to-speech | local `.md` or `.txt` |
| `image` | text-to-image | prompt |
| `video` | text-to-video | prompt |
| `music` | text-to-music or lyric-video rendering | prompt, prompt file, repo-local audio, edited captions |
| `config` | inspect, reset, or persist defaults | none |
| `cache` | prune or clear STT media cache | `prune` or `clear` |
| `setup` | install runtimes, verify tools, check cloud auth, generate samples, download local models | none |
| `links` | fetch provider documentation | provider/section filters |
| `resume` | resume missing provider outputs in a run or batch directory | output directory |
| `benchmark` | benchmark STT quality across compression and speed variants | audio file |

`setup --sample` replaces the old standalone sample workflow, and
`setup --models` replaces the old standalone model-download workflow.

## Inputs, Formats, And Providers

Supported input sources:

| Input kind | Supported workflows |
|------------|---------------------|
| Media URLs and local media files | `metadata`, `download`, `extract` media STT route, `write` media route |
| Document URLs and local document/image files | `metadata`, `download`, `extract`, `write` |
| HTML/article URLs and local `.html` / `.htm` files | `metadata`, `download`, `extract`, `write` |
| X/Twitter Space URLs, X posts that reference Spaces, and raw Space IDs | `extract` X Space metadata route |
| Directories, `.md` / `.txt` URL lists, YouTube channels/playlists, and RSS/Atom podcast feeds | batch media/document/article workflows |
| Local `.md` / `.txt` content files | `tts`, `write --text-input`, hosted `music` prompt body |
| Project text directories under `output/<project>/text` | `write` project lyric draft mode |
| Prompt strings | `image`, `video`, hosted `music` |

For `.md` and `.txt` inputs, `write` normally treats files as URL lists. Use
`write --text-input` for raw source text outside the project-text convention.

Document and image extraction/download coverage includes PDF, EPUB, MOBI/AZW
variants, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ,
HTML/article content, and common raster image formats such as PNG, JPG, TIFF,
WebP, BMP, and GIF.

Notable extraction behavior:

- EPUB defaults to cleaned native text extraction when no OCR engine is requested.
- EPUB runs can write `chapters/` with `--chapters` and bounded `chunks/` with `--length <n>`.
- PDF chapter autodetection can write `chapters/` with `--chapters` and supports `--pdf-chapter-mode local|auto|llm`.
- MOBI, AZW3, FB2, and LIT are normalized through Calibre before downstream extraction.
- Office formats attempt native ZIP/XML extraction first, then fall back to OCR when quality heuristics fail.
- CSV is treated as raw text, not OCR.
- OCR flags are ignored for HTML/article inputs because those inputs use the article extraction path.

Provider coverage:

| Step | Local engines | Service engines |
|------|---------------|-----------------|
| STT | Whisper.cpp, Reverb, YouTube caption preference | Google Cloud, AWS Transcribe, Deepgram, DeepInfra, Together, Cloudflare Workers AI, deAPI, ElevenLabs, Soniox, Speechmatics, Rev, Groq, Grok, Mistral, AssemblyAI, Gladia, Happy Scribe, Supadata, OpenAI, Gemini, GLM |
| Extract / OCR / article | MuPDF + Tesseract, OCRmyPDF, PaddleOCR, EPUB parser, native ZIP/XML office parsing, Defuddle article extraction | Mistral OCR, GLM OCR, Kimi OCR, OpenAI OCR, Anthropic OCR, Gemini OCR, DeepInfra OCR, AWS Textract, Google Cloud Document AI, deAPI OCR, Firecrawl article extraction, GLM Reader article extraction |
| LLM write | llama.cpp | OpenAI, Groq, Anthropic, Gemini, MiniMax, Grok, GLM, Kimi |
| TTS | Kitten TTS | ElevenLabs, MiniMax, Groq, Grok, Mistral, OpenAI, Gemini, Deepgram, Runway, deAPI, Speechify, Google Cloud |
| Image | none | Gemini, OpenAI, MiniMax, GLM, Grok, Runway, BFL, deAPI |
| Video | none | Gemini Veo, MiniMax, GLM, Grok, Runway, deAPI |
| Music | lyric-video rendering uses local FFmpeg/Whisper tooling | ElevenLabs, MiniMax, deAPI, Gemini Lyria |

The live flag registry is the source of truth for supported model IDs. Use
`bun as help <command>` or the command-specific docs under `docs/commands/` for
current model lists, option details, and provider setup notes.

## Prompts, JSON Output, Config, And Pricing

Prompts live in JSON files discovered recursively under `src/prompts/entries/`.
The library includes summary, chapter, marketing, social, creative-writing, and
song-lyric prompts. The `default` prompt expands to:

```text
shortSummary + longSummary + longChapters
```

`write` is JSON-only in the current runtime contract:

- single-provider runs write `text.json`
- multi-provider runs write `text-<model>.json`
- local llama output is also written as `text.json`
- prompt artifacts remain `prompt.md`
- `--rendered-text` can save rendered markdown alongside JSON output
- run-level metadata is always recorded in `run.json`

Persistent config lives in `config/autoshow.json` and requires:

```json
{
  "version": 2
}
```

Config can persist selected defaults for provider/model choices, prompts, batch
controls, STT/OCR/TTS/image/video/music options, cache behavior, cloud staging,
and pricing thresholds.

```bash
bun as config --show
bun as config --openai gpt-5.4
bun as config --whisper-stt large-v3-turbo
bun as config --batch-limit 20 --batch-order oldest
bun as config --max-cents 50
bun as config --reset
bun as config --show --config-path /tmp/as-config.json
```

The same global `--config-path` override works on every command, not just
`config`.

Hosted or mixed-provider runnable commands perform preflight cost estimation.
`music --audio` and `music --batch` are local lyric-video modes: they do not run
cost preflight and reject hosted music-generation flags, including `--price`.

Supported pricing behaviors:

- automatic estimate logging before execution
- `--price` for hosted or mixed-provider estimate-only previews
- per-target and multi-target suite price previews
- configured `max-cents` hard budgets, typically set through `bun as config`
- `--allow-over-budget` for one-off overrides

## Setup, Runtime, And Output Layout

`bun as setup` orchestrates the project's runtime prerequisites. It covers core
tools such as `uv`, `yt-dlp`, FFmpeg/ffprobe, Whisper.cpp, llama.cpp, Reverb,
Calibre, local OCR dependencies, Kitten TTS, and provider-specific setup hooks.

Common setup modes:

```bash
bun as setup --doctor
bun as setup
bun as setup --gcloud
bun as setup --aws
bun as setup --sample --verify-only
bun as setup --models base --models ggml-org/gemma-3-270m-it-GGUF
bun as setup --step whisper-model
```

`setup --doctor` checks for core tools, API keys, config presence, config
validity, and the active Bun version. `setup --gcloud` and `setup --aws` check
cloud CLI auth/config for the relevant speech, OCR, TTS, and staging services.
`setup --sample` generates or verifies deterministic fixture files, while
`setup --models` downloads one or more local Whisper or llama.cpp models without
running inference.

Runtime layout:

- `runtime/build/` for checked-out build trees such as `whisper.cpp`
- `runtime/bin/` for binaries and virtual environments
- `runtime/models/` for downloaded local models
- `output/` for timestamped run artifacts
- `config/autoshow.json` for persisted defaults

Common output artifacts:

- downloaded media or normalized document/image files
- `prompt.md`, `transcription.txt`, extracted text, OCR output, or provider `result.json`
- X Space `extraction.md` reports
- EPUB/PDF `chapters/*.txt` and EPUB `chunks/*.txt` when requested
- `text.json` or `text-<model>.json`
- generated speech, image, video, music, or lyric-video files
- `run.json`
- `metadata.md` for `metadata --markdown --save`

Provider subruns can also write artifacts under
`providers/<service>-<model>/`, including `result.json`, `transcription.txt`,
and resumable `checkpoint.json` files.

Most batch runs write `batch.json` plus one content-derived child output
directory per processed item. `extract` batches write a parent
`extract-batch.json` and routed child batches under `media/`, `document/`, and
`x-space/` when those input classes are present.

A checked-in TTS provider comparison lives under
`docs/benchmarks/2026-04-25_02-36-42-642_tts-long/`. It compares 15 providers
and models using speaking-rate naturalness, cost, and processing speed; it does
not include roundtrip STT transcription scoring or human listening judgments.
