# AutoShow Bun CLI v0.1 Release

This release note explains what AutoShow is, what ships in v0.1, and how to start using the Bun CLI.

Current CLI help in this repo reports `bun as v0.1.0`; this document uses `v0.1` as the release label.
The package version and run-manifest schema version are separate scopes: the package is `0.1.0`, persisted config is unversioned, and run manifests use schema version `2`.

## Release Summary

AutoShow is a Bun-native, pipeline-oriented CLI for turning media, documents, HTML/articles, X/Twitter Space metadata, raw text, text prompts, episode scripts, and JavaScript dependency manifests into:

- downloaded files and source metadata
- transcripts, OCR output, article extracts, and prompt-ready text
- X Space metadata reports
- JSON write outputs from one or more LLM providers
- generated speech, images, video, music, and local lyric videos
- transcript videos, comic scene/panel assets, and Socket dependency insight reports

The v0.1 release puts those workflows behind one command-first entrypoint:

```bash
bun as <command> [input] [flags]
```

It supports:

- local and service-backed engines across STT, OCR, LLM, TTS, image, video, and music
- persistent CLI defaults in `config/autoshow.json`
- automatic cost preflight and budget enforcement for hosted or mixed-provider runs
- persistent STT media cache management
- configurable provider/local concurrency
- setup, config, provider docs, read-only dependency reporting, benchmarking, and resumable output utilities

AutoShow classifies targets as:

- media
- document
- article/HTML
- image
- X Space input
- batch source
- raw text
- direct prompt input
- episode script
- package manifest

Artifact-producing runs write a timestamped output directory with files from each step plus run metadata for provider/model choices, timing, estimated cost, and actual cost when available.

## Workflow Coverage

AutoShow currently exposes 16 named commands, plus built-in `help` and `version`.

| Command | Use it for |
|---------|------------|
| `config` | Inspect, reset, or persist selected defaults in `config/autoshow.json` |
| `cache` | Prune or clear the persistent STT media cache |
| `setup` | Install local runtimes, verify prerequisites, check cloud auth, generate fixtures, or download local models |
| `sock` | Write a read-only Socket dependency inventory, score, scan, and upgrade/security guidance report |
| `links` | Fetch curated provider documentation into local markdown files |
| `resume` | Fill missing provider outputs in an existing run or batch directory |
| `benchmark` | Compare STT quality across compression/speed variants or score an existing TTS run |
| `metadata` | Inspect media, document, or article metadata without downloading |
| `download` | Fetch or normalize media, documents, and articles, then stop |
| `extract` | Run STT, OCR/native extraction, article extraction, or X Space metadata extraction without LLM writing |
| `write` | Run the full extraction plus prompt-rendering and JSON LLM-output pipeline |
| `tts` | Generate speech audio from local text |
| `image` | Generate images from text prompts |
| `video` | Generate hosted videos from text prompts |
| `music` | Generate hosted music or render local lyric videos |
| `comic` | Run staged episode-script-to-comic workflows for scenes, character sketches, panel prompts, review sketches, final panels, and page images |
| `help`, `version` | Show command help or print the current CLI version |

High-value v0.1 behaviors:

- Hosted and mixed-provider runs get cost preflight, `--price` estimate-only mode, and budget enforcement.
- Batch runs support limits, ordering, and configurable item concurrency.
- Provider/model flags are repeatable across STT, OCR, LLM, TTS, image, video, and music, and `--all-*` fan-out modes cover supported URL, LLM, image, video, and music targets.
- Per-step provider/local concurrency controls provider fan-out.
- `write` coordinates routed STT/OCR, LLM fan-out, structured JSON output, optional rendered markdown, optional post-generation, and project lyric draft mode from `./output/<name>/text`.
- `extract` can render transcript videos from existing STT artifacts without calling a provider.
- `music` can generate hosted music or render local lyric videos from repo audio with local Whisper captions and ffmpeg.
- `resume` backfills missing STT, OCR, TTS, image, video, and music outputs in existing runs or batches.
- `benchmark` can run STT compression/speed tests or score existing TTS runs, including local no-paid-call scoring mode.
- Global runtime flags include:
  - `--config-path`
  - `--allow-over-budget`
  - `--verbose`
  - `--quiet/-q`
  - `--json`

Quick start:

```bash
bun as setup --doctor
bun as sock
bun as extract input/examples/audio/1-audio.mp3
bun as extract output/<extract-run-dir> --transcript-video
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4
bun as write ./output/demo/text --prompt rockSong
bun as extract input/examples/document/1-document.pdf --out json
bun as extract https://ajcwebdev.com --url-backend firecrawl
bun as extract https://ajcwebdev.com --all-url
bun as extract https://x.com/i/spaces/1DXxyRYNejbKM
bun as write ./notes/source.md --text-input --openai gpt-5.4 --prompt folkSong
bun as tts input/examples/tts/1-tts.md --kitten kitten-tts-nano-0.8-int8
bun as image "a clean product photo of a red enamel camping mug" --openai gpt-image-2 --image-size 1024x1024
bun as video "a cinematic mountain sunrise" --gemini veo-3.1-lite-generate-preview
bun as music --audio input/examples/lyrics/01-example-song.mp3
bun as music "bright 90s pop rock with a huge chorus" --gemini lyria-3-clip-preview
bun as benchmark docs/benchmarks/tts/<run> --tts --tts-mode local
bun as comic draft-scenes 05-01
bun as comic generate-images 05-01 --panels-per-image 6
bun as resume ./output/<run-or-batch-dir> --deepinfra-stt
```

`write` is the central orchestration command. STT is not a standalone top-level command in v0.1; it is the media route inside `extract` and `write`.

## Inputs And Providers

AutoShow routes:

- media files and URLs through metadata, download, STT extraction, or write workflows
- documents, images, and articles through extraction or write workflows
- X Space URLs, X posts, and raw Space IDs through X metadata extraction
- text files and prompt strings through write and generation commands
- directories, URL-list files, YouTube channels/playlists, and RSS/Atom feeds as batches
- episode scripts through staged comic scene, prompt, sketch, panel, and page generation
- JavaScript package manifests through read-only Socket dependency insight reports

For `.md` and `.txt` inputs, `write` normally treats files as URL lists. Use `write --text-input` for raw source text outside the project-text convention.

Local engines include:

- Whisper.cpp and Reverb
- OCR tooling and native document extraction
- Defuddle article extraction
- llama.cpp
- Kitten TTS
- local FFmpeg/Whisper transcript-video and lyric-video tooling

Service integrations and local utility surfaces span:

- STT
- OCR/article extraction, including `extract <url> --all-url` provider comparison runs
- LLM writing
- TTS
- image generation
- video generation
- music generation
- transcript-video and lyric-video rendering
- comic scene/panel generation
- dependency analysis through the system Socket CLI

The live flag registry is the source of truth for supported model IDs.
Use these references for current model lists, option details, and provider setup notes:

- `bun as help <command>`
- [command overview](./commands.md)
- [write](./commands/process-steps/step-3-write/write-text.md)
- [TTS](./commands/process-steps/step-4-tts/text-to-speech.md)
- [image](./commands/process-steps/step-5-image/text-to-image.md)
- [video](./commands/process-steps/step-6-video/text-to-video-services.md)
- [music](./commands/process-steps/step-7-music/text-to-music-services.md)
- [comic](./commands/process-steps/step-8-comic/comic.md)
- [sock](./commands/setup-and-utilities/sock/sock.md)
- [benchmark](./commands/setup-and-utilities/benchmark/benchmark.md)

## Prompts, Config, Pricing, And Output

Prompts live in JSON files discovered recursively under `src/prompts/entries/`.
The library includes:

- summary prompts
- chapter prompts
- marketing prompts
- social prompts
- creative-writing prompts
- song-lyric prompts

`write` produces JSON output (`text.json` or `text-<model>.json`) and can optionally render markdown alongside it. See the [write command docs](./commands/process-steps/step-3-write/write-text.md) for prompt and output details.

Persistent config lives in `config/autoshow.json` and can store selected defaults for:

- providers and prompts
- batch controls
- generation options
- concurrency
- cache behavior
- cloud staging
- pricing thresholds

Runtime-only flags are intentionally not persisted, including:

- `--price`
- `--allow-over-budget`
- setup-only verification fields
- `--music-lyrics-file`
- `--music-instrumental`

```bash
bun as config --show
bun as config --openai gpt-5.4 --whisper-stt large-v3-turbo
bun as config --batch-limit 20 --batch-order oldest --max-cents 50
bun as config --reset
```

Hosted or mixed-provider runnable commands perform preflight cost estimation.
Pricing controls:

- `--price` prints an estimate and exits
- configured `max-cents` values act as hard budgets
- `--allow-over-budget` provides a one-off override

See [Pricing Preflight](./commands.md#pricing-preflight) and the individual command docs for provider-specific pricing behavior.

`bun as setup` orchestrates local prerequisites and provider-specific setup hooks. See the [setup docs](./commands/process-steps/step-0-setup/setup.md) for step-specific setup and doctor checks.
Common setup modes include:

```bash
bun as setup --doctor
bun as setup
bun as setup --gcloud
bun as setup --aws
bun as setup --models base --models ggml-org/gemma-3-270m-it-GGUF
```

Most artifact-producing runs write a timestamped directory under `output/`.
Common artifacts include:

- downloaded or normalized inputs
- `prompt.md`
- `transcription.txt`
- extracted text or OCR output
- X Space `extraction.md` reports
- `text.json` or `text-<model>.json`
- generated media files
- `run.json`
- transcript-video `.mp4`, `.vtt`, and `.srt` files
- lyric-video `.mp4`, `.vtt`, and `.srt` files
- Socket reports under `project/reports/socket/`
- comic prompt and scene assets under `output/episode-prompts/`
- comic panel, review sketch, and page images under `output/episode-comics/`
- reusable character sketches under `output/characters/sketches/`

Batch runs also write parent manifests, and generation commands write provider-specific files when multiple targets are selected. See [Types, Metadata & Output Layout](./diagrams/05-types-and-output.md) for the full manifest shape.
