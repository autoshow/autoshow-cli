# video

Generate a video from a text prompt with one or more hosted video providers and models.

## Outline

- [Usage](#usage)
- [Environment](#environment)
- [Shared Video Options](#shared-video-options)
- [Video Services](#video-services)
  - [Gemini Veo](#gemini-veo)
  - [MiniMax](#minimax)
  - [Z.AI GLM](#zai-glm)
  - [Grok](#grok)
  - [Runway](#runway)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
bun as video <prompt> [flags]
```

One or more provider flags can be specified. Repeating the same provider flag runs each selected model independently and produces its own output file.

## Environment

There are no local video-generation models in this project.

```bash
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
GLM_API_KEY=...
XAI_API_KEY=...
RUNWAYML_API_SECRET=...
```

Optional provider base URL overrides:

```bash
ZAI_BASE_URL=...
XAI_BASE_URL=...
```

## Shared Video Options

| Flag | Description |
|------|-------------|
| `--all-providers` | Run every supported video provider/model |
| `--provider-concurrency <n>` | Hosted video providers/models to run concurrently per item; default `2`, or up to `8` for `--all-providers` |
| `--local-concurrency <n>` | Local video providers to run concurrently per item; default `1` |
| `--duration <seconds>` | Requested video duration |
| `--size <size>` | Provider-dependent size control |
| `--aspect-ratio <ratio>` | Provider-dependent aspect ratio |
| `--resolution <res>` | Provider-dependent resolution control |
| `--mode <mode>` | `text`, `image-to-video`, `reference-to-video`, `interpolate`, `extend`, or `edit`; default `text` |
| `--input-image <path-or-url>` | Input image for `image-to-video`; first frame for `interpolate` |
| `--last-frame <path-or-url>` | Last-frame image for `interpolate` |
| `--reference-image <path-or-url>` | Reference image for `reference-to-video`; repeat up to 3 times |
| `--input-video <path-or-url>` | Input MP4 for `extend` or `edit` |
| `--grok-video-storage-filename <name>` | xAI/Grok storage filename |
| `--grok-video-storage-expires-after <seconds>` | xAI/Grok storage expiration, max 30 days |
| `--price` | Show the estimate and exit |
| `--output-dir <dir>` | Use an exact run directory instead of `output/<timestamp>_video-gen/` |

```bash
bun as video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-fast-generate-preview --provider minimax=MiniMax-Hailuo-2.3 --provider runway=gen4.5
bun as video "a rainy neon city street, slow camera pan" --all-providers --price
```

Media-input modes are explicit. Passing media flags without `--mode` is rejected because the default mode is text-to-video. Run workflow blocks from top to bottom: commands with `--output-dir` write deterministic paths that later commands read.

| Mode | Providers | Required inputs | Notes |
|------|-----------|-----------------|-------|
| `text` | All video providers | none | Default mode |
| `image-to-video` | Gemini, GLM, MiniMax, Grok | `--input-image` | Animates the input image |
| `reference-to-video` | Gemini standard/Fast, GLM Vidu 2 reference, MiniMax S2V, Grok | `--reference-image` | Up to 3 references; MiniMax S2V accepts one |
| `interpolate` | Gemini, GLM | `--input-image`, `--last-frame` | First/last-frame transition |
| `extend` | Gemini standard/Fast, Grok | `--input-video` | Gemini extension requests force `720p` |
| `edit` | Grok | `--input-video` | Rejects duration, aspect, and resolution overrides |

Create reusable image inputs:

```bash
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --provider gemini=gemini-3.1-flash-image-preview --output-dir output/video-demo-product
bun as image "the same red enamel camping mug on a moonlit blue studio background" --provider gemini=gemini-3.1-flash-image-preview --output-dir output/video-demo-product-night
bun as image "a high-fashion crimson jacket on a mannequin, plain white background" --provider gemini=gemini-3.1-flash-image-preview --output-dir output/video-demo-jacket
bun as image "pink heart-shaped sunglasses on a plain white background" --provider gemini=gemini-3.1-flash-image-preview --output-dir output/video-demo-sunglasses
```

Animate an image, then reuse that generated video for extension and editing:

```bash
bun as video "animate this product on a slow turntable, glossy highlights, camera locked off" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/video-demo-product/generated-image.png --output-dir output/video-demo-image-to-video
bun as video "continue the turntable move as the mug rotates toward a warm kitchen window" --provider gemini=veo-3.1-fast-generate-preview --mode extend --input-video output/video-demo-image-to-video/generated-video.mp4 --output-dir output/video-demo-extend
bun as video "make the lighting moonlit blue while keeping the mug motion intact" --provider grok=grok-imagine-video --mode edit --input-video output/video-demo-image-to-video/generated-video.mp4 --output-dir output/video-demo-edit
```

Use multiple generated images as video constraints:

```bash
bun as video "transition from the white studio product shot into the moonlit blue studio shot" --provider gemini=veo-3.1-generate-preview --mode interpolate --input-image output/video-demo-product/generated-image.png --last-frame output/video-demo-product-night/generated-image.png --output-dir output/video-demo-interpolate
bun as video "a model walks through a shallow turquoise lagoon wearing the jacket and sunglasses" --provider grok=grok-imagine-video --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png --reference-image output/video-demo-sunglasses/generated-image.png --output-dir output/video-demo-reference-video
bun as video "animate the jacket with a slow showroom camera push" --provider minimax=I2V-01 --mode image-to-video --input-image output/video-demo-jacket/generated-image.png --output-dir output/video-demo-minimax-i2v
bun as video "keep this character consistent while walking into a studio set" --provider glm=vidu2-reference --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png --output-dir output/video-demo-glm-reference
```

## Video Services

### Gemini Veo

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.1-lite-generate-preview` |
| Duration | `--duration <seconds>`, normalized to `4`, `6`, or `8` |
| Resolution | `--resolution 720p\|1080p\|4k`; `4k` is standard/Fast only |
| Aspect ratio | `--aspect-ratio <ratio>` |

```bash
bun as video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-fast-generate-preview
bun as video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-generate-preview --duration 8 --aspect-ratio 16:9 --resolution 1080p
bun as video "a sweeping Grand Canyon drone shot at sunset" --provider gemini=veo-3.1-generate-preview --resolution 4k
bun as video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-lite-generate-preview --duration 4 --resolution 720p
bun as video "a sunset timelapse" --provider gemini=veo-3.1-fast-generate-preview --duration 8 --price
```

Gemini Veo price estimates use normalized billed duration and current per-second Gemini API pricing:

| Model | 720p | 1080p | 4k estimate | CLI timing estimate |
|-------|------|-------|-------------|---------------------|
| `veo-3.1-generate-preview` | 40.0000¢/s | 40.0000¢/s | approximate fallback | 12000 ms/s |
| `veo-3.1-fast-generate-preview` | 10.0000¢/s | 12.0000¢/s | approximate fallback | 10000 ms/s |
| `veo-3.1-lite-generate-preview` | 5.0000¢/s | 8.0000¢/s | not supported | 8000 ms/s |

The timing values are CLI planning heuristics, not provider SLAs. Google documents Veo request latency as roughly 11 seconds to 6 minutes, with higher resolutions generally taking longer. Gemini `1080p`, `4k`, reference-image, and extension requests are normalized to `8` seconds before price estimates and API requests. `4k` is accepted for `veo-3.1-generate-preview` and `veo-3.1-fast-generate-preview`; 4K price estimates are approximate when no exact registry rate is available. Veo 3.1 Lite does not support `4k`, reference-image generation, or video extension.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--provider minimax[=<model>]` |
| Models | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `T2V-01-Director`, `T2V-01`, `I2V-01-Director`, `I2V-01-live`, `I2V-01`, `S2V-01` |
| Duration/resolution | `--duration <seconds>`, `--resolution 720p\|1080p` where supported |

```bash
bun as video "a rainy neon city street, slow camera pan" --provider minimax=MiniMax-Hailuo-2.3 --duration 10 --resolution 720p
bun as video "a rainy neon city street, slow camera pan" --provider minimax=T2V-01
bun as video "animate the product photo with a slow dolly move" --provider minimax=I2V-01 --mode image-to-video --input-image output/video-demo-product/generated-image.png
bun as video "a person in this reference walks through a softly lit studio" --provider minimax=S2V-01 --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png
bun as video "a sunset timelapse" --provider minimax=MiniMax-Hailuo-2.3 --duration 10 --price
```

MiniMax text models use the existing text-to-video request body. Image-to-video models send `first_frame_image`, and `S2V-01` maps one reference image to `subject_reference` with `type: "character"`. MiniMax durations are normalized to the provider-supported values for the selected model and resolution.

### Z.AI GLM

| Option | Value |
|--------|-------|
| Selector | `--provider glm[=<model>]` |
| Models | `cogvideox-3`, `viduq1-text`, `vidu2-image`, `vidu2-start-end`, `vidu2-reference` |
| Size/aspect ratio | `--size 1920x1080`, `1280x720`, `720x1280`, or `--aspect-ratio <ratio>` depending on model |

```bash
bun as video "a cat playing with yarn" --provider glm=cogvideox-3 --duration 10 --size 1920x1080
bun as video "an anime character dancing" --provider glm=viduq1-text --aspect-ratio 16:9
bun as video "animate the product photo with a subtle tabletop slide" --provider glm=vidu2-image --mode image-to-video --input-image output/video-demo-product/generated-image.png
bun as video "transition between the two studio frames" --provider glm=vidu2-start-end --mode interpolate --input-image output/video-demo-product/generated-image.png --last-frame output/video-demo-product-night/generated-image.png
bun as video "keep these references consistent in the generated shot" --provider glm=vidu2-reference --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png --reference-image output/video-demo-sunglasses/generated-image.png
bun as video "a sunset timelapse" --provider glm=cogvideox-3 --price
```

GLM `cogvideox-3` supports text, image-to-video, and interpolation with `image_url`. Vidu Q1 text requests are fixed at `5` seconds. Vidu 2 media models default to 4-second 720p requests. GLM prompts are capped at 512 characters.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-imagine-video` |
| Duration/resolution | `--duration <seconds>`, `--resolution 480p\|720p` for generation modes |
| Storage | `--grok-video-storage-filename`, `--grok-video-storage-expires-after` |

```bash
bun as video "a cat playing piano" --provider grok=grok-imagine-video --duration 8 --resolution 720p
bun as video "a sunset timelapse" --provider grok=grok-imagine-video --price
bun as image "a close product photo of a red enamel camping mug on white seamless" --provider gemini=gemini-3.1-flash-image-preview --output-dir output/grok-video-input-image
bun as video "animate the mug with a slow tabletop camera slide" --provider grok=grok-imagine-video --mode image-to-video --input-image output/grok-video-input-image/generated-image.png --output-dir output/grok-video-base
bun as video "extend with a wider camera reveal of the tabletop set" --provider grok=grok-imagine-video --mode extend --input-video output/grok-video-base/generated-video.mp4 --duration 6 --output-dir output/grok-video-extended
```

Grok text, image-to-video, and reference-to-video durations are clamped to `1` through `15` seconds and default to `8`. Extension durations are clamped to `1` through `10` seconds and default to `6`. Grok estimates include the published input image/reference-image fee when image inputs are selected, and include input-video seconds when local input duration can be probed. When xAI returns `usage.cost_in_usd_ticks`, the run metadata uses that provider cost for actual-cost reporting.

### Runway

| Option | Value |
|--------|-------|
| Selector | `--provider runway[=<model>]` |
| Models | `gen4.5` |
| Duration | `--duration <seconds>` |
| Aspect ratio | `--aspect-ratio 16:9\|9:16`; mapped to `1280:720` or `720:1280` |

```bash
bun as video "a cinematic mountain sunrise" --provider runway=gen4.5 --duration 5 --aspect-ratio 16:9
bun as video "a sunset timelapse" --provider runway=gen4.5 --duration 5 --price
```

Runway `gen4.5` durations are clamped to `2` through `10` seconds and default to `5`; prompts are capped at 1000 UTF-16 code units.

```bash
# Same provider, multiple models
bun as video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-fast-generate-preview --provider gemini=veo-3.1-generate-preview --provider gemini=veo-3.1-lite-generate-preview

# Write pipeline
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm gemini=gemini-3.1-flash-lite --video gemini=veo-3.1-fast-generate-preview
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --video gemini=veo-3.1-fast-generate-preview --video minimax=MiniMax-Hailuo-2.3 --video glm=cogvideox-3 --price
```

## Output

Single-provider runs write:

```text
output/YYYY-MM-DD_HH-mm-ss_video-gen/
  generated-video.mp4
  run.json
```

Multi-provider runs write one file per provider:

```text
output/YYYY-MM-DD_HH-mm-ss_video-gen/
  generated-video-gemini-veo-3.1-fast-generate-preview.mp4
  generated-video-minimax-MiniMax-Hailuo-2.3.mp4
  generated-video-glm-cogvideox-3.mp4
  generated-video-grok-grok-imagine-video.mp4
  generated-video-runway-gen4.5.mp4
  run.json
```

`run.json` includes `video`, `cost`, and `timing` sections. `video` is always an array, even when only one provider succeeds.

`--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; a warning is logged and the run succeeds if at least one provider succeeds.
- Video generation tests cover validation and `--price`; live provider-generation tests require the relevant API keys. See [Step 6 Service Tests: Video](../../../tests/step-6-service-tests-video.md).
