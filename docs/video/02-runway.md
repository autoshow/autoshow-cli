# Runway Video Generation

Image-to-video animation using Runway's Gen-3 and Gen-4 models.

## Setup

Add to `.env`:
```
RUNWAYML_API_SECRET=your_api_key_here
```

## Models

- `gen4_turbo` - Highest quality, 5-10 seconds
- `gen3a_turbo` - Faster generation, 5-10 seconds

**Note:** All Runway models require an input image.

## Basic Usage

```bash
# Animate an image
bun as -- video generate \
  --prompt "Ocean waves" \
  --image input/wave.jpg \
  --model gen3a_turbo

# Extended duration
bun as -- video generate \
  --prompt "Zoom out revealing landscape" \
  --image scene.jpg \
  --model gen4_turbo \
  --duration 10
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--prompt` | Motion description | Required |
| `--image` | Input image path | Required |
| `--model` | gen4_turbo or gen3a_turbo | gen4_turbo |
| `--duration` | 5 or 10 seconds | 5 |
| `--aspect-ratio` | 16:9 or 9:16 | 16:9 |
| `--output` | Output path | Auto-generated |

## Examples

```bash
# Simple animation
bun as -- video generate \
  --prompt "Gentle breeze, leaves rustling" \
  --image landscape.jpg \
  --model gen4_turbo

# Dynamic movement
bun as -- video generate \
  --prompt "Explosion in background, debris flying" \
  --image action-scene.jpg \
  --model gen4_turbo \
  --duration 10

# Portrait orientation
bun as -- video generate \
  --prompt "Hair flowing in wind" \
  --image portrait.jpg \
  --model gen3a_turbo \
  --aspect-ratio 9:16

# Fast generation
bun as -- video generate \
  --prompt "Water ripples expanding" \
  --image pond.jpg \
  --model gen3a_turbo
```

## Tips

- Describe camera movement clearly (pan, zoom, tilt)
- Specify motion direction and speed
- Use high-quality input images
- Gen-4 produces better quality but costs more
- 10-second videos provide smoother animations