# image

Generate images from a text prompt with the hosted image providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared Image Options](#shared-image-options)
- [Workflow: Generate, Then Edit](#workflow-generate-then-edit)
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
| `--image-quality <q>` | OpenAI quality: `low`, `medium`, `high`, or `auto`; GLM quality: `hd` or `standard` |
| `--image-format <fmt>` | OpenAI/BFL output format: `png`, `jpeg`, or `webp` |
| `--image-background <bg>` | OpenAI background mode: `transparent`, `opaque`, or `auto` |
| `--image-count <n>` | Number of images in one request for OpenAI/Grok `1-10`, MiniMax `1-9`, or Gemini Imagen `1-4` |
| `--image-input <path-or-url>` | Repeatable source/reference image for OpenAI, Grok, native Gemini, MiniMax, or BFL edits/references |
| `--image-mask <path>` | OpenAI mask image for inpainting/edit workflows |
| `--image-compression <0-100>` | OpenAI JPEG/WebP output compression |
| `--image-response-mode <image\|text-image>` | Native Gemini response mode |
| `--gemini-person-generation <mode>` | Imagen `dont_allow`, `allow_adult`, or `allow_all` person generation |
| `--gemini-search-grounding` | Enable native Gemini search grounding metadata |
| `--price` | Show the aggregated estimate and exit |
| `--out <dir>` / `--output-dir <dir>` | Use an exact run directory instead of `output/<timestamp>_image-gen/` |

```bash
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --openai gpt-image-1.5 --image-size 1024x1024 --image-format png --out output/mug-base
bun as image "turn this into a premium catalog product photo with a soft gray background and subtle shadow" --openai gpt-image-1.5 --image-input output/mug-base/generated-image.png --image-format webp --image-compression 80 --out output/mug-catalog
```

## Workflow: Generate, Then Edit

Image runs write their files under `output/<timestamp>_image-gen/` unless you pass `--out <dir>` or `--output-dir <dir>`. Run the commands in this block in order: the later commands read the file created by the first command.

```bash
# 1. Generate the base image.
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --openai gpt-image-1.5 --image-size 1024x1024 --image-format png --out output/mug-base

# 2. Edit the generated image.
bun as image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --openai gpt-image-1.5 --image-input output/mug-base/generated-image.png --image-format webp --image-compression 80 --out output/mug-edit
```

The same generated file can also be used as a reference input for native Gemini, MiniMax, Grok, or BFL workflows:

```bash
bun as image "restyle this product image as a 1960s travel poster" --gemini gemini-3.1-flash-image-preview --image-input output/mug-base/generated-image.png --out output/mug-gemini
bun as image "show the same mug held by a person in a winter cabin" --minimax image-01 --image-input output/mug-base/generated-image.png --image-size 1024x768 --out output/mug-minimax
bun as image "turn this into a glossy magazine ad on a warm kitchen counter" --grok grok-imagine-image-quality --image-input output/mug-base/generated-image.png --image-size 1K --out output/mug-grok
bun as image "place the same mug on a rustic breakfast table" --bfl flux-2-pro-preview --image-input output/mug-base/generated-image.png --image-size 1024x1024 --out output/mug-bfl
```

## Image Services

Examples using `output/mug-base/generated-image.png` assume you ran the generate-then-edit workflow above.

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--gemini <model>` |
| Models | `gemini-3.1-flash-image-preview`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001` |
| Size | `--image-size 1K\|2K\|4K` (Imagen models); rejected for `imagen-4.0-fast-generate-001` |
| Aspect ratio | `--image-aspect-ratio <ratio>` |
| Count | `--image-count <n>` for Imagen 4 models |
| References | `--image-input` for native Gemini models only |

```bash
bun as image "a serene mountain lake at dawn" --gemini imagen-4.0-generate-001 --image-count 4 --image-aspect-ratio 16:9
bun as image "restyle the generated mug as a 1960s travel poster" --gemini gemini-3.1-flash-image-preview --image-input output/mug-base/generated-image.png
```

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--openai <model>` |
| Models | `gpt-image-1.5`, `gpt-image-2` |
| Size | `auto`, `1024x1024`, `1536x1024`, `1024x1536`; `gpt-image-2` also accepts constrained `WIDTHxHEIGHT` values |
| Quality | `--image-quality low\|medium\|high\|auto` |
| Format/background | `--image-format png\|jpeg\|webp`, `--image-background transparent\|opaque\|auto` |
| Count | `--image-count 1-10` |
| Edit/reference | `--image-input` and optional `--image-mask` with `gpt-image-1.5` |

```bash
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --openai gpt-image-1.5 --image-size 1024x1024 --image-format png --out output/mug-base
bun as image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --openai gpt-image-1.5 --image-input output/mug-base/generated-image.png --image-format webp --image-compression 80 --out output/mug-edit
bun as image "a product sketch of the same travel mug concept" --openai gpt-image-2 --image-size 1024x1024 --image-quality low
```

`gpt-image-2` accepts `auto` or `WIDTHxHEIGHT` when max edge is 3840 or less, both edges are multiples of 16, aspect ratio is at most 3:1, and total pixels are 655,360 through 8,294,400. It rejects `--image-background transparent`.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--minimax <model>` |
| Models | `image-01` |
| Aspect ratio | `--image-aspect-ratio <ratio>` |
| Size | `--image-size WIDTHxHEIGHT`, 512x512 through 2048x2048, multiples of 8; ignored when `--image-aspect-ratio` is provided |
| Count | `--image-count 1-9` |
| References | Repeatable `--image-input`; local files are sent as data URLs and HTTP(S) URLs pass through |

```bash
bun as image "a dramatic fox portrait in snow" --minimax image-01 --image-aspect-ratio 16:9
bun as image "a dramatic fox portrait in snow" --minimax image-01 --image-size 1024x768 --image-count 3
bun as image "show the same mug held by a person in a winter cabin" --minimax image-01 --image-input output/mug-base/generated-image.png --image-size 1024x768 --image-count 3 --out output/mug-minimax
```

### Z.AI GLM

| Option | Value |
|--------|-------|
| Selector | `--glm <model>` |
| Models | `glm-image`, `cogView-4-250304` |
| Size | `--image-size WIDTHxHEIGHT`, 512x512 through 2048x2048, multiples of 32 |
| Quality | `--image-quality hd\|standard` |

```bash
bun as image "a clean product photo of a red enamel camping mug" --glm glm-image --image-size 1280x1280 --image-quality hd
```

### Grok

| Option | Value |
|--------|-------|
| Selector | `--grok <model>` |
| Models | `grok-imagine-image-quality`, `grok-imagine-image` |
| Size | `--image-size 1K\|2K` |
| Aspect ratio | `--image-aspect-ratio <ratio>` |
| Count | `--image-count 1-10` |
| Edit/reference | Up to three `--image-input` values with `grok-imagine-image-quality` |

```bash
bun as image "turn the generated mug into a glossy magazine ad on a warm kitchen counter" --grok grok-imagine-image-quality --image-input output/mug-base/generated-image.png --image-size 1K --out output/mug-grok
bun as image "a futuristic observatory at sunset" --grok grok-imagine-image-quality --image-aspect-ratio 16:9 --image-size 1K --image-count 4
```

Grok responses include provider-reported billed cost when available, and that actual value is used in `run.json`.

### Runway

| Option | Value |
|--------|-------|
| Selector | `--runway <model>` |
| Models | `gen4_image` |
| Size | `--image-size 720p\|1080p` |
| Aspect ratio | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, or `21:9` |

```bash
bun as image "a cinematic product photo of a red enamel camping mug" --runway gen4_image --image-aspect-ratio 1:1 --image-size 720p
```

Runway rejects OpenAI-only flags, edit inputs, and `--image-count`; it is single-image-only for this command.

### BFL

| Option | Value |
|--------|-------|
| Selector | `--bfl <model>` |
| Models | `flux-2-klein-4b`, `flux-2-klein-9b-preview`, `flux-2-klein-9b`, `flux-2-pro-preview`, `flux-2-pro`, `flux-2-max`, `flux-2-flex` |
| Size | `--image-size WIDTHxHEIGHT` |
| Format | `--image-format jpeg\|png\|webp` |
| References | Repeatable `--image-input`; up to four images for Klein models and up to eight for Pro/Max/Flex models |

```bash
bun as image "a cinematic product photo of a red enamel camping mug" --bfl flux-2-pro-preview --image-size 1024x1024 --image-format jpeg
bun as image "place the same mug in a cozy cabin kitchen" --bfl flux-2-pro-preview --image-input output/mug-base/generated-image.png --image-size 1024x1024 --out output/mug-bfl
```

BFL rejects `--image-aspect-ratio`, `--image-quality`, `--image-background`, `--image-mask`, and `--image-count`.

### deAPI

| Option | Value |
|--------|-------|
| Selector | `--deapi <model>` |
| Models | `Flux1schnell`, `ZImageTurbo_INT8`, `Flux_2_Klein_4B_BF16` |
| Size | `--image-size WIDTHxHEIGHT` |

```bash
bun as image "a cozy cabin at dusk" --deapi Flux1schnell --image-size 768x768
```

deAPI rejects `--image-aspect-ratio`, `--image-quality`, `--image-format`, `--image-background`, edit inputs, and `--image-count`.

## Output

- Standalone `image` runs always write `run.json`.
- Gemini writes `generated-image.png`, plus numbered variants when multiple Imagen images are returned.
- OpenAI writes `generated-image.<format>`, plus numbered variants for `--image-count`.
- MiniMax writes `generated-image.jpeg`, plus numbered variants for `--image-count`.
- GLM writes `generated-image.png`.
- Grok writes `generated-image.<format>`, plus numbered variants for `--image-count`.
- Runway writes `generated-image.<format>`, based on the downloaded asset content type when available.
- BFL writes `generated-image.jpg`, `generated-image.png`, or `generated-image.webp`.
- deAPI writes `generated-image.png`.
- Multi-provider runs rename outputs to include the provider and model, such as `generated-image-openai-gpt-image-1.5.png`.
- `--out` / `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.
- `run.json` includes `image`, `cost`, and `timing` sections. The `image` field is always an array, and each entry includes `imageFileNames`.

## Notes

- OpenAI documents these latency caveats for GPT Image models: low quality is fastest, square images are typically fastest, JPEG is faster than PNG, and complex prompts can take up to about 2 minutes.
- `gpt-image-2` estimate table: `1024x1024` costs about `0.6¢` low, `5.3¢` medium, `21.1¢` high; `1024x1536` and `1536x1024` cost about `0.5¢` low, `4.1¢` medium, `16.5¢` high. `auto` estimates as `1024x1024` medium; other valid flexible sizes use the `5.3¢` fallback and should be checked with OpenAI's calculator.
