# image

Generate images from a text prompt with the hosted image providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
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
GLM_API_KEY=...
XAI_API_KEY=...
RUNWAYML_API_SECRET=...
BFL_API_KEY=...
BFL_BASE_URL=... # optional
DEAPI_API_KEY=...
DEAPI_BASE_URL=... # optional
```

## Usage

```bash
bun as image <prompt> [flags]
```

## Providers

| Provider | Flag | Models |
|----------|------|--------|
| Gemini | `--gemini-image <model>` | `gemini-3-pro-image-preview`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001` |
| OpenAI | `--openai-image <model>` | `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`, `gpt-image-2` |
| MiniMax | `--minimax-image <model>` | `image-01` |
| Z.AI GLM | `--glm-image <model>` | `glm-image`, `cogView-4-250304` |
| Grok | `--grok-image <model>` | `grok-imagine-image` |
| Runway | `--runway-image <model>` | `gen4_image` |
| BFL | `--bfl-image <model>` | `flux-2-klein-4b`, `flux-2-klein-9b-preview`, `flux-2-klein-9b`, `flux-2-pro-preview`, `flux-2-pro`, `flux-2-max`, `flux-2-flex` |
| deAPI | `--deapi-image <model>` | `Flux1schnell`, `ZImageTurbo_INT8`, `Flux_2_Klein_4B_BF16` |

Provider flags accept an omitted model value and then resolve to the cheapest supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

## Examples

```bash
# Gemini native image generation
bun as image "a serene mountain lake at dawn" --gemini-image gemini-3-pro-image-preview

# Imagen 4 with multiple outputs
bun as image "a serene mountain lake at dawn" --gemini-image imagen-4.0-generate-001 --imagen-count 4 --image-aspect-ratio 16:9

# OpenAI
bun as image "an oil painting of a lighthouse" --openai-image gpt-image-1 --image-quality high --image-size 1536x1024

# OpenAI GPT Image 2 low-cost draft
bun as image "a product sketch of a travel mug" --openai-image gpt-image-2 --image-size 1024x1024 --image-quality low

# MiniMax
bun as image "a dramatic fox portrait in snow" --minimax-image image-01 --image-aspect-ratio 16:9

# Z.AI GLM
bun as image "a clean product photo of a red enamel camping mug" --glm-image glm-image --image-size 1280x1280

# Grok
bun as image "a futuristic observatory at sunset" --grok-image grok-imagine-image --image-aspect-ratio 16:9 --image-size 1K

# Runway
bun as image "a cinematic product photo of a red enamel camping mug" --runway-image gen4_image --image-aspect-ratio 1:1 --image-size 720p

# BFL
bun as image "a cinematic product photo of a red enamel camping mug" --bfl-image flux-2-pro-preview --image-size 1024x1024 --image-format jpeg

# deAPI
bun as image "a cozy cabin at dusk" --deapi-image Flux1schnell --image-size 768x768

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
| `--glm-image <model>` | Select one or more Z.AI GLM image models; omit the value to use the cheapest supported model |
| `--grok-image <model>` | Select one or more Grok image models; omit the value to use the cheapest supported model |
| `--runway-image <model>` | Select one or more Runway image models; omit the value to use the cheapest supported model |
| `--bfl-image <model>` | Select one or more BFL image models; omit the value to use the cheapest supported model |
| `--deapi-image <model>` | Select one or more deAPI image models; omit the value to use the cheapest supported model |
| `--image-aspect-ratio <ratio>` | Aspect ratio control for Gemini, MiniMax, Grok, and Runway. Runway supports `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, and `21:9` |
| `--image-size <size>` | Size control: `1K`, `2K`, `4K` for Gemini; `auto`, `1024x1024`, `1536x1024`, `1024x1536` for OpenAI, with flexible `WIDTHxHEIGHT` constraints for `gpt-image-2`; `512x512` through `2048x2048` multiples of 32 for GLM; `1K` or `2K` for Grok; `720p` or `1080p` for Runway; `WIDTHxHEIGHT` for BFL; `WIDTHxHEIGHT` for deAPI |
| `--imagen-count <n>` | Number of images to generate for Imagen 4 models |
| `--image-quality <q>` | OpenAI quality: `low`, `medium`, `high`, or `auto` |
| `--image-format <fmt>` | OpenAI/BFL output format: `png`, `jpeg`, or `webp` |
| `--image-background <bg>` | OpenAI background mode: `transparent`, `opaque`, or `auto` |
| `--price` | Show the aggregated estimate and exit |

## Output

- Standalone `image` runs always write `run.json`.
- Gemini writes `generated-image.png`, plus numbered variants when multiple images are returned.
- OpenAI writes `generated-image.<format>`.
- MiniMax writes `generated-image.jpeg`.
- GLM writes `generated-image.png`.
- Grok writes `generated-image.<format>`, based on the response MIME type when available.
- Runway writes `generated-image.<format>`, based on the downloaded asset content type when available.
- BFL writes `generated-image.jpg`, `generated-image.png`, or `generated-image.webp`.
- deAPI writes `generated-image.png`.
- Multi-provider runs rename outputs to include the provider and model, such as `generated-image-openai-gpt-image-1-mini.png`.
- `run.json` includes `image`, `cost`, and `timing` sections. The `image` field is always an array, and each entry includes `imageFileNames`.

## Notes

- `--image-size` is currently rejected for `imagen-4.0-fast-generate-001`.
- `gpt-image-2` accepts `auto` or `WIDTHxHEIGHT` when max edge is 3840 or less, both edges are multiples of 16, aspect ratio is at most 3:1, and total pixels are 655,360 through 8,294,400. It rejects `--image-background transparent`.
- `gpt-image-2` estimate table: `1024x1024` costs about `0.6¢` low, `5.3¢` medium, `21.1¢` high; `1024x1536` and `1536x1024` cost about `0.5¢` low, `4.1¢` medium, `16.5¢` high. `auto` estimates as `1024x1024` medium; other valid flexible sizes use the `5.3¢` fallback and should be checked with OpenAI's calculator.
- OpenAI documents these latency caveats for GPT Image models: low quality is fastest, square images are typically fastest, JPEG is faster than PNG, and complex prompts can take up to about 2 minutes.
- Runway ignores no OpenAI-only flags: `--image-format`, `--image-background`, and `--image-quality` are rejected when Runway is selected.
- BFL uses `--image-size WIDTHxHEIGHT` and `--image-format jpeg|png|webp`; `--image-aspect-ratio`, `--image-quality`, `--image-background`, and `--imagen-count` are rejected for BFL.
- deAPI uses `--image-size WIDTHxHEIGHT`; `--image-aspect-ratio`, `--image-quality`, `--image-format`, `--image-background`, and `--imagen-count` are rejected for deAPI.
- Grok pricing is represented as an approximate flat per-image estimate; xAI account pricing should be checked in the console for exact billing.
