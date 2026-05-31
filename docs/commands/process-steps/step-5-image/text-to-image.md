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
  - [Grok](#grok)
  - [BFL](#bfl)
  - [Reve](#reve)
- [Output](#output)
- [Notes](#notes)

## Setup

There are no local image-generation models in this project.

```bash
# hosted provider readiness check; image providers are API-based
bun as setup --step image
```


### Environment

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
BFL_API_KEY=...
BFL_BASE_URL=... # optional
REVE_API_KEY=...
REVE_BASE_URL=... # optional
```

## Usage

```bash
bun as image <prompt> [flags]
```

`--provider` selectors accept an omitted model value and then resolve to the cheapest supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

## Shared Image Options

| Flag | Description |
|------|-------------|
| `--all-providers` | Select every supported image provider/model |
| `--provider-concurrency <n>` | Hosted image providers/models to run concurrently per item; default `2`, or up to `8` for `--all-providers` |
| `--local-concurrency <n>` | Local image providers to run concurrently per item; default `1` |
| `--aspect-ratio <ratio>` | Provider-dependent aspect ratio control |
| `--size <size>` | Provider-dependent size or resolution control; Reve treats `WIDTHxHEIGHT` as a fit-within postprocess |
| `--quality <q>` | OpenAI quality: `low`, `medium`, `high`, or `auto` |
| `--format <fmt>` | OpenAI/BFL/Reve output format: `png`, `jpeg`, or `webp` |
| `--background <bg>` | OpenAI background mode: `transparent`, `opaque`, or `auto` |
| `--count <n>` | Number of images in one request for OpenAI/Grok `1-10` |
| `--input <path-or-url>` | Repeatable source/reference image for OpenAI, Grok, native Gemini, BFL, or Reve edits/references |
| `--mask <path>` | OpenAI mask image for inpainting/edit workflows |
| `--compression <0-100>` | OpenAI JPEG/WebP output compression |
| `--response-mode <image\|text-image>` | Native Gemini response mode |
| `--search-grounding` | Enable native Gemini search grounding metadata |
| `--price` | Show the aggregated estimate and exit |
| `--output-dir <dir>` | Use an exact run directory instead of `output/<timestamp>_image-gen/` |

```bash
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-1.5 --size 1024x1024 --format png --output-dir output/mug-base
bun as image "turn this into a premium catalog product photo with a soft gray background and subtle shadow" --provider openai=gpt-image-1.5 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-catalog
```

## Workflow: Generate, Then Edit

Image runs write their files under `output/<timestamp>_image-gen/` unless you pass `--output-dir <dir>`. Run the commands in this block in order: the later commands read the file created by the first command.

```bash
# 1. Generate the base image.
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-1.5 --size 1024x1024 --format png --output-dir output/mug-base

# 2. Edit the generated image.
bun as image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-1.5 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit
```

The same generated file can also be used as a reference input for native Gemini, Grok, BFL, or Reve workflows:

```bash
bun as image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-image-preview --input output/mug-base/generated-image.png --output-dir output/mug-gemini
bun as image "turn this into a glossy magazine ad on a warm kitchen counter" --provider grok=grok-imagine-image-quality --input output/mug-base/generated-image.png --size 1K --output-dir output/mug-grok
bun as image "place the same mug on a rustic breakfast table" --provider bfl=flux-2-pro --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl
bun as image "place the same mug in a minimalist editorial product scene" --provider reve=latest --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-reve
```

## Image Services

Examples using `output/mug-base/generated-image.png` assume you ran the generate-then-edit workflow above.

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.1-flash-image-preview` |
| Size | `--size 1K\|2K\|4K` |
| Aspect ratio | `--aspect-ratio <ratio>` |
| Count | Native Gemini returns one image per request |
| References | `--input` |

```bash
bun as image "a serene mountain lake at dawn" --provider gemini=gemini-3.1-flash-image-preview --size 1K --aspect-ratio 16:9
bun as image "restyle the generated mug as a 1960s travel poster" --provider gemini=gemini-3.1-flash-image-preview --input output/mug-base/generated-image.png
```

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--provider openai[=<model>]` |
| Models | `gpt-image-1.5`, `gpt-image-2` |
| Size | `auto`, `1024x1024`, `1536x1024`, `1024x1536`; `gpt-image-2` also accepts constrained `WIDTHxHEIGHT` values |
| Quality | `--quality low\|medium\|high\|auto` |
| Format/background | `--format png\|jpeg\|webp`, `--background transparent\|opaque\|auto` |
| Count | `--count 1-10` |
| Edit/reference | `--input` and optional `--mask` with `gpt-image-1.5` |

```bash
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-1.5 --size 1024x1024 --format png --output-dir output/mug-base
bun as image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-1.5 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit
bun as image "a product sketch of the same travel mug concept" --provider openai=gpt-image-2 --size 1024x1024 --quality low
```

`gpt-image-2` accepts `auto` or `WIDTHxHEIGHT` when max edge is 3840 or less, both edges are multiples of 16, aspect ratio is at most 3:1, and total pixels are 655,360 through 8,294,400. It rejects `--background transparent`.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-imagine-image-quality`, `grok-imagine-image` |
| Size | `--size 1K\|2K` |
| Aspect ratio | `--aspect-ratio <ratio>` |
| Count | `--count 1-10` |
| Edit/reference | Up to three `--input` values with `grok-imagine-image-quality` |

```bash
bun as image "turn the generated mug into a glossy magazine ad on a warm kitchen counter" --provider grok=grok-imagine-image-quality --input output/mug-base/generated-image.png --size 1K --output-dir output/mug-grok
bun as image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-quality --aspect-ratio 16:9 --size 1K --count 4
```

Grok responses include provider-reported billed cost when available, and that actual value is used in `run.json`.

### BFL

| Option | Value |
|--------|-------|
| Selector | `--provider bfl[=<model>]` |
| Models | `flux-2-pro`, `flux-2-max`, `flux-2-flex` |
| Size | `--size WIDTHxHEIGHT` |
| Format | `--format jpeg\|png\|webp` |
| References | Repeatable `--input`; up to eight images |

```bash
bun as image "a cinematic product photo of a red enamel camping mug" --provider bfl=flux-2-pro --size 1024x1024 --format jpeg
bun as image "place the same mug in a cozy cabin kitchen" --provider bfl=flux-2-pro --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl
```

BFL rejects `--aspect-ratio`, `--quality`, `--background`, `--mask`, and `--count`.

### Reve

| Option | Value |
|--------|-------|
| Selector | `--provider reve[=<model>]` |
| Models | `latest`, `reve-create@20250915` |
| Aspect ratio | `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, or `1:1` |
| Size | `--size WIDTHxHEIGHT` as a fit-within resize after generation |
| Format | `--format png\|jpeg\|webp`; default `png` |
| References | one PNG/JPEG/WebP `--input` uses edit; two to six inputs use remix |

```bash
bun as image "a quiet editorial product photo of a red enamel camping mug" --provider reve=latest --aspect-ratio 1:1 --format png --output-dir output/mug-base
bun as image "make the mug matte black and keep the same camera angle" --provider reve=latest --input output/mug-base/generated-image.png --format webp --output-dir output/mug-reve-edit
bun as image "combine the mug shape with the lighting and surface from these references" --provider reve=latest --input output/mug-base/generated-image.png --input input/examples/document/1-document.png --size 1024x1024 --output-dir output/mug-reve-remix
```

`--provider reve` with no model resolves to `latest`. `reve-create@20250915` is create-only in this command and rejects `--input`; use `--provider reve=latest` for edit or remix workflows. Reve rejects `--count`, `--quality`, `--background`, `--mask`, `--compression`, `--response-mode`, and `--search-grounding`. When Reve returns usage headers, AutoShow records provider-reported credits as cost at `$10 / 7500 credits`.

## Output

- Standalone `image` runs always write `run.json`.
- Gemini writes `generated-image.png`.
- OpenAI writes `generated-image.<format>`, plus numbered variants for `--count`.
- Grok writes `generated-image.<format>`, plus numbered variants for `--count`.
- BFL writes `generated-image.jpg`, `generated-image.png`, or `generated-image.webp`.
- Reve writes `generated-image.png`, `generated-image.jpg`, or `generated-image.webp`.
- Multi-provider runs rename outputs to include the provider and model, such as `generated-image-openai-gpt-image-1.5.png`.
- `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.
- `run.json` includes `image`, `cost`, and `timing` sections. The `image` field is always an array, and each entry includes `imageFileNames`.

## Notes

- OpenAI documents these latency caveats for GPT Image models: low quality is fastest, square images are typically fastest, JPEG is faster than PNG, and complex prompts can take up to about 2 minutes.
- `gpt-image-2` estimate table: `1024x1024` costs about `0.6¢` low, `5.3¢` medium, `21.1¢` high; `1024x1536` and `1536x1024` cost about `0.5¢` low, `4.1¢` medium, `16.5¢` high. `auto` estimates as `1024x1024` medium; other valid flexible sizes use the `5.3¢` fallback and should be checked with OpenAI's calculator.
- Reve `--size WIDTHxHEIGHT` uses Reve's `fit_image` postprocessor, so it constrains the output within the requested bounds rather than guaranteeing an exact canvas size.
