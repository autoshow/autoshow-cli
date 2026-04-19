# image

Generate images from a text prompt with the hosted image providers.

## Outline

- [Setup](#setup)
- [Usage](#usage)
- [Providers](#providers)
- [Examples](#examples)
- [Flags](#flags)
- [Output](#output)
- [Notes](#notes)

## Setup

There are no local image-generation models in this project.

```bash
# optional confirmation step; image providers are API-based
bun as setup --step image
```

### Environment

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
```

## Usage

```bash
bun as image <prompt> [flags]
```

## Providers

| Provider | Flag | Models |
|----------|------|--------|
| Gemini | `--gemini-image <model>` | `gemini-3-pro-image-preview`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001` |
| OpenAI | `--openai-image <model>` | `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini` |
| MiniMax | `--minimax-image <model>` | `image-01` |

Provider flags accept an omitted model value and then resolve to the cheapest supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

## Examples

```bash
# Gemini native image generation
bun as image "a serene mountain lake at dawn" --gemini-image gemini-3-pro-image-preview

# Imagen 4 with multiple outputs
bun as image "a serene mountain lake at dawn" --gemini-image imagen-4.0-generate-001 --imagen-count 4 --image-aspect-ratio 16:9

# OpenAI
bun as image "an oil painting of a lighthouse" --openai-image gpt-image-1 --image-quality high --image-size 1536x1024

# MiniMax
bun as image "a dramatic fox portrait in snow" --minimax-image image-01 --image-aspect-ratio 16:9

# Multi-provider
bun as image "a sunset over the lake" --gemini-image imagen-4.0-generate-001 --openai-image gpt-image-1-mini --imagen-count 2

# Same provider, multiple models
bun as image "a sunset over the lake" --openai-image gpt-image-1-mini --openai-image gpt-image-1
```

## Flags

| Flag | Description |
|------|-------------|
| `--gemini-image <model>` | Select one or more Gemini image models; omit the value to use the cheapest supported model |
| `--openai-image <model>` | Select one or more OpenAI image models; omit the value to use the cheapest supported model |
| `--minimax-image <model>` | Select one or more MiniMax image models; omit the value to use the cheapest supported model |
| `--image-aspect-ratio <ratio>` | Aspect ratio control for Gemini and MiniMax |
| `--image-size <size>` | Size control: `1K`, `2K`, `4K` for Gemini, or `1024x1024`, `1536x1024`, `1024x1536` for OpenAI |
| `--imagen-count <n>` | Number of images to generate for Imagen 4 models |
| `--image-quality <q>` | OpenAI quality: `low`, `medium`, `high`, or `auto` |
| `--image-format <fmt>` | OpenAI output format: `png`, `jpeg`, or `webp` |
| `--image-background <bg>` | OpenAI background mode: `transparent`, `opaque`, or `auto` |
| `--price` | Show the aggregated estimate and exit |

## Output

- Standalone `image` runs always write `run.json`.
- Gemini writes `generated-image.png`, plus numbered variants when multiple images are returned.
- OpenAI writes `generated-image.<format>`.
- MiniMax writes `generated-image.jpeg`.
- Multi-provider runs rename outputs to include the provider and model, such as `generated-image-openai-gpt-image-1-mini.png`.
- `run.json` includes `image`, `cost`, and `timing` sections. The `image` field is always an array, and each entry includes `imageFileNames`.

## Notes

- `--image-size` is currently rejected for `imagen-4.0-fast-generate-001`.
