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
  - [Core workflow coverage](#core-workflow-coverage)
  - [High-value behaviors](#high-value-behaviors)
  - [Quick start](#quick-start)
  - [Prompts and the write command](#prompts-and-the-write-command)
  - [Outputs and manifests](#outputs-and-manifests)
- [Command Surface](#command-surface)
- [Inputs, Formats, And Providers](#inputs-formats-and-providers)
  - [Input sources](#input-sources)
  - [Document and image format coverage](#document-and-image-format-coverage)
  - [Provider matrix](#provider-matrix)
  - [Supported model families in the live flag registry](#supported-model-families-in-the-live-flag-registry)
- [Prompts, JSON Output, Config, And Pricing](#prompts-json-output-config-and-pricing)
  - [Prompts](#prompts)
  - [JSON write output](#json-write-output)
  - [Persistent config](#persistent-config)
  - [Pricing and budget enforcement](#pricing-and-budget-enforcement)
- [Setup, Runtime, And Output Layout](#setup-runtime-and-output-layout)
  - [Setup](#setup)
  - [Runtime layout](#runtime-layout)
  - [Output artifacts](#output-artifacts)
  - [TTS benchmark snapshot as of April 25, 2026](#tts-benchmark-snapshot-as-of-april-25-2026)

## Release Summary

AutoShow is a Bun-native CLI for turning media, documents, HTML/articles, X/Twitter Space metadata, raw text, and text prompts into:

- downloaded files and source metadata
- transcripts and prompt-ready text
- OCR and document extraction artifacts
- X Space metadata reports
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
- a `resume` command for filling missing provider outputs in existing runs or batches
- a `benchmark` command for STT quality tests across compression and playback-speed settings
- a `music` lyric-video mode for local rendering with Whisper captions

## What AutoShow Is

AutoShow is not just a transcription tool and not just a media-generation tool.
It is a pipeline-oriented CLI that can:

1. ingest a target
2. classify it as media, document, article/HTML, image, X Space input, batch source, raw text, or direct prompt input
3. run the relevant processing steps
4. persist every useful artifact to a timestamped output directory
5. record step metadata, cost estimates, actual cost, and timing in versioned manifests

It supports single targets, directories, markdown/text URL lists, YouTube collections,
podcast feeds, X Space links and IDs through `extract`, local text files for TTS,
raw text/project lyric draft mode through `write`, and prompt-driven image, video,
and music generation.

## What Ships In This Release

### Core workflow coverage

| Area | What it does |
|------|--------------|
| Metadata | Collect and display metadata without downloading, as terminal JSON by default or frontmatter YAML with `--markdown` |
| Download | Fetch or normalize media/documents/articles, then stop after download + metadata |
| Extract | Route media through STT, documents/images through OCR or native extraction, articles through article extraction, and X Space inputs through the X API |
| Write | Full media/document/article/raw-text pipeline with prompt rendering, JSON LLM output, and optional downstream TTS/image/video/music generation |
| TTS | Generate speech from local markdown or text |
| Image | Generate images from text prompts |
| Video | Generate videos from text prompts |
| Music | Generate hosted music from prompts or render local lyric videos from repo audio |
| Config | Inspect, reset, or persist selected defaults for batch, STT, OCR, write, and post-generation |
| Cache | Prune or clear the persistent STT media cache |
| Setup | Install local runtimes, verify prerequisites, check cloud auth, generate fixtures, and download local models |
| Links | Fetch curated provider documentation markdown into one combined file |
| Resume | Resume missing STT, OCR, TTS, image, video, or music provider outputs in existing runs or batches |
| Benchmark | Benchmark STT transcription quality across compression levels and playback speeds |

### High-value behaviors

- Hosted and mixed-provider runnable commands run an automatic cost preflight before execution.
- `--price` prints the aggregated estimate and, for single-target runs, previews the expected output files before exiting. Local lyric-video mode is excluded.
- Batch processing supports `--batch-limit`, `--batch-all`, `--batch-order`, and configurable `--batch-concurrency`, with concurrency defaulting to `1`.
- `extract` routes media to STT, document/image/article inputs to text extraction, and X Space inputs to metadata reports.
- `write` can run multiple LLM providers in one invocation and writes provider-specific JSON artifacts for each result.
- `write` accepts at most one STT provider and at most one OCR provider for a single pipeline run, while `extract` supports multi-provider STT and OCR runs.
- Multi-provider STT and OCR runs write provider-specific artifacts under `providers/<service>-<model>/`.
- Existing STT, OCR, TTS, image, video, and music outputs can be filled in with the top-level `resume` command; supported diarization services accept `--speaker-count`.
- HTML/article inputs can use `defuddle`, `firecrawl`, or `glm-reader` backends through `--url-backend`.
- Native EPUB text extraction writes cleaned section-aware text by default, strips common footnote/reference noise, and can additionally emit `chapters/` or `chunks/` side artifacts.
- X Space extraction accepts X/Twitter Space URLs, X post URLs that reference Spaces, and raw Space IDs.
- The persistent STT cache can be managed with `bun as cache prune` and `bun as cache clear`, and runs can force refresh or bypass via `--refresh-cache` and `--no-cache`.
- Global runtime flags include `--config-path` for alternate config files plus `--verbose`, `--quiet/-q`, and `--json` for log-output control.

### Quick start

```bash
# check prerequisites without installing
bun as setup --doctor

# install local runtimes and verify core tools
bun as setup

# check Google Cloud or AWS readiness
bun as setup --gcloud
bun as setup --aws

# generate or verify deterministic sample fixtures
bun as setup --sample --verify-only

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

# native EPUB extraction with chapter side artifacts
bun as extract input/examples/document/1-epub.epub --chapters --length 50

# article extraction with a hosted backend
bun as extract https://ajcwebdev.com --url-backend firecrawl

# X Space extraction through the X API
bun as extract https://x.com/i/spaces/1DXxyRYNejbKM

# raw text/project lyric draft mode
bun as write ./output/demo/text --prompt rockSong
bun as write ./notes/source.md --text-input --openai gpt-5.4 --prompt folkSong

# standalone text-to-speech
bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-nano-0.8-int8

# standalone image generation
bun as image "a clean product photo of a red enamel camping mug" --openai-image gpt-image-2 --image-size 1024x1024

# standalone video generation
bun as video "a cinematic mountain sunrise" --gemini-video veo-3.1-lite-generate-preview

# hosted music generation
bun as music "bright 90s pop rock with a huge chorus" --gemini-music lyria-3-clip-preview

# local lyric-video render from repo audio
# bundled lyrics fixtures: input/examples/lyrics/01-example-song.mp3,
# input/examples/lyrics/01-cover.jpeg, and input/examples/lyrics/01-example-song.txt
bun as music --audio input/examples/lyrics/01-example-song.mp3

# fill missing provider outputs from an existing run or batch
bun as resume ./output/<run-or-batch-dir> --deepinfra-stt

# STT quality benchmark
bun as benchmark input/examples/audio/1-audio.mp3 --stt-services whisper --skip-speed

# fetch curated provider docs
bun as links stt
```

### Prompts and the write command

`write` is the project's central orchestration command.
It can:

- summarize media transcripts
- summarize extracted documents and HTML/article content
- process raw `.md` / `.txt` files with `--text-input`
- process project text directories under `output/<project>/text` into `output/<project>/lyrics`
- write JSON artifacts
- fan out across multiple LLM providers in a single run
- pass the final text into TTS, image, video, or music generation

STT is not a standalone top-level command in the current CLI. It is the media route inside `extract` and `write`.

### Outputs and manifests

Artifact-producing runs typically write:

- one timestamped output directory
- one `run.json`
- the primary artifacts for the steps that actually ran

Most batch runs write:

- one `batch.json`
- one content-derived child output directory per processed item (`YYYY-MM-DD-slug` when dated, otherwise `slug`)

`extract` uses routed parent batches for mixed input sources:

- parent `extract-batch.json`
- child `media/batch.json` when media items are present
- child `document/batch.json` when document, image, or article items are present
- child `x-space/batch.json` when X Space items are present

Provider subruns can additionally write:

- `providers/<service>-<model>/result.json`
- `providers/<service>-<model>/checkpoint.json` for resumable provider progress

Metadata records step-by-step provider and model choices, output filenames,
estimated and actual cost, and estimated and actual processing time.

## Command Surface

AutoShow exposes 14 workflow/support commands, plus the root `help` and `version` commands.

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

`setup --sample` replaces the old standalone sample workflow, and `setup --models` replaces the old standalone model-download workflow.

## Inputs, Formats, And Providers

### Input sources

| Input kind | Supported workflows |
|------------|---------------------|
| Streaming and platform media URLs | `metadata`, `download`, `extract` media STT route, `write` media route |
| Direct media URLs | `metadata`, `download`, `extract` media STT route, `write` media route |
| Direct document URLs | `metadata`, `download`, `extract`, `write` |
| Direct HTML/article URLs | `metadata`, `download`, `extract`, `write` |
| X/Twitter Space URLs (`x.com/i/spaces/<id>`) | `extract` X Space metadata route |
| X/Twitter post URLs (`x.com/<handle>/status/<id>`) | `extract` X Space metadata route when the post references Spaces |
| Raw X Space IDs | `extract` X Space metadata route |
| Local media files | `metadata`, `download`, `extract` media STT route, `write` media route |
| Local document and image files | `metadata`, `download`, `extract`, `write` |
| Local `.html` / `.htm` files | `metadata`, `download`, `extract`, `write` |
| Directories | batch `metadata`, `download`, `extract`, `write` |
| `.md` / `.txt` input lists | batch `metadata`, `download`, `extract`, `write` |
| YouTube channels / playlists | batch media workflows |
| RSS / Atom podcast feeds | batch media workflows |
| Local `.md` / `.txt` content files | `tts`; `write --text-input`; `music` hosted prompt body |
| Project text directories under `output/<project>/text` | `write` project lyric draft mode |
| Prompt strings | `image`, `video`, hosted `music` |

For `.md` / `.txt` inputs, `write` normally treats files as URL lists. Use `write --text-input` for raw source text outside the project-text convention.

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
- PDF chapter autodetection can write `chapters/` with `--chapters` and supports `--pdf-chapter-mode local|auto|llm`.
- MOBI / AZW3 / FB2 / LIT are normalized through Calibre before downstream extraction.
- Office formats attempt native ZIP/XML extraction first, then fall back to OCR when quality heuristics fail.
- CSV is treated as raw text, not OCR.
- HTML/article extraction supports `defuddle`, `firecrawl`, and `glm-reader`.
- OCR flags are ignored for HTML/article inputs because those inputs follow the article extraction path rather than the page-rendering OCR path.

### Provider matrix

| Step | Local engines | Service engines |
|------|---------------|-----------------|
| STT | Whisper.cpp, Reverb, YouTube caption preference | Google Cloud, AWS Transcribe, Deepgram, DeepInfra, Together, Cloudflare Workers AI, deAPI, ElevenLabs, Soniox, Speechmatics, Rev, Groq, Grok, Mistral, AssemblyAI, Gladia, Happy Scribe, Supadata, OpenAI, Gemini, GLM |
| Extract / OCR / article | MuPDF + Tesseract, OCRmyPDF, PaddleOCR, EPUB parser, native ZIP/XML office parsing, Defuddle article extraction | Mistral OCR, GLM OCR, Kimi OCR, OpenAI OCR, Anthropic OCR, Gemini OCR, DeepInfra OCR, AWS Textract, Google Cloud Document AI, deAPI OCR, Firecrawl article extraction, GLM Reader article extraction |
| LLM write | llama.cpp | OpenAI, Groq, Anthropic, Gemini, MiniMax, Grok, GLM, Kimi |
| TTS | Kitten TTS | ElevenLabs, MiniMax, Groq, Grok, Mistral, OpenAI, Gemini, Deepgram, Runway, deAPI, Speechify, Google Cloud |
| Image | none | Gemini, OpenAI, MiniMax, GLM, Grok, Runway, BFL, deAPI |
| Video | none | Gemini Veo, MiniMax, GLM, Grok, Runway, deAPI |
| Music | lyric-video rendering uses local FFmpeg/Whisper tooling | ElevenLabs, MiniMax, deAPI, Gemini Lyria |

### Supported model families in the live flag registry

STT models and modes:

| Provider | Supported IDs |
|----------|---------------|
| Whisper local | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Google Cloud STT | `chirp_3` |
| AWS Transcribe | `standard` |
| Deepgram STT | `nova-3` |
| DeepInfra STT | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3` |
| Together STT | `openai/whisper-large-v3` |
| Cloudflare STT | `whisper-large-v3-turbo`, `whisper` |
| deAPI STT | `WhisperLargeV3` |
| Groq STT | `whisper-large-v3-turbo`, `whisper-large-v3` |
| Grok STT | `speech-to-text` |
| Soniox STT | `stt-async-v4` |
| Speechmatics STT | `standard`, `enhanced` |
| Rev STT | `machine`, `low_cost` |
| ElevenLabs STT | `scribe_v2` |
| Mistral STT | `voxtral-mini-2602` |
| AssemblyAI STT | `universal-3-pro` |
| Gladia STT | `default` |
| Happy Scribe STT | `auto` |
| Supadata STT | `auto`, `native`, `generate` |
| OpenAI STT | `gpt-4o-mini-transcribe`, `gpt-4o-transcribe` |
| Gemini STT | `gemini-3-flash-preview` |
| GLM STT | `glm-asr-2512` |
| YouTube captions | `subtitle-track` internal caption path, exposed as `--youtube-captions` |
| Reverb | fixed local engine |

OCR and article extraction models:

| Provider | Supported IDs |
|----------|---------------|
| Tesseract | local engine |
| OCRmyPDF | local engine |
| PaddleOCR | local engine |
| Mistral OCR | `mistral-ocr-2512` |
| GLM OCR | `glm-ocr` |
| Kimi OCR | `kimi-k2.6` |
| OpenAI OCR | `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Anthropic OCR | `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7` |
| Gemini OCR | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview` |
| DeepInfra OCR | `PaddlePaddle/PaddleOCR-VL-0.9B`, `Qwen/Qwen3-VL-235B-A22B-Instruct`, `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| AWS Textract | `detect-text`, `analyze-document` |
| Google Cloud Document AI | `ocr`, `layout-parser` |
| deAPI OCR | `Nanonets_Ocr_S_F16` |
| Firecrawl extract | `firecrawl` |
| Article backends | `defuddle`, `firecrawl`, `glm-reader` via `--url-backend` |

LLM write models:

| Provider | Supported IDs |
|----------|---------------|
| llama.cpp | setup-managed defaults `ggml-org/gemma-3-270m-it-GGUF`, `ggml-org/Qwen3-0.6B-GGUF`, plus arbitrary Hugging Face repo IDs in `namespace/repo_name` form |
| OpenAI LLM | `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Groq LLM | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |
| Anthropic | `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-6` |
| Gemini LLM | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview` |
| MiniMax LLM | `MiniMax-M2.5`, `MiniMax-M2.5-highspeed` |
| Grok LLM | `grok-4.20-reasoning`, `grok-4.20-non-reasoning` |
| GLM LLM | `glm-5.1` |
| Kimi LLM | `kimi-k2.6` |

TTS models:

| Provider | Supported IDs |
|----------|---------------|
| Kitten TTS | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |
| ElevenLabs TTS | `eleven_flash_v2_5`, `eleven_turbo_v2_5`, `eleven_v3` |
| MiniMax TTS | `speech-2.8-turbo`, `speech-2.8-hd` |
| Groq TTS | `canopylabs/orpheus-v1-english` |
| Grok TTS | `grok-tts` |
| Mistral TTS | `voxtral-mini-tts-2603` |
| OpenAI TTS | `gpt-4o-mini-tts` |
| Gemini TTS | `gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` |
| Deepgram TTS | `aura-2-thalia-en`, `aura-2-andromeda-en`, `aura-2-apollo-en`, `aura-2-arcas-en`, `aura-2-asteria-en`, `aura-2-athena-en`, `aura-2-helena-en`, `aura-2-aries-en` |
| Runway TTS | `eleven_multilingual_v2` |
| Speechify TTS | `simba-english`, `simba-multilingual` |
| Google Cloud TTS | `standard`, `wavenet`, `neural2`, `studio`, `chirp3-hd`, `instant-custom-voice` |
| deAPI TTS | `Kokoro`, `Chatterbox`, `Qwen3_TTS_12Hz_1_7B_CustomVoice`, `Qwen3_TTS_12Hz_1_7B_Base`, `Qwen3_TTS_12Hz_1_7B_VoiceDesign` |

Image, video, and music models:

| Area | Provider | Supported IDs |
|------|----------|---------------|
| Image | Gemini | `imagen-4.0-fast-generate-001`, `gemini-3-pro-image-preview`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001` |
| Image | OpenAI | `gpt-image-1-mini`, `gpt-image-1`, `gpt-image-1.5`, `gpt-image-2` |
| Image | MiniMax | `image-01` |
| Image | GLM | `glm-image`, `cogView-4-250304` |
| Image | Grok | `grok-imagine-image` |
| Image | Runway | `gen4_image` |
| Image | BFL | `flux-2-klein-4b`, `flux-2-klein-9b-preview`, `flux-2-klein-9b`, `flux-2-pro-preview`, `flux-2-pro`, `flux-2-max`, `flux-2-flex` |
| Image | deAPI | `Flux1schnell`, `ZImageTurbo_INT8`, `Flux_2_Klein_4B_BF16` |
| Video | Gemini | `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview`, `veo-3.1-lite-generate-preview` |
| Video | MiniMax | `T2V-01`, `T2V-01-Director`, `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02` |
| Video | GLM | `cogvideox-3`, `viduq1-text` |
| Video | Grok | `grok-imagine-video` |
| Video | Runway | `gen4.5` |
| Video | deAPI | `Ltxv_13B_0_9_8_Distilled_FP8`, `Ltx2_19B_Dist_FP8`, `Ltx2_3_22B_Dist_INT8` |
| Music | ElevenLabs | `music_v1` |
| Music | MiniMax | `music-2.5` |
| Music | deAPI | `AceStep_1_5_Turbo`, `AceStep_1_5_Base`, `AceStep_1_5_XL_Turbo_INT8` |
| Music | Gemini | `lyria-3-clip-preview`, `lyria-3-pro-preview` |

`setup --models` and `write --llama` both accept arbitrary llama Hugging Face repo IDs.
`setup --models` also accepts Whisper model IDs directly for local Whisper downloads.

## Prompts, JSON Output, Config, And Pricing

### Prompts

The prompt library lives in JSON files discovered recursively under `src/prompts/entries/`.
As of this release, it exposes 37 top-level prompt definitions and presets.

Common built-in prompt names include:

- `shortSummary`
- `longSummary`
- `longChapters`
- `mediumChapters`
- `shortChapters`
- `chapterTitles`
- `chapterTitlesAndQuotes`
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
- `quotes`
- `takeaways`
- `rockSong`
- `folkSong`
- `popSong`
- `rapSong`

`default` expands to:

```text
shortSummary + longSummary + longChapters
```

### JSON write output

`write` is JSON-only in the current runtime contract.

Key behaviors:

- single-provider runs write `text.json`
- multi-provider runs write `text-<model>.json`
- local llama output is also written as `text.json`
- prompt artifacts remain `prompt.md`
- `--rendered-text` can save rendered markdown alongside JSON output
- project lyric draft mode writes rendered text into the resolved project output directory
- run-level metadata is always recorded in `run.json`

### Persistent config

`config/autoshow.json` requires:

```json
{
  "version": 2
}
```

It can persist defaults for:

- STT engines, models, speaker-count hints, concurrency, split mode, cache behavior, AWS staging, Google Cloud defaults, Happy Scribe organization, and Supadata language
- selected write-provider defaults
- TTS, image, video, and music post-processing defaults
- OCR defaults like language, output format, DPI, rotation, service model, and EPUB/PDF chapter/chunk export settings
- batch defaults
- default prompt lists
- pricing thresholds

Example capabilities:

```bash
bun as config --show
bun as config --openai gpt-5.4
bun as config --whisper-stt large-v3-turbo
bun as config --gcloud-stt chirp_3
bun as config --aws-stt standard --aws-region us-east-1 --aws-bucket autoshow-staging
bun as config --batch-limit 20 --batch-order oldest
bun as config --max-cents 50
bun as config --reset
bun as config --show --config-path /tmp/as-config.json
```

The same global `--config-path` override works on every command, not just `config`.

### Pricing and budget enforcement

Hosted or mixed-provider runnable commands perform preflight cost estimation. `music --audio` and `music --batch` are local lyric-video modes and skip pricing preflight.

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
- provider-specific setup hooks for supported STT, OCR, TTS, image, video, and music services
- a `music` setup step that checks hosted music API readiness, verifies `ffmpeg`/`ffprobe`, ensures `whisper-cli`, and downloads `large-v3-turbo`
- `bun as setup --doctor` checks for core tools, API keys, config presence, config validity, and the active Bun version
- `bun as setup --gcloud` checks Google Cloud CLI auth/config for Speech-to-Text, Text-to-Speech, Document AI OCR, and related storage/project setup
- `bun as setup --aws` checks AWS CLI auth/config for Amazon Transcribe and can create an S3 staging bucket with `--aws-create-bucket`
- `bun as setup --sample` generates or verifies deterministic fixture files; `--out`, `--refresh`, `--verify-only`, and `--valid-only` apply to sample mode
- `bun as setup --models` downloads one or more local Whisper or llama.cpp models without running inference

Targeted setup substeps include:

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
- `bun as setup --step video`
- `bun as setup --step music`
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
- `prompt-md.md` when `--prompt-md` is active
- `transcription.txt`
- `result.json` for canonical structured STT, OCR, X Space, or provider payloads
- extracted text or OCR output in the requested format such as `extraction.txt`, `result.json`, `*.tsv`, or `*.hocr`
- `extraction.md` for X Space metadata reports
- `chapters/*.txt` or `chunks/*.txt` for native EPUB text runs, plus `chapters/*.txt` for PDF chapter autodetection when `--chapters` is active
- `text.json` or `text-<model>.json`
- rendered markdown when `--rendered-text` or project lyric draft mode is active
- `speech.wav` or provider/model-specific variants
- generated image files
- generated video files
- generated music files
- lyric-video outputs (`.mp4`, `.vtt`, `.srt`) for `music --audio` and `music --batch`
- `run.json`
- `metadata.md` for `metadata --markdown --save`

Provider directories can additionally include:

- `providers/<service>-<model>/transcription.txt`
- `providers/<service>-<model>/result.json`
- `providers/<service>-<model>/checkpoint.json`

Batch runs additionally write:

- `batch.json` for ordinary batch runs
- `extract-batch.json` plus routed `media/`, `document/`, and `x-space/` child batches for `extract`
- one child lyric-video run directory per discovered audio file for `music --batch`

### TTS benchmark snapshot as of April 25, 2026

A checked-in TTS provider comparison lives under:

```text
docs/benchmarks/2026-04-25_02-36-42-642_tts-long/
```

The artifact set includes:

- `provider-comparison-report.md`
- `provider-comparison-report.json`
- `consensus-evaluation.txt`
- `run.json`
- generated `.wav` outputs for each tested provider/model

Benchmark summary:

| Field | Value |
|-------|-------|
| Input | `input/examples/tts/tts-long.md` |
| Input size | 612 characters, 119 words |
| Providers | 15 total: 4 local, 11 cloud |
| Metric | composite score |
| Formula | 60% speaking-rate naturalness, 20% cost, 20% speed |

Highlights from the checked-in report:

| Highlight | Result |
|-----------|--------|
| Best local model | `kitten/kitten-tts-nano`, score 38.64/100, 4.09s processing time, zero cost |
| Best cloud service | `openai/gpt-4o-mini-tts`, score 36.73/100, 7.49s processing time, 0.7711 cents |
| Cheapest cloud service | `gemini/gemini-2.5-flash-preview-tts`, 0.0306 cents |
| Fastest local model | `kitten/kitten-tts-nano`, 4.09s |
| Fastest cloud service | `elevenlabs/eleven_turbo_v2_5`, 1.32s |

The report did not include roundtrip STT transcription scoring. Its rankings are based on speaking-rate naturalness, cost, and processing speed rather than human listening or intelligibility verification.
