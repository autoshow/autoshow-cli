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
| Anthropic | `--anthropic <model>` | `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5` |
| Gemini | `--gemini <model>` | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview` |
| Groq | `--groq <model>` | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |
| MiniMax | `--minimax <model>` | `MiniMax-M2.5`, `MiniMax-M2.5-highspeed` |
| Grok | `--grok <model>` | `grok-4.20-reasoning`, `grok-4.20-non-reasoning` |

Hosted provider flags also accept an omitted value and then resolve to the cheapest supported model.

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

## Examples

```bash
# Default local llama model
bun as write input/examples/audio/1-audio.mp3 --llama

# Explicit local model
bun as write input/examples/audio/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF

# Hosted providers
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4
bun as write input/examples/audio/1-audio.mp3 --anthropic claude-sonnet-4-6
bun as write input/examples/audio/1-audio.mp3 --gemini gemini-3.1-flash-lite-preview

# Document input plus local summary
bun as write input/examples/document/1-document.pdf --llama ggml-org/gemma-3-270m-it-GGUF

# Multiple prompts
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --prompt shortSummary longSummary

# Multi-provider run
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --groq openai/gpt-oss-20b
```

## Flags

| Flag | Description |
|------|-------------|
| `--llama <model>` | Select a local llama.cpp model ID or Hugging Face repo ID |
| `--openai <model>` | Select an OpenAI model; omit the value to use the cheapest supported model |
| `--anthropic <model>` | Select an Anthropic model; omit the value to use the cheapest supported model |
| `--gemini <model>` | Select a Gemini model; omit the value to use the cheapest supported model |
| `--groq <model>` | Select a Groq model; omit the value to use the cheapest supported model |
| `--minimax <model>` | Select a MiniMax model; omit the value to use the cheapest supported model |
| `--grok <model>` | Select a Grok model; omit the value to use the cheapest supported model |
| `--prompt <name...>` | Select prompt presets |
| `--price` | Show the aggregated estimate and exit |

## Notes

- `write` accepts the same step-2 OCR and STT flags documented in [`ocr`](../step-2-ocr/ocr-document.md) and [`stt`](../step-2-stt/stt-audio.md).
- `write` also accepts post-generation flags for [`tts`](../step-4-tts/text-to-speech.md), [`image`](../step-5-image/text-to-image.md), video, and music. Those options are documented on their own command pages instead of being repeated here.
