# video

Generate a video from a text prompt with one of the hosted video providers.

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
| OpenAI Sora | `--sora-video <model>` | `sora-2`, `sora-2-pro` |
| Gemini Veo | `--gemini-video <model>` | `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview` |
| MiniMax | `--minimax-video <model>` | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01` |

Exactly one provider flag is required.

## Examples

```bash
# Sora
bun as video "a cinematic drone shot over snowy mountains" --sora-video sora-2
bun as video "a cinematic drone shot over snowy mountains" --sora-video sora-2-pro --video-duration 8 --video-size 1280x720

# Gemini Veo
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-fast-generate-preview
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-generate-preview --video-duration 6 --video-aspect-ratio 16:9 --video-resolution 1080p

# MiniMax
bun as video "a rainy neon city street, slow camera pan" --minimax-video MiniMax-Hailuo-2.3 --video-duration 10 --video-resolution 720p
bun as video "a rainy neon city street, slow camera pan" --minimax-video T2V-01

# Price preflight
bun as video "a sunset timelapse" --sora-video sora-2 --price
bun as video "a sunset timelapse" --gemini-video veo-3.1-fast-generate-preview --video-duration 8 --price
bun as video "a sunset timelapse" --minimax-video MiniMax-Hailuo-2.3 --video-duration 10 --price

# Write pipeline
bun as write "https://youtube.com/..." --openai gpt-5.2 --sora-video sora-2
bun as write "https://youtube.com/..." --gemini gemini-3-flash-preview --gemini-video veo-3.1-fast-generate-preview
bun as write "https://youtube.com/..." --gemini-video veo-3.1-fast-generate-preview --price
```

## Flags

| Flag | Description |
|------|-------------|
| `--sora-video <model>` | Select a Sora model |
| `--gemini-video <model>` | Select a Gemini Veo model |
| `--minimax-video <model>` | Select a MiniMax model |
| `--video-duration <seconds>` | Requested video duration |
| `--video-size <size>` | Sora size: `720x1280`, `1280x720`, `1024x1792`, `1792x1024` |
| `--video-aspect-ratio <ratio>` | Gemini aspect ratio: `16:9` or `9:16` |
| `--video-resolution <res>` | Gemini and MiniMax resolution control |
| `--price` | Show the estimate and exit |

## Environment

There are no local video-generation models in this project.

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
```

## Output

Standalone `video` runs write:

```text
output/YYYY-MM-DD_HH-mm-ss_video-gen/
  generated-video.mp4
  metadata.json
```

`metadata.json` includes `video`, `cost`, and `timing` sections.

## Notes

- Sora durations are normalized to `4`, `8`, or `12` seconds.
- Gemini durations are normalized to `4`, `6`, or `8` seconds.
- MiniMax durations are normalized to the provider-supported values for the selected model and resolution.
- Video generation tests currently cover validation and `--price`, not full provider generation. See [`text-to-video-tests-services.md`](./text-to-video-tests-services.md).
