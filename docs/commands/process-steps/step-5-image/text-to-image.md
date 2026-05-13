# image

Generate images from a text prompt with the hosted image providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared Image Options](#shared-image-options)
- [Image Services](#image-services)
  - [Gemini](#gemini)
  - [OpenAI](#openai)
  - [MiniMax](#minimax)
  - [Z.AI GLM](#zai-glm)
  - [Grok](#grok)
  - [Runway](#runway)
  - [BFL](#bfl)
  - [deAPI](#deapi)
- [Output](#output)
- [Notes](#notes)

## Setup

There are no local image-generation models in this project.

```bash
# hosted provider readiness check; image providers are API-based
bun as setup --step image
```

`setup --step image` checks API-key readiness for Gemini, OpenAI, GLM, Grok, Runway, BFL, and deAPI image providers. MiniMax image generation uses `MINIMAX_API_KEY` at runtime, but the image setup step does not have a dedicated MiniMax image hook today.

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

Provider flags accept an omitted model value and then resolve to the cheapest supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

## Shared Image Options

| Flag | Description |
|------|-------------|
| `--all-image` | Select every supported image provider/model |
| `--image-provider-concurrency <n>` | Hosted image providers/models to run concurrently per item; default `2`, or up to `8` for `--all-image` |
| `--image-local-concurrency <n>` | Local image providers to run concurrently per item; default `1` |
| `--image-aspect-ratio <ratio>` | Provider-dependent aspect ratio control |
| `--image-size <size>` | Provider-dependent size or resolution control |
| `--image-quality <q>` | OpenAI quality: `low`, `medium`, `high`, or `auto` |
| `--image-format <fmt>` | OpenAI/BFL output format: `png`, `jpeg`, or `webp` |
| `--image-background <bg>` | OpenAI background mode: `transparent`, `opaque`, or `auto` |
| `--imagen-count <n>` | Number of images to generate for Imagen 4 models |
| `--price` | Show the aggregated estimate and exit |

```bash
bun as image "a sunset over the lake" --gemini-image imagen-4.0-generate-001 --openai-image gpt-image-1-mini --imagen-count 2
bun as image "a sunset over the lake" --openai-image gpt-image-1-mini --openai-image gpt-image-1
```

## Image Services

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--gemini-image <model>` |
| Models | `gemini-3-pro-image-preview`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001` |
| Size | `--image-size 1K\|2K\|4K`; rejected for `imagen-4.0-fast-generate-001` |
| Aspect ratio | `--image-aspect-ratio <ratio>` |
| Count | `--imagen-count <n>` for Imagen 4 models |

```bash
bun as image "a serene mountain lake at dawn" --gemini-image gemini-3-pro-image-preview
bun as image "a serene mountain lake at dawn" --gemini-image imagen-4.0-generate-001 --imagen-count 4 --image-aspect-ratio 16:9
```

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--openai-image <model>` |
| Models | `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`, `gpt-image-2` |
| Size | `auto`, `1024x1024`, `1536x1024`, `1024x1536`; `gpt-image-2` also accepts constrained `WIDTHxHEIGHT` values |
| Quality | `--image-quality low\|medium\|high\|auto` |
| Format/background | `--image-format png\|jpeg\|webp`, `--image-background transparent\|opaque\|auto` |

```bash
bun as image "an oil painting of a lighthouse" --openai-image gpt-image-1 --image-quality high --image-size 1536x1024
bun as image "a product sketch of a travel mug" --openai-image gpt-image-2 --image-size 1024x1024 --image-quality low
```

`gpt-image-2` accepts `auto` or `WIDTHxHEIGHT` when max edge is 3840 or less, both edges are multiples of 16, aspect ratio is at most 3:1, and total pixels are 655,360 through 8,294,400. It rejects `--image-background transparent`.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--minimax-image <model>` |
| Models | `image-01` |
| Aspect ratio | `--image-aspect-ratio <ratio>` |

```bash
bun as image "a dramatic fox portrait in snow" --minimax-image image-01 --image-aspect-ratio 16:9
```

### Z.AI GLM

| Option | Value |
|--------|-------|
| Selector | `--glm-image <model>` |
| Models | `glm-image`, `cogView-4-250304` |
| Size | `--image-size WIDTHxHEIGHT`, 512x512 through 2048x2048, multiples of 32 |

```bash
bun as image "a clean product photo of a red enamel camping mug" --glm-image glm-image --image-size 1280x1280
```

### Grok

| Option | Value |
|--------|-------|
| Selector | `--grok-image <model>` |
| Models | `grok-imagine-image` |
| Size | `--image-size 1K\|2K` |
| Aspect ratio | `--image-aspect-ratio <ratio>` |

```bash
bun as image "a futuristic observatory at sunset" --grok-image grok-imagine-image --image-aspect-ratio 16:9 --image-size 1K
```

Grok pricing is represented as an approximate flat per-image estimate; xAI account pricing should be checked in the console for exact billing.

### Runway

| Option | Value |
|--------|-------|
| Selector | `--runway-image <model>` |
| Models | `gen4_image` |
| Size | `--image-size 720p\|1080p` |
| Aspect ratio | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, or `21:9` |

```bash
bun as image "a cinematic product photo of a red enamel camping mug" --runway-image gen4_image --image-aspect-ratio 1:1 --image-size 720p
```

Runway rejects OpenAI-only flags: `--image-format`, `--image-background`, and `--image-quality`.

### BFL

| Option | Value |
|--------|-------|
| Selector | `--bfl-image <model>` |
| Models | `flux-2-klein-4b`, `flux-2-klein-9b-preview`, `flux-2-klein-9b`, `flux-2-pro-preview`, `flux-2-pro`, `flux-2-max`, `flux-2-flex` |
| Size | `--image-size WIDTHxHEIGHT` |
| Format | `--image-format jpeg\|png\|webp` |

```bash
bun as image "a cinematic product photo of a red enamel camping mug" --bfl-image flux-2-pro-preview --image-size 1024x1024 --image-format jpeg
```

BFL rejects `--image-aspect-ratio`, `--image-quality`, `--image-background`, and `--imagen-count`.

### deAPI

| Option | Value |
|--------|-------|
| Selector | `--deapi-image <model>` |
| Models | `Flux1schnell`, `ZImageTurbo_INT8`, `Flux_2_Klein_4B_BF16` |
| Size | `--image-size WIDTHxHEIGHT` |

```bash
bun as image "a cozy cabin at dusk" --deapi-image Flux1schnell --image-size 768x768
```

deAPI rejects `--image-aspect-ratio`, `--image-quality`, `--image-format`, `--image-background`, and `--imagen-count`.

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

- OpenAI documents these latency caveats for GPT Image models: low quality is fastest, square images are typically fastest, JPEG is faster than PNG, and complex prompts can take up to about 2 minutes.
- `gpt-image-2` estimate table: `1024x1024` costs about `0.6¢` low, `5.3¢` medium, `21.1¢` high; `1024x1536` and `1536x1024` cost about `0.5¢` low, `4.1¢` medium, `16.5¢` high. `auto` estimates as `1024x1024` medium; other valid flexible sizes use the `5.3¢` fallback and should be checked with OpenAI's calculator.
