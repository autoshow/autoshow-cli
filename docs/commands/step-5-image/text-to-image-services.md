# image (services)

Generate images with the hosted image providers.

## Outline

- [Usage](#usage)
- [Providers](#providers)
- [Examples](#examples)
- [Flags](#flags)
- [Output](#output)
- [Notes](#notes)

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

You can combine multiple provider flags in one run. Each selected provider generates its own output file set.

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

# Price preflight
bun as image "a sunset" --openai-image gpt-image-1 --minimax-image image-01 --price
```

## Flags

| Flag | Description |
|------|-------------|
| `--gemini-image <model>` | Select a Gemini image model |
| `--openai-image <model>` | Select an OpenAI image model |
| `--minimax-image <model>` | Select a MiniMax image model |
| `--image-aspect-ratio <ratio>` | Aspect ratio control |
| `--image-size <size>` | Size control |
| `--imagen-count <n>` | Number of images for Imagen models |
| `--image-quality <q>` | OpenAI quality |
| `--image-format <fmt>` | OpenAI output format |
| `--image-background <bg>` | OpenAI background mode |
| `--price` | Show the estimate and exit |

## Output

Standalone `image` runs always write `run.json`, and the generated image filenames vary by provider:

- Gemini: `generated-image.png`, plus `generated-image-2.png`, `generated-image-3.png`, and so on when multiple images are returned
- OpenAI: `generated-image.<format>` where the default format is `png`
- MiniMax: `generated-image.jpeg`
- Multi-provider runs rename each provider output to include the provider and model, such as `generated-image-openai-gpt-image-1-mini.png` or `generated-image-gemini-imagen-4.0-generate-001-2.png`

`run.json` includes `image`, `cost`, and `timing` sections. The `image` field is always an array, even when only one provider succeeds. Each image metadata object includes `imageFileNames`.

## Notes

- `--image-size` is currently rejected for `imagen-4.0-fast-generate-001`.
- Setup details are in [`text-to-image-setup.md`](./text-to-image-setup.md).
