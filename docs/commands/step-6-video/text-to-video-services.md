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
| Gemini Veo | `--gemini-video <model>` | `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview` |
| MiniMax | `--minimax-video <model>` | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01` |

One or more provider flags can be specified. When both are given, each runs independently and produces its own output file.

## Examples

```bash
# Gemini Veo
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-fast-generate-preview
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-generate-preview --video-duration 6 --video-aspect-ratio 16:9 --video-resolution 1080p

# MiniMax
bun as video "a rainy neon city street, slow camera pan" --minimax-video MiniMax-Hailuo-2.3 --video-duration 10 --video-resolution 720p
bun as video "a rainy neon city street, slow camera pan" --minimax-video T2V-01

# Both providers at once
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-fast-generate-preview --minimax-video MiniMax-Hailuo-2.3
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-fast-generate-preview --minimax-video MiniMax-Hailuo-2.3 --price

# Price preflight
bun as video "a sunset timelapse" --gemini-video veo-3.1-fast-generate-preview --video-duration 8 --price
bun as video "a sunset timelapse" --minimax-video MiniMax-Hailuo-2.3 --video-duration 10 --price

# Write pipeline
bun as write "https://youtube.com/..." --gemini gemini-3.1-flash-lite-preview --gemini-video veo-3.1-fast-generate-preview
bun as write "https://youtube.com/..." --gemini-video veo-3.1-fast-generate-preview --minimax-video MiniMax-Hailuo-2.3 --price
```

## Flags

| Flag | Description |
|------|-------------|
| `--gemini-video <model>` | Select a Gemini Veo model |
| `--minimax-video <model>` | Select a MiniMax model |
| `--video-duration <seconds>` | Requested video duration |
| `--video-aspect-ratio <ratio>` | Gemini aspect ratio: `16:9` or `9:16` |
| `--video-resolution <res>` | Gemini and MiniMax resolution control |
| `--price` | Show the estimate and exit |

## Environment

There are no local video-generation models in this project.

```bash
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
```

## Output

Single-provider runs write:

```text
output/YYYY-MM-DD_HH-mm-ss_video-gen/
  generated-video.mp4
  metadata.json
```

Multi-provider runs write one file per provider:

```text
output/YYYY-MM-DD_HH-mm-ss_video-gen/
  generated-video-gemini-veo-3.1-fast-generate-preview.mp4
  generated-video-minimax-MiniMax-Hailuo-2.3.mp4
  metadata.json
```

`metadata.json` includes `video` (a single object for one provider, an array for multiple), `cost`, and `timing` sections.

## Notes

- Gemini durations are normalized to `4`, `6`, or `8` seconds.
- MiniMax durations are normalized to the provider-supported values for the selected model and resolution.
- When both providers are specified, each generates independently. A failure from one provider does not cancel the other; a warning is logged and the run succeeds if at least one provider succeeds.
- Video generation tests currently cover validation and `--price`, not full provider generation. See [`text-to-video-tests-services.md`](./text-to-video-tests-services.md).
