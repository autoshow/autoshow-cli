# AutoShow Bun CLI v0.1 Release

This release note explains what AutoShow is, what ships in v0.1, and how to start using the Bun CLI.

Current CLI help in this repo reports `bun as v0.1.0`; this document uses `v0.1` as the release label.
The package version and run-manifest schema version are separate scopes: the package is `0.1.0`, persisted config is unversioned, and run manifests use schema version `2`.

## Release Summary

AutoShow is a Bun-native, pipeline-oriented CLI for turning media, documents, HTML/articles, X/Twitter Space metadata, raw text, and text prompts into:

- downloaded files and source metadata
- transcripts, OCR output, article extracts, and prompt-ready text
- X Space metadata reports
- JSON write outputs from one or more LLM providers
- generated speech, images, video, music, and local lyric videos

The v0.1 release puts those workflows behind one command-first entrypoint:

```bash
bun as <command> [input] [flags]
```

It supports local and service-backed engines across STT, OCR, LLM, TTS, image, video, and music; persistent CLI defaults in `config/autoshow.json`; automatic cost preflight and budget enforcement for hosted or mixed-provider runs; persistent STT media cache management; and utility commands for setup, config, provider docs, benchmarking, and resumable output backfills.

AutoShow classifies each target as media, document, article/HTML, image, X Space input, batch source, raw text, or direct prompt input.
Artifact-producing runs write a timestamped output directory with files from each step plus run metadata for provider/model choices, timing, estimated cost, and actual cost when available.

## Workflow Coverage

| Command | Use it for |
|---------|------------|
| `metadata` | Inspect media, document, or article metadata without downloading |
| `download` | Fetch or normalize media, documents, and articles, then stop |
| `extract` | Run STT, OCR/native extraction, article extraction, or X Space metadata extraction without LLM writing |
| `write` | Run the full extraction plus prompt-rendering and JSON LLM-output pipeline |
| `tts`, `image`, `video`, `music` | Run standalone generation from local text or prompt strings |
| `config` | Inspect, reset, or persist selected defaults in `config/autoshow.json` |
| `cache` | Prune or clear the persistent STT media cache |
| `setup` | Install local runtimes, verify prerequisites, check cloud auth, generate fixtures, or download local models |
| `links` | Fetch curated provider documentation into local markdown files |
| `resume` | Fill missing provider outputs in an existing run or batch directory |
| `benchmark` | Compare STT transcription quality across compression and speed variants |
| `help`, `version` | Show command help or print the current CLI version |

High-value v0.1 behaviors:

- Hosted and mixed-provider runnable commands run an automatic cost preflight before execution.
- `--price` provides estimate-only previews for hosted or mixed-provider runs.
- Batch processing supports `--batch-limit`, `--batch-all`, `--batch-order`, and configurable `--batch-concurrency`, defaulting to `1`.
- `write` can fan out across multiple LLM providers and writes provider-specific JSON artifacts for each result.
- `write` accepts at most one STT provider and at most one OCR provider per pipeline run; `extract` supports multi-provider STT and OCR runs.
- Existing STT, OCR, TTS, image, video, and music outputs can be filled in with `resume`.
- HTML/article inputs can use `defuddle`, `firecrawl`, `glm-reader`, `spider`, or `zyte` via `--url-backend`.
- X Space extraction accepts X/Twitter Space URLs, X post URLs that reference Spaces, and raw Space IDs.
- The persistent STT cache is managed with `bun as cache prune` and `bun as cache clear`; runs can force refresh or bypass it with `--refresh-cache` and `--no-cache`.
- Global runtime flags include `--config-path`, `--verbose`, `--quiet/-q`, and `--json`.

Quick start:

```bash
# check prerequisites without installing
bun as setup --doctor

# install local runtimes and verify core tools
bun as setup

# inspect metadata
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# extract media through the STT route
bun as extract input/examples/audio/1-audio.mp3

# run the full media pipeline with a service LLM
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4

# extract documents, articles, and X Spaces
bun as extract input/examples/document/1-document.pdf --out json
bun as extract https://ajcwebdev.com --url-backend firecrawl
bun as extract https://ajcwebdev.com --url-backend spider
bun as extract https://x.com/i/spaces/1DXxyRYNejbKM

# process raw source text instead of treating .md/.txt as URL lists
bun as write ./notes/source.md --text-input --openai gpt-5.4 --prompt folkSong

# standalone generation
bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-nano-0.8-int8
bun as image "a clean product photo of a red enamel camping mug" --openai-image gpt-image-2 --image-size 1024x1024
bun as video "a cinematic mountain sunrise" --gemini-video veo-3.1-lite-generate-preview
bun as music "bright 90s pop rock with a huge chorus" --gemini-music lyria-3-clip-preview

# fill missing provider outputs from an existing run or batch
bun as resume ./output/<run-or-batch-dir> --deepinfra-stt

# fetch curated provider docs
bun as links stt
```

`write` is the central orchestration command.
It can summarize media transcripts, extracted documents, and article content; process raw `.md` or `.txt` files with `--text-input`; process project text directories under `output/<project>/text` into `output/<project>/lyrics`; fan out across multiple LLM providers; and pass final text into TTS, image, video, or music generation.

STT is not a standalone top-level command in v0.1.
It is the media route inside `extract` and `write`.

## Inputs And Providers

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

For `.md` and `.txt` inputs, `write` normally treats files as URL lists.
Use `write --text-input` for raw source text outside the project-text convention.

Document and image extraction covers PDFs; ebook and comic formats such as EPUB, MOBI/AZW variants, FB2, LIT, and CBZ; Office and OpenDocument files; RTF and CSV; HTML/article content; and common raster image formats.
EPUB can use cleaned native text extraction, EPUB/PDF chapter extraction can write `chapters/`, and Office formats attempt native ZIP/XML extraction before falling back to OCR when quality heuristics fail.
OCR flags are ignored for HTML/article inputs because those inputs use the article extraction path.

Local engines include Whisper.cpp, Reverb, YouTube caption preference, MuPDF/Tesseract, OCRmyPDF, PaddleOCR, EPUB/native office extraction, Defuddle article extraction, llama.cpp, Kitten TTS, and local FFmpeg/Whisper lyric-video tooling.
Service integrations cover providers across STT, OCR/article extraction, LLM writing, TTS, image, video, and music generation, including Google Cloud, AWS, OpenAI, Gemini, Anthropic, Groq, Grok, GLM, Kimi, MiniMax, Mistral, DeepInfra, Deepgram, ElevenLabs, Runway, deAPI, BFL, Firecrawl, and others.

The live flag registry is the source of truth for supported model IDs.
Use `bun as help <command>` or `docs/commands/` for current model lists, option details, and provider setup notes.

## Prompts, Config, Pricing, And Output

Prompts live in JSON files discovered recursively under `src/prompts/entries/`.
The library includes summary, chapter, marketing, social, creative-writing, and song-lyric prompts.
The `default` prompt expands to:

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

Persistent config lives in `config/autoshow.json`. An empty config is:

```json
{}
```

Config can persist selected defaults for provider/model choices, prompts, batch controls, STT/OCR/TTS/image/video/music options, cache behavior, cloud staging, and pricing thresholds.
The same global `--config-path` override works on every command, not just `config`.

```bash
bun as config --show
bun as config --openai gpt-5.4 --whisper-stt large-v3-turbo
bun as config --batch-limit 20 --batch-order oldest --max-cents 50
bun as config --reset
```

Hosted or mixed-provider runnable commands perform preflight cost estimation.
`--price` prints an estimate and exits, configured `max-cents` values act as hard budgets, and `--allow-over-budget` provides a one-off override.
`music --audio` and `music --batch` are local lyric-video modes: they do not run cost preflight and reject hosted music-generation flags, including `--price`.

`bun as setup` orchestrates local prerequisites such as `uv`, `yt-dlp`, FFmpeg/ffprobe, Whisper.cpp, llama.cpp, Reverb, Calibre, local OCR dependencies, Kitten TTS, and provider-specific setup hooks.
Common setup modes include:

```bash
bun as setup --doctor
bun as setup
bun as setup --gcloud
bun as setup --aws
bun as setup --models base --models ggml-org/gemma-3-270m-it-GGUF
bun as setup --sample --verify-only
```

Most artifact-producing runs write a timestamped directory under `output/`.
Common artifacts include downloaded or normalized inputs, `prompt.md`, `transcription.txt`, extracted text or OCR output, X Space `extraction.md` reports, `text.json` or `text-<model>.json`, generated media files, and `run.json`.
Batch runs also write a parent batch manifest, and `extract` batches route mixed inputs under media, document, and X Space child batches.
