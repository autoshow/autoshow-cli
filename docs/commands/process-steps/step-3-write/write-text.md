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

Prompt names are assembled at runtime from `src/prompts/entries/*.json`. Common names include:

- `default`
- `shortSummary`
- `longSummary`
- `chapters`

## Output

- `write` output is JSON-only.
- Single-target runs write `text.json`.
- Multi-target runs write `text-<model>.json` for each selected LLM target.
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
| `--prompt <name...>` | Select prompt presets |
| `--price` | Show the aggregated estimate and exit |

## Notes

- `write` accepts the same step-2 OCR and STT flags documented in [`ocr`](../step-2-ocr/ocr-document.md) and [`stt`](../step-2-stt/stt-audio.md), including `--gcloud-stt`, but each `write` run may select at most one STT provider and at most one OCR provider.
- `write` also accepts `--epub-bun` and `--epub-calibre`; when `--out` is set alongside either flag, it must be `json`.
- Resume is exposed as the top-level `resume` command for STT and OCR outputs, not as a `write` flag.
- `write` also accepts post-generation flags for [`tts`](../step-4-tts/text-to-speech.md), [`image`](../step-5-image/text-to-image.md), video, and music. Those options are documented on their own command pages instead of being repeated here.
- Post-generation steps still require exactly one step-3 LLM output. Repeating `--openai`, `--llama`, or any other LLM flag produces multiple step-3 outputs and therefore skips TTS, image, video, and music generation for that run.
