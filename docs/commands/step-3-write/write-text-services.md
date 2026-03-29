# write (services)

Run `write` with one or more hosted LLM providers.

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

You can select multiple LLM providers in one run. Each provider executes sequentially and writes its own artifact.

## Service LLMs

| Service | Selection | Current models |
|---------|-----------|----------------|
| OpenAI | `--openai <model>` | `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Anthropic | `--anthropic <model>` | `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5` |
| Gemini | `--gemini <model>` | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview` |
| Groq | `--groq <model>` | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |
| MiniMax | `--minimax <model>` | `MiniMax-M2.5`, `MiniMax-M2.5-highspeed` |
| Grok | `--grok <model>` | `grok-4.20-reasoning`, `grok-4.20-non-reasoning` |

## Examples

```bash
# OpenAI
bun as write input/1-audio.mp3 --openai gpt-5.4

# Anthropic
bun as write input/1-audio.mp3 --anthropic claude-sonnet-4-6

# Gemini
bun as write input/1-audio.mp3 --gemini gemini-3.1-flash-lite-preview

# Groq
bun as write input/1-audio.mp3 --groq openai/gpt-oss-20b

# MiniMax
bun as write input/1-audio.mp3 --minimax MiniMax-M2.5

# Grok
bun as write input/1-audio.mp3 --grok grok-4.20-reasoning

# Multi-provider run
bun as write input/1-audio.mp3 --openai gpt-5.4 --groq openai/gpt-oss-20b

# Price preflight
bun as write input/1-audio.mp3 --openai gpt-5.4 --price
```

## Prompts

Prompt names are loaded from `src/prompts/prompts.json`. Common names include:
- `default`
- `shortSummary`
- `longSummary`
- `chapters`

## Structured Outputs

- Structured outputs are enabled by default for non-llama `write` runs.
- Single-provider runs write `text.json`.
- Multi-provider runs write `text-<model>.json` for each provider.
- Use `--no-structured` to keep markdown output.
- MiniMax uses compatibility-mode validation retries because it does not have the same native structured-output path as the other hosted providers.
- `--structured-strict` is only meaningful for providers that support strict schema enforcement.

## Flags

| Flag | Description |
|------|-------------|
| `--openai <model>` | Select an OpenAI model |
| `--anthropic <model>` | Select an Anthropic model |
| `--gemini <model>` | Select a Gemini model |
| `--groq <model>` | Select a Groq model |
| `--minimax <model>` | Select a MiniMax model |
| `--grok <model>` | Select a Grok (xAI) model |
| `--prompt <name...>` | Select prompt preset(s) |
| `--structured` / `--no-structured` | Enable or disable structured JSON output |
| `--structured-strict` / `--no-structured-strict` | Request strict schema mode where supported |
| `--structured-compat-retries <n>` | Retry count for compatibility-mode validation |
| `--price` | Show the aggregated estimate and exit |

## Notes

- Service LLM selection only affects step 3. You can still use local or hosted step 2 engines in the same `write` run.
- When no explicit LLM provider is configured and `--no-structured` is set, document `write` still has a legacy extract-plus-markdown fallback path.
- Service setup details are in [`write-text-local.md#setup`](./write-text-local.md#setup).
