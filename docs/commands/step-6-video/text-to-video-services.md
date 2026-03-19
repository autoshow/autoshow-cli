# video

Generate a video from a text prompt.

## Outline

- [Usage](#usage)
- [Providers](#providers)
- [Examples](#examples)
  - [OpenAI Sora](#openai-sora)
  - [Gemini Veo](#gemini-veo)
  - [MiniMax](#minimax)
  - [Preflight cost estimate](#preflight-cost-estimate)
  - [Video generation in the write pipeline](#video-generation-in-the-write-pipeline)
- [Flags](#flags)
  - [Provider selection](#provider-selection)
  - [Generation options](#generation-options)
  - [Pricing](#pricing)
- [Output](#output)
  - [metadata.json schema](#metadatajson-schema)
- [Notes](#notes)

## Usage

```bash
bun as video <prompt> [flags]
```

## Providers

Three video generation providers are supported:

| Provider | Flag | Models | Notes |
|----------|------|--------|-------|
| **OpenAI Sora** | `--sora-video <model>` | `sora-2`, `sora-2-pro` | API key required |
| **Gemini Veo** | `--gemini-video <model>` | `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview` | API key required |
| **MiniMax** | `--minimax-video <model>` | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01` | API key required |

Only one provider flag may be used at a time.

## Examples

### OpenAI Sora

```bash
# Sora default model
bun as video "a cinematic drone shot over snowy mountains" --sora-video sora-2

# Pro model with explicit duration/size
bun as video "a cinematic drone shot over snowy mountains" --sora-video sora-2-pro --video-duration 8 --video-size 1280x720
```

### Gemini Veo

```bash
# Veo fast model
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-fast-generate-preview

# Veo preview model with aspect ratio/resolution
bun as video "a rainy neon city street, slow camera pan" --gemini-video veo-3.1-generate-preview --video-duration 6 --video-aspect-ratio 16:9 --video-resolution 1080p
```

### MiniMax

```bash
# MiniMax Hailuo model
bun as video "a rainy neon city street, slow camera pan" --minimax-video MiniMax-Hailuo-2.3 --video-duration 10 --video-resolution 720p

# MiniMax T2V model
bun as video "a rainy neon city street, slow camera pan" --minimax-video T2V-01
```

### Preflight cost estimate

Print estimated cost without running generation:

```bash
# Sora estimate
bun as video "a sunset timelapse" --sora-video sora-2 --price

# Veo estimate
bun as video "a sunset timelapse" --gemini-video veo-3.1-fast-generate-preview --video-duration 8 --price

# MiniMax estimate
bun as video "a sunset timelapse" --minimax-video MiniMax-Hailuo-2.3 --video-duration 10 --price
```

### Video generation in the write pipeline

Video generation runs after step 3 (LLM output), in parallel with image generation, music generation, and TTS when enabled.

```bash
# Generate summary + video
bun as write "https://youtube.com/..." --openai openai/gpt-oss-20b --sora-video sora-2

# Gemini LLM + Gemini Veo video
bun as write "https://youtube.com/..." --gemini gemini-3-flash-preview --gemini-video veo-3.1-fast-generate-preview

# Preflight write video cost only
bun as write "https://youtube.com/..." --gemini-video veo-3.1-fast-generate-preview --price
```

## Flags

### Provider selection

| Flag | Description |
|------|-------------|
| `--sora-video <model>` | Sora model: `sora-2` \| `sora-2-pro` |
| `--gemini-video <model>` | Gemini Veo model: `veo-3.1-generate-preview` \| `veo-3.1-fast-generate-preview` |
| `--minimax-video <model>` | MiniMax model: `MiniMax-Hailuo-2.3` \| `MiniMax-Hailuo-02` \| `T2V-01-Director` \| `T2V-01` |

### Generation options

| Flag | Description |
|------|-------------|
| `--video-duration <seconds>` | Video duration in seconds (Gemini Veo 3.x supports 4, 6, or 8; values are normalized) |
| `--video-size <size>` | Sora size: `720x1280` \| `1280x720` \| `1024x1792` \| `1792x1024` |
| `--video-aspect-ratio <ratio>` | Gemini aspect ratio: `16:9` \| `9:16` |
| `--video-resolution <res>` | Gemini resolution: `720p` \| `1080p` |

### Pricing

| Flag | Description |
|------|-------------|
| `--price` | Show cost estimate and exit without generating |

## Output

Each standalone `video` run writes to a timestamped output directory:

```
output/YYYY-MM-DD_HH-mm-ss_video-gen/
  generated-video.mp4
  metadata.json
```

### metadata.json schema

```json
{
  "video": {
    "videoGenService": "sora",
    "videoGenModel": "sora-2",
    "processingTime": 182345,
    "videoFileName": "generated-video.mp4",
    "videoFileSize": 8934212,
    "videoDuration": 8
  }
}
```

When run through `write`, metadata is stored under `step6`.

## Notes

- Exactly one video provider must be selected.
- `--price` shows a cost estimate and exits before generating.
- Cost estimates are approximate and model-specific.
- If the provider API does not return final billing data, metadata/logging preserves estimated cost and generated artifact details.
- Setup and environment variable details are centralized in [`setup.md`](../step-0-setup/setup.md).
