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
  - [deAPI](#deapi)
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
DEAPI_API_KEY=...
```

Optional provider base URL overrides:

```bash
ZAI_BASE_URL=...
XAI_BASE_URL=...
DEAPI_BASE_URL=...
```

## Shared Video Options

| Flag | Description |
|------|-------------|
| `--all-video` | Run every supported video provider/model |
| `--video-provider-concurrency <n>` | Hosted video providers/models to run concurrently per item; default `2`, or up to `8` for `--all-video` |
| `--video-local-concurrency <n>` | Local video providers to run concurrently per item; default `1` |
| `--video-duration <seconds>` | Requested video duration |
| `--video-size <size>` | Provider-dependent size control |
| `--video-aspect-ratio <ratio>` | Provider-dependent aspect ratio |
| `--video-resolution <res>` | Provider-dependent resolution control |
| `--price` | Show the estimate and exit |
| `--out <dir>` / `--output-dir <dir>` | Use an exact run directory instead of `output/<timestamp>_video-gen/` |

```bash
bun as video "a rainy neon city street, slow camera pan" --gemini veo-3.1-fast-generate-preview --minimax MiniMax-Hailuo-2.3 --runway gen4.5
bun as video "a rainy neon city street, slow camera pan" --all-video --price
```

## Video Services

### Gemini Veo

| Option | Value |
|--------|-------|
| Selector | `--gemini <model>` |
| Models | `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.1-lite-generate-preview` |
| Duration | `--video-duration <seconds>`, normalized to `4`, `6`, or `8` |
| Resolution | `--video-resolution 720p\|1080p` |
| Aspect ratio | `--video-aspect-ratio <ratio>` |

```bash
bun as video "a rainy neon city street, slow camera pan" --gemini veo-3.1-fast-generate-preview
bun as video "a rainy neon city street, slow camera pan" --gemini veo-3.1-generate-preview --video-duration 8 --video-aspect-ratio 16:9 --video-resolution 1080p
bun as video "a rainy neon city street, slow camera pan" --gemini veo-3.1-lite-generate-preview --video-duration 4 --video-resolution 720p
bun as video "a sunset timelapse" --gemini veo-3.1-fast-generate-preview --video-duration 8 --price
```

Gemini Veo price estimates use normalized billed duration and current per-second Gemini API pricing:

| Model | 720p | 1080p | CLI timing estimate |
|-------|------|-------|---------------------|
| `veo-3.1-generate-preview` | 40.0000¢/s | 40.0000¢/s | 12000 ms/s |
| `veo-3.1-fast-generate-preview` | 10.0000¢/s | 12.0000¢/s | 10000 ms/s |
| `veo-3.1-lite-generate-preview` | 5.0000¢/s | 8.0000¢/s | 8000 ms/s |

The timing values are CLI planning heuristics, not provider SLAs. Google documents Veo request latency as roughly 11 seconds to 6 minutes, with higher resolutions generally taking longer. Gemini `1080p` requests are normalized to `8` seconds before price estimates and API requests. Gemini accepts `720p` and `1080p` through this CLI; `4k` is not supported here. Veo 3.1 Lite does not support `4k` or video extension.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--minimax <model>` |
| Models | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01` |
| Duration/resolution | `--video-duration <seconds>`, `--video-resolution 720p\|1080p` where supported |

```bash
bun as video "a rainy neon city street, slow camera pan" --minimax MiniMax-Hailuo-2.3 --video-duration 10 --video-resolution 720p
bun as video "a rainy neon city street, slow camera pan" --minimax T2V-01
bun as video "a sunset timelapse" --minimax MiniMax-Hailuo-2.3 --video-duration 10 --price
```

MiniMax durations are normalized to the provider-supported values for the selected model and resolution.

### Z.AI GLM

| Option | Value |
|--------|-------|
| Selector | `--glm <model>` |
| Models | `cogvideox-3`, `viduq1-text` |
| Size/aspect ratio | `--video-size 1920x1080`, `1280x720`, `720x1280`, or `--video-aspect-ratio <ratio>` depending on model |

```bash
bun as video "a cat playing with yarn" --glm cogvideox-3 --video-duration 10 --video-size 1920x1080
bun as video "an anime character dancing" --glm viduq1-text --video-aspect-ratio 16:9
bun as video "a sunset timelapse" --glm cogvideox-3 --price
```

GLM `cogvideox-3` durations are normalized to `5` or `10` seconds. `viduq1-text` is fixed at `5` seconds. GLM prompts are capped at 512 characters.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--grok <model>` |
| Models | `grok-imagine-video` |
| Duration/resolution | `--video-duration <seconds>`, `--video-resolution 480p\|720p` |

```bash
bun as video "a cat playing piano" --grok grok-imagine-video --video-duration 8 --video-resolution 720p
bun as video "a sunset timelapse" --grok grok-imagine-video --price
```

Grok durations are clamped to `1` through `15` seconds and default to `8`.

### Runway

| Option | Value |
|--------|-------|
| Selector | `--runway <model>` |
| Models | `gen4.5` |
| Duration | `--video-duration <seconds>` |
| Aspect ratio | `--video-aspect-ratio 16:9\|9:16`; mapped to `1280:720` or `720:1280` |

```bash
bun as video "a cinematic mountain sunrise" --runway gen4.5 --video-duration 5 --video-aspect-ratio 16:9
bun as video "a sunset timelapse" --runway gen4.5 --video-duration 5 --price
```

Runway `gen4.5` durations are clamped to `2` through `10` seconds and default to `5`; prompts are capped at 1000 UTF-16 code units.

### deAPI

| Option | Value |
|--------|-------|
| Selector | `--deapi <model>` |
| Models | `Ltxv_13B_0_9_8_Distilled_FP8`, `Ltx2_19B_Dist_FP8`, `Ltx2_3_22B_Dist_INT8` |
| Size/duration | `--video-size WIDTHxHEIGHT`, `--video-duration <seconds>` |

```bash
bun as video "a cat playing" --deapi Ltxv_13B_0_9_8_Distilled_FP8 --video-size 512x512 --video-duration 2
bun as video "a sunset timelapse" --deapi Ltxv_13B_0_9_8_Distilled_FP8 --video-duration 2 --price
```

deAPI uses `--video-size WIDTHxHEIGHT`; `--video-aspect-ratio` and `--video-resolution` are rejected. Durations are converted to model frames and clamped to the model frame range, then metadata records the normalized duration.

```bash
# Same provider, multiple models
bun as video "a rainy neon city street, slow camera pan" --gemini veo-3.1-fast-generate-preview --gemini veo-3.1-generate-preview --gemini veo-3.1-lite-generate-preview

# Write pipeline
bun as write "https://youtube.com/..." --gemini gemini-3.1-flash-lite-preview --gemini-video veo-3.1-fast-generate-preview
bun as write "https://youtube.com/..." --gemini-video veo-3.1-fast-generate-preview --minimax-video MiniMax-Hailuo-2.3 --glm-video cogvideox-3 --price
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
  generated-video-deapi-Ltxv_13B_0_9_8_Distilled_FP8.mp4
  run.json
```

`run.json` includes `video`, `cost`, and `timing` sections. `video` is always an array, even when only one provider succeeds.

`--out` / `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; a warning is logged and the run succeeds if at least one provider succeeds.
- Video generation tests cover validation and `--price`; live provider-generation tests require the relevant API keys. See [Step 6 Service Tests: Video](../../../tests/step-6-service-tests-video.md).
