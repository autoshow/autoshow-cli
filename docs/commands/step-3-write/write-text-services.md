# write (services)

Run step 1 + step 2 + step 3 with service LLMs only.

## Outline

- [Usage](#usage)
- [Service LLMs](#service-llms)
- [Examples](#examples)
- [Prompts](#prompts)
- [Structured Outputs](#structured-outputs)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as write [input] [flags]
```

## Service LLMs

| Service | Selection | Example models |
|---------|-----------|----------------|
| OpenAI | `--openai <model>` | `gpt-5.1`, `gpt-5.2`, `gpt-5.2-pro` |
| Anthropic | `--anthropic <model>` | `claude-sonnet-4-6`, `claude-opus-4-6` |
| Gemini | `--gemini <model>` | `gemini-3-flash-preview`, `gemini-3-pro-preview` |
| Groq | `--groq <model>` | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |
| MiniMax | `--minimax <model>` | `MiniMax-M2.5`, `MiniMax-M2.5-highspeed` |

You can select multiple LLM services in one run; each provider executes sequentially and writes its own artifact.

## Examples

```bash
# OpenAI
bun as write input/1-audio.mp3 --openai gpt-5.2

# Anthropic
bun as write input/1-audio.mp3 --anthropic claude-sonnet-4-6

# Gemini
bun as write input/1-audio.mp3 --gemini gemini-3-flash-preview

# Groq
bun as write input/1-audio.mp3 --groq openai/gpt-oss-20b

# MiniMax
bun as write input/1-audio.mp3 --minimax MiniMax-M2.5

# Price preflight
bun as write input/1-audio.mp3 --openai gpt-5.2 --price

bun as write input/1-audio.mp3 --groq openai/gpt-oss-20b --openai gpt-5.2 --price
```

## Prompts

Available prompt names:
- `shortSummary`
- `longSummary`
- `chapters`
- `rapSong`
- `default`

Prompt definitions live in `src/prompts/prompts.json`. Each leaf prompt includes
`expectedInputTokens` and `expectedOutputTokens`, which are used for LLM cost estimation.

## Structured Outputs

- Structured outputs are enabled by default for `write` and root command runs.
- Structured runs write JSON artifacts (`text.json`, or `text-<model>.json` for multi-provider runs).
- Use `--no-structured` to keep legacy markdown artifacts (`text.md`).
- MiniMax uses automatic compatibility mode (prompted JSON + validation retries).
- Local `llama.cpp` keeps legacy markdown output (structured mode is currently service-only).
- Strict mode applies only to providers that support it (`--structured-strict`, default on).

## Flags

| Flag | Description |
|------|-------------|
| `--openai <model>` | OpenAI LLM model |
| `--anthropic <model>` | Anthropic LLM model |
| `--gemini <model>` | Gemini LLM model |
| `--groq <model>` | Groq LLM model |
| `--minimax <model>` | MiniMax LLM model |
| `--prompt <name...>` | Named prompt(s) |
| `--structured` / `--no-structured` | Enable/disable structured JSON output |
| `--structured-strict` / `--no-structured-strict` | Request strict schema mode where supported |
| `--structured-compat-retries <n>` | Retry count for compat-mode JSON validation failures |
| `--price` | Show cost estimate and exit |

## Notes

- Service setup/env details are in [`write-text-setup.md`](./write-text-setup.md).
- Document `write` now uses real LLM calls when a provider is configured (cost/latency apply).
- Legacy zero-cost document fallback remains when no LLM provider is configured and `--no-structured` is set.
