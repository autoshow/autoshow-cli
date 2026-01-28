# Google Veo Video Generation

Text-to-video generation with Google's Veo 3.1 models, featuring native audio, portrait mode, and up to 4K resolution.

## Setup

Add to `.env`:
```
GEMINI_API_KEY=your_api_key_here
```

## Models

- `veo-3.1-generate-preview` - Full-featured with native audio, portrait mode, 720p/1080p/4k, reference images
- `veo-3.1-fast-generate-preview` - Faster generation with full feature support

## Basic Usage

```bash
# Standard generation
bun as -- video generate \
  --prompt "A butterfly landing on a flower" \
  --model veo-3.1-generate-preview

# With audio description
bun as -- video generate \
  --prompt "Ocean waves crashing. Sound of seagulls and wind." \
  --model veo-3.1-fast-generate-preview
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--prompt` | Video and audio description | Required |
| `--model` | Veo model version | veo-3.1-fast-generate-preview |
| `--resolution` | Output resolution (720p, 1080p, 4k) | 720p |
| `--aspect-ratio` | 16:9 or 9:16 | 16:9 |
| `--negative` | What to exclude | None |
| `--person` | Person generation mode | Varies by region |
| `--image` | Starting frame for image-to-video | None |
| `--reference` | Reference images (up to 3) | None |
| `--output` | Output path | Auto-generated |

## Examples

```bash
# With dialogue
bun as -- video generate \
  --prompt "'Hello!' she says cheerfully. Birds chirping." \
  --model veo-3.1-generate-preview

# Exclude elements
bun as -- video generate \
  --prompt "Mountain landscape at sunrise" \
  --negative "people, buildings, text" \
  --model veo-3.1-fast-generate-preview

# Portrait mode
bun as -- video generate \
  --prompt "Fashion model on runway" \
  --model veo-3.1-generate-preview \
  --aspect-ratio 9:16

# 4K resolution
bun as -- video generate \
  --prompt "Stunning drone view of Grand Canyon at sunset" \
  --model veo-3.1-generate-preview \
  --resolution 4k

# Image-to-video (starting frame)
bun as -- video generate \
  --prompt "Panning shot of the scene coming to life" \
  --model veo-3.1-generate-preview \
  --image ./starting-frame.jpg

# Reference images for content guidance
bun as -- video generate \
  --prompt "Woman in elegant dress walks through a garden" \
  --model veo-3.1-generate-preview \
  --reference dress.jpg woman.jpg garden.jpg \
  --resolution 1080p
```

## Audio Prompting

Include sound descriptions and dialogue in quotes:

```bash
bun as -- video generate \
  --prompt "Two scientists in a lab. 'Eureka!' one shouts. Equipment beeping, electricity crackling." \
  --model veo-3.1-generate-preview
```

## Reference Images

Use up to 3 reference images to preserve subject appearance:

```bash
bun as -- video generate \
  --prompt "The woman in the red dress dances elegantly" \
  --reference woman.jpg dress.jpg background.jpg \
  --model veo-3.1-generate-preview
```

## Person Generation Modes

Control how people appear in videos:
- `allow_all` - No restrictions
- `allow_adult` - Adults only
- `dont_allow` - No people

```bash
bun as -- video generate \
  --prompt "Busy street scene" \
  --person allow_adult \
  --model veo-3.1-generate-preview
```

## Veo 3.1 Capabilities

- **Portrait videos**: Both landscape (16:9) and portrait (9:16)
- **Resolution options**: 720p, 1080p, or 4k output
- **Reference images**: Use up to 3 images to guide video content
- **Native audio**: Dialogue and sound effects generated directly from prompts
- **Image-to-video**: Use a starting frame to begin your video
