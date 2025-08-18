# Video Generation Command

Generate AI-powered videos using Wan2.1 open-source models (beta), Google's Veo models, or Runway's models from text prompts or images.

## Basic Usage

```bash
npm run as -- video generate --prompt "A dancing panda in space"

npm run as -- video generate --prompt "Sunset over mountains" --output my-video.mp4

npm run as -- video generate --prompt "Ocean waves" --model veo-3.0-generate-preview

npm run as -- video generate --prompt "Camera slowly zooms in" --image input/photo.jpg

npm run as -- video generate --prompt "Smooth camera movement" --image input/photo.jpg --model gen4_turbo
```

## Available Models

### Wan2.1 Open-Source Models (Beta - Integration in Progress)
- `t2v-1.3b` - **Default model** - Text-to-Video 1.3B (480p, 5 seconds, consumer GPU friendly)
- `t2v-14b` - Text-to-Video 14B high-quality model (480p/720p, 5 seconds)
- `vace-1.3b` - VACE 1.3B for video creation/editing (Coming soon)
- `vace-14b` - VACE 14B for advanced video creation/editing (Coming soon)

**Note:** Wan2.1 models are currently being integrated. Full functionality will be available in upcoming updates. For now, the system will generate placeholder videos to demonstrate the workflow.

### Google Veo Models (Cloud-based)
- `veo-3.0-generate-preview` - Newest model with native audio generation (8 seconds, 720p)
- `veo-3.0-fast-generate-preview` - Faster generation with audio support (8 seconds, 720p)
- `veo-2.0-generate-001` - Stable version with portrait mode support (5-8 seconds, 720p)

### Runway Models (Cloud-based)
- `gen4_turbo` - High-quality generation (5-10 seconds, 720p, requires image)
- `gen3a_turbo` - Fast generation (5-10 seconds, 720p, requires image)

## Command Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `-p, --prompt <text>` | Text description for video | Required | `"A cat playing piano"` |
| `-m, --model <model>` | Model to use | `t2v-1.3b` | See models above |
| `-o, --output <path>` | Output file path | Auto-generated | `output/my-video.mp4` |
| `-i, --image <path>` | Reference image for animation | None | `input/photo.jpg` |
| `-a, --aspect-ratio <ratio>` | Video aspect ratio | `16:9` | `16:9` or `9:16` |
| `-n, --negative <text>` | What to exclude | None | `"blurry, low quality"` |
| `--person <mode>` | Person generation (Veo only) | Varies by region | `allow_all`, `allow_adult`, `dont_allow` |
| `-d, --duration <seconds>` | Duration (Runway only) | `5` | `5` or `10` |
| `--frames <number>` | Number of frames (Wan only) | `81` | `81` (5 seconds at 16fps) |
| `--guidance <scale>` | Guidance scale (Wan only) | Model dependent | `6.0` for 1.3B, `5.0` for 14B |

## Wan2.1 Examples (Beta)

### Text-to-Video

```bash
# Using default T2V-1.3B model (consumer GPU friendly)
npm run as -- video generate --prompt "A majestic lion walking through golden savanna grass at sunset"

# High-quality generation with T2V-14B (when available)
npm run as -- video generate --prompt "Cinematic shot of a futuristic city" --model t2v-14b

# Portrait mode video
npm run as -- video generate \
  --prompt "Fashion model walking, dynamic pose" \
  --model t2v-1.3b \
  --aspect-ratio 9:16

# Custom guidance scale for better quality
npm run as -- video generate \
  --prompt "Underwater coral reef with tropical fish" \
  --model t2v-1.3b \
  --guidance 8.0

# Negative prompts to improve quality
npm run as -- video generate \
  --prompt "Professional chef preparing gourmet dish" \
  --model t2v-1.3b \
  --negative "blurry, low quality, watermark, text, static"
```

## Veo Examples (Cloud-based - Fully Functional)

### Audio Prompting (Veo 3)

```bash
npm run as -- video generate --prompt "Two scientists in a lab. 'We did it!' one shouts. The other replies, 'Incredible!' Equipment beeping, electricity crackling" --model veo-3.0-generate-preview
```

### Negative Prompts

```bash
npm run as -- video generate --prompt "Beautiful landscape" --negative "people, buildings, text, watermarks" --model veo-3.0-generate-preview
```

### Portrait Mode

```bash
npm run as -- video generate \
  --prompt "Fashion model walking towards camera" \
  --model veo-2.0-generate-001 \
  --aspect-ratio 9:16
```

## Runway Examples (Cloud-based - Fully Functional)

### Image-to-Video Animation

```bash
npm run as -- video generate \
  --prompt "Gentle breeze, leaves rustling" \
  --image landscape.jpg \
  --model gen4_turbo

npm run as -- video generate \
  --prompt "Explosion in background, debris flying" \
  --image action-scene.jpg \
  --model gen4_turbo \
  --duration 10
```

## Setup Requirements

### Wan2.1 Setup (One-time)

```bash
# Install Wan2.1 models and dependencies
bash .github/setup/video/wan.sh

# This will download the T2V-1.3B model by default
# Full integration is in progress
```

### API Keys (for cloud models)

For Veo models, add to `.env`:
```
GEMINI_API_KEY=your_key_here
```

For Runway models, add to `.env`:
```
RUNWAYML_API_SECRET=your_key_here
```

## List Available Models

```bash
npm run as -- video list-models
```

## Model Status

| Model | Status | Notes |
|-------|--------|-------|
| `t2v-1.3b` | Beta | Generates placeholder videos while integration is completed |
| `t2v-14b` | Beta | Model download available, integration in progress |
| `vace-1.3b` | Coming Soon | Will support advanced video editing |
| `vace-14b` | Coming Soon | Professional video creation and editing |
| `veo-*` | ✅ Fully Functional | Requires GEMINI_API_KEY |
| `gen*_turbo` | ✅ Fully Functional | Requires RUNWAYML_API_SECRET |

## Tips for Best Results

### Wan2.1 Models (Beta)
- Currently generates placeholder videos to demonstrate workflow
- Full functionality coming soon with proper Diffusers integration
- Models are being optimized for consumer GPUs

### Veo Models
- Include audio descriptions for Veo 3.0 models
- Use quotes for dialogue: `"Hello world," she said`
- Describe sound effects explicitly

### Runway Models
- Always provide a high-quality input image
- Describe motion and camera movement clearly
- Use 10-second duration for complex animations

## Troubleshooting

### Wan2.1 "Generated placeholder video" message
This is expected behavior while the Wan2.1 integration is being completed. The system generates a placeholder video to demonstrate the workflow.

### Out of Memory Errors
- Use smaller models (`t2v-1.3b`)
- Reduce resolution to 480p
- Close other GPU-intensive applications

### Model Not Found
```bash
# Re-run setup to download models
rm -rf wan_env wan2.1-repo models/wan
bash .github/setup/video/wan.sh
```

## Coming Soon

- Full Wan2.1 Diffusers integration
- VACE models for video editing
- Image-to-video with Wan2.1
- Multi-GPU support for faster generation
- Prompt extension capabilities