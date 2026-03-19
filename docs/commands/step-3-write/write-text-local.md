# write (local)

Run step 1 + step 2 + step 3 with local LLMs only.

## Outline

- [Usage](#usage)
- [Local LLM service](#local-llm-service)
- [Examples](#examples)
- [Prompts](#prompts)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as write [input] [flags]
```

## Local LLM service

| Service | Selection | Models |
|---------|-----------|--------|
| llama.cpp | `--llama <model>` | local llama.cpp model set |

## Examples

```bash
# Local write pipeline with llama.cpp
bun as write input/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF

# Document input + local summary
bun as write input/1-document.pdf --llama ggml-org/Qwen3-0.6B-GGUF

# Multiple prompts
bun as write input/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF --prompt shortSummary longSummary
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

## Flags

| Flag | Description |
|------|-------------|
| `--llama <model>` | Local llama.cpp model |
| `--prompt <name...>` | Named prompt(s) |
| `--batch-limit <n>` | Process up to `n` items |
| `--batch-all` | Process all discovered inputs |
| `--batch-order <order>` | Batch order control |

## Notes

- Local setup/runtime details are in [`write-text-setup.md`](./write-text-setup.md).
