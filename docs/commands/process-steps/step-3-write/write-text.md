# write

Run the full download plus transcription or extraction pipeline, then generate structured step-3 output with a local or hosted LLM.

## Outline

- [Setup](#setup)
- [Usage](#usage)
- [Models](#models)
- [Prompts](#prompts)
- [Output](#output)
- [Examples](#examples)
- [Flags](#flags)
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
```

## Usage

```bash
bun as write [input] [flags]
```

`write` still uses the normal step 1 and step 2 routing. The LLM flag you choose only controls step 3.

Project lyric draft mode is enabled only when the input is `./output/<name>/text` or a `.md` / `.txt` file under that directory. In that mode, `write` treats the input as raw text, reads `./output/<name>/prompt.md` by default, uses `./output/<name>/tracks.md` when present, and writes rendered markdown drafts to `./output/<name>/lyrics`.

## Models

### Local

| Selection | Models |
|-----------|--------|
| `--llama <model>` | setup-managed: `ggml-org/gemma-3-270m-it-GGUF`, `ggml-org/Qwen3-0.6B-GGUF`; or any Hugging Face repo ID in `namespace/repo_name` form |

If you pass `--llama` without a value, `write` uses the default local model `ggml-org/gemma-3-270m-it-GGUF`.

### Hosted

| Provider | Selection | Models |
|----------|-----------|--------|
| OpenAI | `--openai <model>` | `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Anthropic | `--anthropic <model>` | `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-6` |
| Gemini | `--gemini <model>` | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview` |
| Groq | `--groq <model>` | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |
| MiniMax | `--minimax <model>` | `MiniMax-M2.5`, `MiniMax-M2.5-highspeed` |
| Grok | `--grok <model>` | `grok-4.20-reasoning`, `grok-4.20-non-reasoning` |

Hosted provider flags also accept an omitted value and then resolve to the cheapest supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

## Prompts

Prompt names are assembled at runtime from JSON files discovered recursively under `src/prompts/entries/`. Common names include:

- `default`
- `shortSummary`
- `longSummary`
- `chapters`

## Output

- `write` output is JSON by default.
- Single-target runs write `text.json`.
- Multi-target runs write `text-<model>.json` for each selected LLM target.
- `--rendered-text` writes rendered markdown inside the run directory.
- `--rendered-out-dir <dir>` also writes rendered markdown to another directory.
- Project lyric draft mode defaults `--rendered-out-dir` to `./output/<name>/lyrics`.
- Providers with native structured output use it directly; other providers use the internal schema-guided fallback path.
- EPUB inspect mode keeps the extraction payload in `run.json` and still writes the normal step-3 JSON output.

## Examples

```bash
# Default local llama model
bun as write input/examples/audio/1-audio.mp3 --llama

# Explicit local model
bun as write input/examples/audio/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF

# Hosted providers
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4
bun as write input/examples/audio/1-audio.mp3 --anthropic claude-opus-4-7
bun as write input/examples/audio/1-audio.mp3 --gemini gemini-3.1-flash-lite-preview

# Hosted STT plus hosted write
bun as write input/examples/audio/1-audio.mp3 --gcloud-stt --openai gpt-5.4

# Document input plus local summary
bun as write input/examples/document/1-document.pdf --llama ggml-org/gemma-3-270m-it-GGUF

# EPUB inspect mode plus local summary
bun as write input/examples/document/1-epub.epub --epub-bun --llama --out json

# Multiple prompts
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --prompt shortSummary longSummary

# Same provider, multiple models
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --openai gpt-5.4-mini

# Multi-provider run
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --groq openai/gpt-oss-20b

# Generate all lyric drafts for a project under ./output/demo
bun as write ./output/demo/text --prompt rockSong

# Generate one project lyric draft with a hosted model
bun as write ./output/demo/text/01-track-one.md --openai gpt-5.4 --prompt folkSong

# Estimate project lyric draft generation without creating run directories
bun as write ./output/demo/text --price
```

## Flags

| Flag | Description |
|------|-------------|
| `--llama <model>` | Select one or more local llama.cpp model IDs or Hugging Face repo IDs |
| `--openai <model>` | Select one or more OpenAI models; omit the value to use the cheapest supported model |
| `--anthropic <model>` | Select one or more Anthropic models; omit the value to use the cheapest supported model |
| `--gemini <model>` | Select one or more Gemini models; omit the value to use the cheapest supported model |
| `--groq <model>` | Select one or more Groq models; omit the value to use the cheapest supported model |
| `--minimax <model>` | Select one or more MiniMax models; omit the value to use the cheapest supported model |
| `--grok <model>` | Select one or more Grok models; omit the value to use the cheapest supported model |
| `--llm-provider-concurrency <n>` | Hosted LLM providers/models to run concurrently per write item; default `2` |
| `--llm-local-concurrency <n>` | Local llama.cpp models to run concurrently per write item; default `1` |
| `--prompt <name...>` | Select prompt presets |
| `--text-input` | Treat local `.md` / `.txt` files and directories as raw source text |
| `--prompt-file <file>` | Prepend instructions from a local text file before named prompt presets |
| `--rendered-text` | Save rendered step-3 markdown output inside the run directory |
| `--rendered-out-dir <dir>` | Also write rendered step-3 markdown files to this directory |
| `--track-list <file>` | Optional `tracks.md` file used to prepend track-number headers on saved rendered text |
| `--price` | Show the aggregated estimate and exit |

## Notes

- `write` accepts the same step-2 OCR and STT flags documented in [`ocr`](../step-2-ocr/ocr-document.md) and [`stt`](../step-2-stt/stt-audio.md), including `--gcloud-stt`, `--happyscribe-stt`, and `--happyscribe-organization-id`, but each `write` run may select at most one STT provider and at most one OCR provider.
- `write` also accepts `--epub-bun` and `--epub-calibre`; when `--out` is set alongside either flag, it must be `json`.
- Resume is exposed as the top-level `resume` command for STT and OCR outputs, not as a `write` flag.
- `write` also accepts post-generation flags for [`tts`](../step-4-tts/text-to-speech.md), [`image`](../step-5-image/text-to-image.md), video, and music. Those options are documented on their own command pages instead of being repeated here.
- Post-generation steps still require exactly one step-3 LLM output. Repeating `--openai`, `--llama`, or any other LLM flag produces multiple step-3 outputs and therefore skips TTS, image, video, and music generation for that run.
- `--batch-concurrency` controls how many batch items run at once. `--llm-provider-concurrency` and `--llm-local-concurrency` control LLM fan-out inside each write item.
- `write ./output/<name>/text` and files under that directory automatically enable project lyric draft mode. Shorthands such as `write demo` or `write ./output/demo` do not.
- Project lyric draft mode requires `./output/<name>/prompt.md` unless `--prompt-file` is supplied. Explicit `--prompt-file`, `--track-list`, and `--rendered-out-dir` values override the project defaults.
