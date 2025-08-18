# Video Generation Command

Generate AI-powered videos using Google's Veo models or Runway's models from text prompts or images.

## Basic Usage

```bash
npm run as -- video generate --prompt "A dancing panda in space"

npm run as -- video generate --prompt "Sunset over mountains" --output my-video.mp4

npm run as -- video generate --prompt "Ocean waves" --model veo-3.0-generate-preview

npm run as -- video generate --prompt "Camera slowly zooms in" --image input/photo.jpg

npm run as -- video generate --prompt "Smooth camera movement" --image input/photo.jpg --model gen4_turbo
```

## Available Models

### Google Veo Models
- `veo-3.0-generate-preview` - Newest model with native audio generation (8 seconds, 720p)
- `veo-3.0-fast-generate-preview` - Faster generation with audio support (8 seconds, 720p)
- `veo-2.0-generate-001` - Stable version with portrait mode support (5-8 seconds, 720p)

### Runway Models
- `gen4_turbo` - High-quality generation (5-10 seconds, 720p, requires image)
- `gen3a_turbo` - Fast generation (5-10 seconds, 720p, requires image)

## Command Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `-p, --prompt <text>` | Text description for video | Required | `"A cat playing piano"` |
| `-m, --model <model>` | Model to use | `veo-3.0-fast-generate-preview` | See models above |
| `-o, --output <path>` | Output file path | Auto-generated | `output/my-video.mp4` |
| `-i, --image <path>` | Reference image for animation | None | `input/photo.jpg` |
| `-a, --aspect-ratio <ratio>` | Video aspect ratio | `16:9` | `16:9` or `9:16` |
| `-n, --negative <text>` | What to exclude (Veo only) | None | `"blurry, low quality"` |
| `--person <mode>` | Person generation (Veo only) | Varies by region | `allow_all`, `allow_adult`, `dont_allow` |
| `-d, --duration <seconds>` | Duration (Runway only) | `5` | `5` or `10` |

## Example Prompts

```bash
npm run as -- video generate --prompt "A golden retriever puppy running through a field of flowers, slow motion, warm sunlight"

npm run as -- video generate --prompt "Tracking drone shot of a red convertible driving along coastal highway at sunset, cinematic, warm tones"

npm run as -- video generate --prompt "Close-up of detective examining evidence. He mutters, 'Something doesn't add up here.' Film noir style, dramatic lighting"

npm run as -- video generate --prompt "Sports car accelerating, engine roaring loudly, tires screeching. Camera follows from low angle"

npm run as -- video generate --prompt "Gentle breeze, leaves rustling" --image landscape.jpg --model gen4_turbo

npm run as -- video generate --prompt "Explosion in background, debris flying" --image action-scene.jpg --model gen4_turbo --duration 10
```

## Audio Prompting (Veo 3)

Veo 3 models generate synchronized audio:
- **Dialogue**: Use quotes for speech: `"Hello world," she said excitedly`
- **Sound Effects**: Explicitly describe sounds: `thunder rumbling, rain pattering`
- **Ambient Noise**: Set the soundscape: `busy café chatter in background`

```bash
npm run as -- video generate --prompt "Two scientists in a lab. 'We did it!' one shouts. The other replies, 'Incredible!' Equipment beeping, electricity crackling"
```

## Negative Prompts (Veo Only)

```bash
npm run as -- video generate --prompt "Beautiful landscape" --negative "people, buildings, text, watermarks"
```

## Portrait Mode

```bash
npm run as -- video generate \
  --prompt "Fashion model walking towards camera, urban background, trendy outfit" \
  --model veo-2.0-generate-001 \
  --aspect-ratio 9:16

npm run as -- video generate \
  --prompt "Model walking, confident pose, fashion shoot" \
  --image model-photo.jpg \
  --model gen3a_turbo \
  --aspect-ratio 9:16
```

## List Available Models

```bash
npm run as -- video list-models
```