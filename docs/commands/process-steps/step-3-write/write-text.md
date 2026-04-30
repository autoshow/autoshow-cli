# write

Run the full download plus transcription or extraction pipeline, then generate structured step-3 output with a local or hosted LLM.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared Write Options](#shared-write-options)
- [Write Services](#write-services)
  - [Local llama.cpp](#local-llamacpp)
  - [OpenAI](#openai)
  - [Anthropic](#anthropic)
  - [Gemini](#gemini)
  - [Groq](#groq)
  - [MiniMax](#minimax)
  - [Grok](#grok)
  - [Z.AI GLM](#zai-glm)
  - [Kimi](#kimi)
- [Prompts](#prompts)
  - [Summary and Overview](#summary-and-overview)
  - [Chapters](#chapters)
  - [Marketing Content](#marketing-content)
  - [Social Media](#social-media)
  - [Song Lyrics](#song-lyrics)
  - [Creative Writing](#creative-writing)
- [Output](#output)
- [Notes](#notes)

## Setup

```bash
# full setup
bun as setup

# install llama.cpp and download the setup-managed local write models
bun as setup --step write

# optional: add larger local transcription assets used by some write flows
bun as setup --step transcription
```

Local write runtime pieces:

- `runtime/bin/llama-server`
- local models under `runtime/models/llama/`

### Environment

Only hosted LLM providers need API keys:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
MINIMAX_API_KEY=...
XAI_API_KEY=...
GLM_API_KEY=...
KIMI_API_KEY=...
```

## Usage

```bash
bun as write [input] [flags]
```

`write` still uses the normal step 1 and step 2 routing. The LLM flag you choose only controls step 3.

Project lyric draft mode is enabled only when the input is `./output/<name>/text` or a `.md` / `.txt` file under that directory. In that mode, `write` treats the input as raw text, reads `./output/<name>/prompt.md` by default, uses `./output/<name>/tracks.md` when present, and writes rendered markdown drafts to `./output/<name>/lyrics`.

## Shared Write Options

| Flag | Description |
|------|-------------|
| `--llm-provider-concurrency <n>` | Hosted LLM providers/models to run concurrently per write item; default `2` |
| `--llm-local-concurrency <n>` | Local llama.cpp models to run concurrently per write item; default `1` |
| `--prompt <name...>` | Select prompt presets |
| `--text-input` | Treat local `.md` / `.txt` files and directories as raw source text |
| `--prompt-file <file>` | Prepend instructions from a local text file before named prompt presets |
| `--rendered-text` | Save rendered step-3 markdown output inside the run directory |
| `--rendered-out-dir <dir>` | Also write rendered step-3 markdown files to this directory |
| `--track-list <file>` | Optional `tracks.md` file used to prepend track-number headers on saved rendered text |
| `--prompt-md` | Save a second prompt file (`prompt-md.md`) with markdown examples alongside the JSON prompt |
| `--price` | Show the aggregated estimate and exit |

```bash
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --prompt shortSummary longSummary
bun as write ./output/demo/text --prompt rockSong
bun as write ./output/demo/text --price
```

## Write Services

Provider flags accept an omitted value and then resolve to the cheapest supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

### Local llama.cpp

| Option | Value |
|--------|-------|
| Selector | `--llama <model>` |
| Models | setup-managed `ggml-org/gemma-3-270m-it-GGUF`, `ggml-org/Qwen3-0.6B-GGUF`; or any Hugging Face repo ID in `namespace/repo_name` form |
| Default | Passing `--llama` without a value uses `ggml-org/gemma-3-270m-it-GGUF` |

```bash
bun as write input/examples/audio/1-audio.mp3 --llama
bun as write input/examples/audio/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF
bun as write input/examples/document/1-document.pdf --llama ggml-org/gemma-3-270m-it-GGUF
bun as write input/examples/document/1-epub.epub --epub-bun --llama --out json
```

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--openai <model>` |
| Models | `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano` |

```bash
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4
bun as write input/examples/audio/1-audio.mp3 --gcloud-stt --openai gpt-5.4
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --openai gpt-5.4-mini
bun as write ./output/demo/text/01-track-one.md --openai gpt-5.4 --prompt folkSong
```

### Anthropic

| Option | Value |
|--------|-------|
| Selector | `--anthropic <model>` |
| Models | `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-6` |

```bash
bun as write input/examples/audio/1-audio.mp3 --anthropic claude-opus-4-7
```

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--gemini <model>` |
| Models | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview` |

```bash
bun as write input/examples/audio/1-audio.mp3 --gemini gemini-3.1-flash-lite-preview
```

### Groq

| Option | Value |
|--------|-------|
| Selector | `--groq <model>` |
| Models | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |

```bash
bun as write input/examples/audio/1-audio.mp3 --groq openai/gpt-oss-20b
```

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--minimax <model>` |
| Models | `MiniMax-M2.5`, `MiniMax-M2.5-highspeed` |

```bash
bun as write input/examples/audio/1-audio.mp3 --minimax MiniMax-M2.5
```

### Grok

| Option | Value |
|--------|-------|
| Selector | `--grok <model>` |
| Models | `grok-4.20-reasoning`, `grok-4.20-non-reasoning` |

```bash
bun as write input/examples/audio/1-audio.mp3 --grok grok-4.20-non-reasoning
```

### Z.AI GLM

| Option | Value |
|--------|-------|
| Selector | `--glm <model>` |
| Models | `glm-5.1` |
| Structured output | Uses Z.AI's OpenAI-compatible chat API with JSON mode and disables GLM thinking for predictable write latency |

```bash
bun as write input/examples/audio/1-audio.mp3 --glm glm-5.1
```

GLM 5.1 estimates are based on the Z.AI GLM text docs in `project/links/glm-general-text-links.md`: input `$1.40 / 1M tokens`, output `$4.40 / 1M tokens`, cached input `$0.26 / 1M tokens`, and 200K context with 128K maximum output. AutoShow uses uncached input/output pricing for `--price` because the write pipeline does not use Z.AI context caching. The speed estimate is `18000 ms / 1K tokens`, matching AutoShow's hosted LLM fallback until live benchmarks are available.

### Kimi

| Option | Value |
|--------|-------|
| Selector | `--kimi <model>` |
| Models | `kimi-k2.6` |
| Structured output | Uses Kimi's OpenAI-compatible chat API with JSON mode and disables K2.6 thinking for predictable write latency |

```bash
bun as write input/examples/audio/1-audio.mp3 --kimi kimi-k2.6
```

Kimi K2.6 estimates are based on `project/links/kimi-general-ocr-text-links.md`: input `$0.95 / 1M tokens`, output `$4.00 / 1M tokens`, cached input `$0.16 / 1M tokens`, and 256K context. AutoShow uses cache-miss input/output pricing for `--price` and a speed estimate of `18000 ms / 1K tokens` until live benchmarks are available.

```bash
# Multi-provider run
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --groq openai/gpt-oss-20b --glm glm-5.1 --kimi kimi-k2.6
```

## Prompts

Prompt names are assembled at runtime from JSON files discovered recursively under `src/prompts/entries/`. Available prompts organized by category:

### Summary and Overview

- `default`
- `shortSummary`
- `longSummary`
- `bulletPoints`
- `takeaways`
- `quotes`
- `keyMoments`
- `faq`
- `questions`
- `metadata`

### Chapters

- `chapterTitles`
- `chapterTitlesAndQuotes`
- `shortChapters`
- `mediumChapters`
- `longChapters`
- `pdfChapterBoundaries`

### Marketing Content

- `blog`
- `seoArticle`
- `contentStrategy`
- `emailNewsletter`
- `titles`

### Social Media

- `x`
- `tiktok`
- `facebook`
- `instagram`
- `linkedin`
- `youtubeDescription`

### Song Lyrics

- `countrySong`
- `folkSong`
- `jazzSong`
- `popSong`
- `rockSong`
- `rapSong`
- `rapSongLong`

### Creative Writing

- `poetryCollection`
- `screenplay`
- `shortStory`

## Output

- `write` output is JSON by default.
- Single-target runs write `text.json`.
- Multi-target runs write `text-<model>.json` for each selected LLM target.
- `--rendered-text` writes rendered markdown inside the run directory.
- `--rendered-out-dir <dir>` also writes rendered markdown to another directory.
- `--prompt-md` writes a second prompt file (`prompt-md.md`) with markdown-formatted examples alongside the JSON prompt.
- Project lyric draft mode defaults `--rendered-out-dir` to `./output/<name>/lyrics`.
- Providers with native structured output use it directly; other providers use the internal schema-guided fallback path.
- EPUB inspect mode keeps the extraction payload in `run.json` and still writes the normal step-3 JSON output.

## Notes

- `write` accepts the same step-2 STT flags documented in [`extract STT`](../step-2-extract/02-extract-stt.md#shared-stt-options) and provider sections, plus the same step-2 OCR flags documented in [`extract OCR`](../step-2-extract/03-extract-ocr.md#shared-ocr-options) and provider sections. Each `write` run may select at most one STT provider and at most one OCR provider.
- `write` also accepts `--epub-bun` and `--epub-calibre`; when `--out` is set alongside either flag, it must be `json`.
- Resume is exposed as the top-level `resume` command for STT and OCR outputs, not as a `write` flag.
- `write` also accepts post-generation flags for [`tts`](../step-4-tts/text-to-speech.md), [`image`](../step-5-image/text-to-image.md), [`video`](../step-6-video/text-to-video-services.md), and [`music`](../step-7-music/text-to-music-services.md). Those options are documented on their own command pages instead of being repeated here.
- Post-generation steps still require exactly one step-3 LLM output. Repeating `--openai`, `--llama`, or any other LLM flag produces multiple step-3 outputs and therefore skips TTS, image, video, and music generation for that run.
- `--batch-concurrency` controls how many batch items run at once. `--llm-provider-concurrency` and `--llm-local-concurrency` control LLM fan-out inside each write item.
- `write ./output/<name>/text` and files under that directory automatically enable project lyric draft mode. Shorthands such as `write demo` or `write ./output/demo` do not.
- Project lyric draft mode requires `./output/<name>/prompt.md` unless `--prompt-file` is supplied. Explicit `--prompt-file`, `--track-list`, and `--rendered-out-dir` values override the project defaults.
