# video

Generate a video from a text prompt with one or more hosted video providers and models.

## Outline

- [Usage](#usage)
- [Providers](#providers)
- [Examples](#examples)
- [Flags](#flags)
- [Environment](#environment)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
bun as video <prompt> [flags]
```

## Providers

| Provider | Flag | Models |
|----------|------|--------|
| Gemini Veo | `--gemini-video <model>` | `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview` |
| MiniMax | `--minimax-video <model>` | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01` |
| Z.AI GLM | `--glm-video <model>` | `cogvideox-3`, `viduq1-text` |
| Grok | `--grok-video <model>` | `grok-imagine-video` |
| Runway | `--runway-video <model>` | `gen4.5` |
| deAPI | `--deapi-video <model>` | `Ltxv_13B_0_9_8_Distilled_FP8`, `Ltx2_19B_Dist_FP8`, `Ltx2_3_22B_Dist_INT8` |

One or more provider flags can be specified. Repeating the same provider flag runs each selected model independently and produces its own output file.

## Examples

```bash
# Gemini Veo
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-fast-generate-preview
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-generate-preview --video-duration 6 --video-aspect-ratio 16:9 --video-resolution 1080p

# MiniMax
bun as video "a rainy neon city street, slow camera pan" --minimax-video MiniMax-Hailuo-2.3 --video-duration 10 --video-resolution 720p
bun as video "a rainy neon city street, slow camera pan" --minimax-video T2V-01

# Z.AI GLM
bun as video "a cat playing with yarn" --glm-video cogvideox-3 --video-duration 10 --video-size 1920x1080
bun as video "an anime character dancing" --glm-video viduq1-text --video-aspect-ratio 16:9

# Grok
bun as video "a cat playing piano" --grok-video grok-imagine-video --video-duration 8 --video-resolution 720p

# Runway
bun as video "a cinematic mountain sunrise" --runway-video gen4.5 --video-duration 5 --video-aspect-ratio 16:9

# deAPI
bun as video "a cat playing" --deapi-video Ltxv_13B_0_9_8_Distilled_FP8 --video-size 512x512 --video-duration 2

# Multiple providers at once
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-fast-generate-preview --minimax-video MiniMax-Hailuo-2.3 --runway-video gen4.5
bun as video "a rainy neon city street, slow camera pan" --all-video --price

# Same provider, multiple models
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-fast-generate-preview --gemini-video veo-3.1-generate-preview

# Price preflight
bun as video "a sunset timelapse" --gemini-video veo-3.1-fast-generate-preview --video-duration 8 --price
bun as video "a sunset timelapse" --minimax-video MiniMax-Hailuo-2.3 --video-duration 10 --price
bun as video "a sunset timelapse" --glm-video cogvideox-3 --price
bun as video "a sunset timelapse" --grok-video grok-imagine-video --price
bun as video "a sunset timelapse" --runway-video gen4.5 --video-duration 5 --price
bun as video "a sunset timelapse" --deapi-video Ltxv_13B_0_9_8_Distilled_FP8 --video-duration 2 --price

# Write pipeline
bun as write "https://youtube.com/..." --gemini gemini-3.1-flash-lite-preview --gemini-video veo-3.1-fast-generate-preview
bun as write "https://youtube.com/..." --gemini-video veo-3.1-fast-generate-preview --minimax-video MiniMax-Hailuo-2.3 --glm-video cogvideox-3 --price
```

## Flags

| Flag | Description |
|------|-------------|
| `--gemini-video <model>` | Select one or more Gemini Veo models |
| `--minimax-video <model>` | Select one or more MiniMax models |
| `--glm-video <model>` | Select one or more Z.AI GLM video models; omit the value to use the cheapest supported GLM video model |
| `--grok-video <model>` | Select one or more Grok video models; omit the value to use the cheapest supported Grok video model |
| `--runway-video <model>` | Select one or more Runway video models; omit the value to use the cheapest supported Runway video model |
| `--deapi-video <model>` | Select one or more deAPI video models; omit the value to use the cheapest supported deAPI video model |
| `--all-video` | Run every supported video provider/model |
| `--video-duration <seconds>` | Requested video duration |
| `--video-size <size>` | Provider-dependent size control. GLM CogVideoX accepts sizes such as `1920x1080`, `1280x720`, and `720x1280`; deAPI expects `WIDTHxHEIGHT` within the selected model limits |
| `--video-aspect-ratio <ratio>` | Provider-dependent aspect ratio. Runway maps `16:9` to `1280:720` and `9:16` to `720:1280` |
| `--video-resolution <res>` | Provider-dependent resolution control. Gemini and MiniMax use `720p`/`1080p`; Grok uses `480p`/`720p` |
| `--price` | Show the estimate and exit |

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

## Notes

- Gemini durations are normalized to `4`, `6`, or `8` seconds.
- MiniMax durations are normalized to the provider-supported values for the selected model and resolution.
- GLM `cogvideox-3` durations are normalized to `5` or `10` seconds. `viduq1-text` is fixed at `5` seconds.
- GLM prompts are capped at 512 characters.
- Grok durations are clamped to `1` through `15` seconds and default to `8`.
- Runway `gen4.5` durations are clamped to `2` through `10` seconds and default to `5`; prompts are capped at 1000 UTF-16 code units.
- deAPI uses `--video-size WIDTHxHEIGHT`; `--video-aspect-ratio` and `--video-resolution` are rejected. Durations are converted to model frames and clamped to the model frame range, then metadata records the normalized duration.
- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; a warning is logged and the run succeeds if at least one provider succeeds.
- Video generation tests cover validation and `--price`; live provider-generation tests require the relevant API keys. See [Step 6 Service Tests: Video](../../../tests/step-6-service-tests-video.md).
