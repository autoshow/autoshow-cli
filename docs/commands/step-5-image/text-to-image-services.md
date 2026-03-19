# image (services)

Generate an image from a text prompt using service providers only.

## Outline

- [Usage](#usage)
- [Service providers](#service-providers)
- [Examples](#examples)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as image <prompt> [flags]
```

## Service providers

| Provider | Flag | Models |
|----------|------|--------|
| Gemini | `--gemini-image <model>` | `gemini-3-pro-image-preview`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001` |
| OpenAI | `--openai-image <model>` | `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini` |
| MiniMax | `--minimax-image <model>` | `image-01` |

Only one service provider flag may be used at a time.

## Examples

```bash
# Gemini
bun as image "a serene mountain lake at dawn" --gemini-image gemini-3-pro-image-preview
bun as image "a serene mountain lake at dawn" --gemini-image imagen-4.0-generate-001 --imagen-count 4 --image-aspect-ratio 16:9

# OpenAI
bun as image "an oil painting of a lighthouse" --openai-image gpt-image-1 --image-quality high --image-size 1536x1024

# MiniMax
bun as image "a dramatic fox portrait in snow" --minimax-image image-01 --image-aspect-ratio 16:9

# Service price preflight
bun as image "a sunset" --openai-image gpt-image-1 --price
```

## Flags

| Flag | Description |
|------|-------------|
| `--gemini-image <model>` | Gemini image model |
| `--openai-image <model>` | OpenAI image model |
| `--minimax-image <model>` | MiniMax image model |
| `--image-aspect-ratio <ratio>` | Aspect ratio control |
| `--image-size <size>` | Size hint/control |
| `--imagen-count <n>` | Number of images for Imagen 4 (`1`-`4`) |
| `--image-quality <q>` | OpenAI quality |
| `--image-format <fmt>` | OpenAI format |
| `--image-background <bg>` | OpenAI background |
| `--price` | Show cost estimate and exit |

## Notes

- Service setup/env details are in [`text-to-image-setup.md`](./text-to-image-setup.md).
