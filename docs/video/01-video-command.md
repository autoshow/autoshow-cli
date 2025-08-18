# Video Generation Command

Generate AI-powered videos using Google's Veo models through the Gemini API or Runway's models through the Runway API. Create high-quality videos from text prompts or animate existing images with sound.

## Prerequisites

### For Google Veo
You need a Gemini API key to use Veo video generation:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to your `.env` file:
```env
GEMINI_API_KEY=your_api_key_here
```

### For Runway
You need a Runway API key to use Runway video generation:

1. Get an API key from [Runway API](https://app.runwayml.com/settings/api)
2. Add to your `.env` file:
```env
RUNWAYML_API_SECRET=your_api_key_here
```

## Basic Usage

### Generate from Text Prompt (Veo)
```bash
# Simple video generation with Veo
npm run as -- video generate --prompt "A dancing panda in space"

# With custom output path
npm run as -- video generate --prompt "Sunset over mountains" --output my-video.mp4

# Using fast generation model
npm run as -- video generate --prompt "Ocean waves" --model veo-3.0-fast-generate-preview
```

### Generate from Image (Image-to-Video)
```bash
# Animate with Veo
npm run as -- video generate --prompt "Camera slowly zooms in" --image input/photo.jpg

# Animate with Runway
npm run as -- video generate --prompt "Smooth camera movement" --image input/photo.jpg --model gen4_turbo
```

## Available Models

### Google Veo Models

#### Veo 3 Preview (Default)
- **Model**: `veo-3.0-generate-preview`
- **Features**: Native audio generation, high quality
- **Duration**: 8 seconds
- **Resolution**: 720p
- **Best for**: Cinematic shots, dialogue, sound effects

```bash
npm run as -- video generate --prompt "A man whispers 'This is amazing' while looking at stars"
```

#### Veo 3 Fast Preview
- **Model**: `veo-3.0-fast-generate-preview`
- **Features**: Faster generation, audio support
- **Duration**: 8 seconds
- **Resolution**: 720p
- **Best for**: Rapid prototyping, A/B testing, social media content

```bash
npm run as -- video generate --prompt "Quick product showcase" --model veo-3.0-fast-generate-preview
```

#### Veo 2 Stable
- **Model**: `veo-2.0-generate-001`
- **Features**: Stable version, portrait mode support
- **Duration**: 5-8 seconds
- **Resolution**: 720p
- **Best for**: Reliable generation, vertical videos

```bash
# Portrait mode (9:16) - only supported by Veo 2
npm run as -- video generate --prompt "Person walking" --model veo-2.0-generate-001 --aspect-ratio 9:16
```

### Runway Models

#### Gen-4 Turbo
- **Model**: `gen4_turbo`
- **Features**: High-quality generation, fast processing
- **Duration**: 5 or 10 seconds
- **Resolution**: 720p
- **Pricing**: 5 credits/second ($0.05/second)
- **Best for**: Professional content, marketing videos

```bash
# 5-second video
npm run as -- video generate --prompt "Wind blowing through the trees" --image input/xkcd.png --model gen4_turbo

# 10-second video
npm run as -- video generate --prompt "Cinematic reveal" --image scene.jpg --model gen4_turbo --duration 10
```

#### Gen-3 Alpha Turbo
- **Model**: `gen3a_turbo`
- **Features**: Fast generation, good quality
- **Duration**: 5 or 10 seconds
- **Resolution**: 720p (768 width)
- **Pricing**: 5 credits/second ($0.05/second)
- **Best for**: Quick iterations, cost-effective generation

```bash
npm run as -- video generate --prompt "Dynamic movement" --image input.jpg --model gen3a_turbo
```

## Command Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `-p, --prompt <text>` | Text description for video | Required | `"A cat playing piano"` |
| `-m, --model <model>` | Model to use | `veo-3.0-generate-preview` | See models above |
| `-o, --output <path>` | Output file path | Auto-generated | `output/my-video.mp4` |
| `-i, --image <path>` | Reference image for animation | None | `input/photo.jpg` |
| `-a, --aspect-ratio <ratio>` | Video aspect ratio | `16:9` | `16:9` or `9:16` |
| `-n, --negative <text>` | What to exclude (Veo only) | None | `"blurry, low quality"` |
| `--person <mode>` | Person generation (Veo only) | Varies by region | `allow_all`, `allow_adult`, `dont_allow` |
| `-d, --duration <seconds>` | Duration (Runway only) | `5` | `5` or `10` |

## Prompting Guide

### Basic Prompt Structure

Include these elements for best results:

1. **Subject**: What or who is in the video
2. **Action**: What the subject is doing
3. **Style**: Visual style or mood
4. **Camera**: Camera position and movement
5. **Ambiance**: Lighting and atmosphere

### Example Prompts

#### Simple Action
```bash
npm run as -- video generate --prompt "A golden retriever puppy running through a field of flowers, slow motion, warm sunlight"
```

#### Cinematic Shot
```bash
npm run as -- video generate --prompt "Tracking drone shot of a red convertible driving along coastal highway at sunset, cinematic, warm tones"
```

#### With Dialogue (Veo 3 only)
```bash
npm run as -- video generate --prompt "Close-up of detective examining evidence. He mutters, 'Something doesn't add up here.' Film noir style, dramatic lighting"
```

#### With Sound Effects (Veo 3 only)
```bash
npm run as -- video generate --prompt "Sports car accelerating, engine roaring loudly, tires screeching. Camera follows from low angle"
```

#### Runway Image Animation
```bash
# Subtle movement
npm run as -- video generate --prompt "Gentle breeze, leaves rustling" --image landscape.jpg --model gen4_turbo

# Dynamic action
npm run as -- video generate --prompt "Explosion in background, debris flying" --image action-scene.jpg --model gen4_turbo --duration 10
```

### Audio Prompting (Veo 3)

Veo 3 models generate synchronized audio. Use these techniques:

- **Dialogue**: Use quotes for speech: `"Hello world," she said excitedly`
- **Sound Effects**: Explicitly describe sounds: `thunder rumbling, rain pattering`
- **Ambient Noise**: Set the soundscape: `busy café chatter in background`

```bash
# Complex audio example
npm run as -- video generate --prompt "Two scientists in a lab. 'We did it!' one shouts. The other replies, 'Incredible!' Equipment beeping, electricity crackling"
```

### Negative Prompts (Veo Only)

Specify what you don't want in the video:

```bash
npm run as -- video generate --prompt "Beautiful landscape" --negative "people, buildings, text, watermarks"
```

## Runway-Specific Features

### Image Requirements
Runway models **require** an input image. The image can be:
- Local file path: `--image path/to/image.jpg`
- URL: `--image https://example.com/image.jpg`
- Supported formats: JPEG, PNG

### Aspect Ratios
Runway supports multiple aspect ratios depending on the model:

**Gen-4 Turbo ratios:**
- `16:9` → 1280×720
- `9:16` → 720×1280

**Gen-3 Alpha Turbo ratios:**
- `16:9` → 1280×768
- `9:16` → 768×1280

### Duration Control
Runway allows you to specify video duration:
```bash
# 5-second video (default)
npm run as -- video generate --prompt "Quick motion" --image input.jpg --model gen4_turbo

# 10-second video
npm run as -- video generate --prompt "Extended sequence" --image input.jpg --model gen4_turbo --duration 10
```

## Advanced Examples

### Product Showcase
```bash
# Veo version
npm run as -- video generate \
  --prompt "Sleek smartphone rotating 360 degrees, highlighting metallic finish, professional product shot, white background" \
  --model veo-3.0-fast-generate-preview

# Runway version
npm run as -- video generate \
  --prompt "Product slowly rotating, studio lighting, clean background" \
  --image product-photo.jpg \
  --model gen4_turbo
```

### Nature Scene with Audio
```bash
npm run as -- video generate \
  --prompt "Waterfall in tropical rainforest, mist rising, birds chirping, water rushing sound, peaceful atmosphere" \
  --negative "people, man-made structures"
```

### Animated Illustration
```bash
# Veo
npm run as -- video generate \
  --prompt "Cartoon style animation of a happy robot dancing, colorful, bouncy movements" \
  --image robot-drawing.png

# Runway
npm run as -- video generate \
  --prompt "Character comes to life, starts moving and dancing" \
  --image illustration.png \
  --model gen4_turbo
```

### Social Media Content (Portrait)
```bash
# Veo (Veo 2 only)
npm run as -- video generate \
  --prompt "Fashion model walking towards camera, urban background, trendy outfit" \
  --model veo-2.0-generate-001 \
  --aspect-ratio 9:16

# Runway
npm run as -- video generate \
  --prompt "Model walking, confident pose, fashion shoot" \
  --image model-photo.jpg \
  --model gen3a_turbo \
  --aspect-ratio 9:16
```

## Tips for Best Results

### Do's
- Be specific and descriptive
- Include style keywords (cinematic, cartoon, realistic)
- Specify camera movements (pan, zoom, tracking shot)
- Add lighting details (sunset, neon, dramatic shadows)
- Use scene composition terms (close-up, wide shot, aerial view)
- For Runway: Use high-quality input images
- For Runway: Match prompt to image content

### Don'ts
- Avoid overly complex multi-scene descriptions
- Don't use negative words in main prompt (use --negative instead for Veo)
- Avoid copyrighted character names
- Don't expect perfect lip-sync for dialogue
- For Runway: Don't try text-only generation

## Processing Time

Video generation typically takes:

### Veo
- **Minimum**: 11 seconds
- **Average**: 1-2 minutes
- **Peak hours**: Up to 6 minutes

### Runway
- **Gen-4 Turbo**: 30-90 seconds
- **Gen-3 Alpha Turbo**: 20-60 seconds

Both services automatically poll for completion and download when ready.

## Limitations

### Veo Limitations
- **Duration**: Videos are 5-8 seconds long
- **Resolution**: 720p maximum
- **Format**: MP4 with H.264 encoding
- **Retention**: Videos stored for 2 days
- **Watermark**: SynthID watermarking
- **Regional restrictions**: Person generation may be limited in EU/UK
- **Safety filters**: Some content may be blocked

### Runway Limitations
- **Duration**: 5 or 10 seconds only
- **Resolution**: 720p
- **Input required**: Must provide an image
- **Pricing**: Costs credits ($0.05/second)
- **Watermark**: May include Runway watermark
- **API limits**: Subject to rate limiting

## Troubleshooting

### "No video URI in response"
The video was likely blocked by safety filters. Try:
- Adjusting your prompt to be less ambiguous
- Using negative prompts to exclude problematic content (Veo)
- Avoiding prompts that might generate restricted content

### "API quota exceeded"
- For Veo: Check your Gemini API quotas at [Google AI Studio](https://aistudio.google.com)
- For Runway: Check your credit balance at [Runway Dashboard](https://app.runwayml.com)

### "Invalid API key"
- For Veo: Ensure `GEMINI_API_KEY` is correctly set in `.env`
- For Runway: Ensure `RUNWAYML_API_SECRET` is correctly set in `.env`

### "Image is required"
Runway models require an input image. Provide one with `--image path/to/image.jpg`

### Portrait mode not working
- Veo: Portrait aspect ratio (9:16) is only supported by `veo-2.0-generate-001`
- Runway: Both models support portrait, ensure image is appropriate

## List Available Models
```bash
npm run as -- video list-models
```

## Cost Considerations

### Veo (Google)
Video generation uses the Gemini API. Check current pricing at [Google AI Pricing](https://ai.google.dev/pricing)

### Runway
- **Pricing**: $0.05 per second of video (5 credits/second)
- **5-second video**: $0.25 (25 credits)
- **10-second video**: $0.50 (50 credits)
- Check balance at [Runway Dashboard](https://app.runwayml.com)

## Examples Gallery

### Business & Marketing
```bash
# Product launch teaser (Veo)
npm run as -- video generate --prompt "New smartphone emerging from smoke, dramatic reveal, spotlight, suspenseful music"

# Product demo (Runway)
npm run as -- video generate --prompt "Phone features highlighted, smooth transitions" --image phone.jpg --model gen4_turbo

# Real estate tour (Veo)
npm run as -- video generate --prompt "Smooth walkthrough of modern luxury apartment, natural lighting, elegant interior"
```

### Creative & Artistic
```bash
# Abstract art (Veo)
npm run as -- video generate --prompt "Colorful paint swirling and mixing, abstract patterns forming, mesmerizing flow"

# Art animation (Runway)
npm run as -- video generate --prompt "Painting comes alive, colors start moving" --image artwork.jpg --model gen4_turbo

# Music visualization (Veo)
npm run as -- video generate --prompt "Geometric shapes pulsing to electronic beat, neon colors, synchronized movement"
```

### Educational
```bash
# Science demonstration (Veo)
npm run as -- video generate --prompt "DNA double helix rotating slowly, scientific visualization, educational style"

# Historical recreation (Runway)
npm run as -- video generate --prompt "Scene comes to life, people start moving" --image historical-painting.jpg --model gen3a_turbo
```

### Entertainment
```bash
# Action scene (Veo)
npm run as -- video generate --prompt "Superhero landing from sky, ground cracking impact, dust clouds, dramatic pose"

# Character animation (Runway)
npm run as -- video generate --prompt "Character springs into action, dynamic movement" --image character.jpg --model gen4_turbo --duration 10

# Comedy skit (Veo)
npm run as -- video generate --prompt "Clumsy robot trying to make coffee, slapstick comedy style, 'Oops!' sound effect"
```

## Model Comparison

| Feature | Veo 3 | Veo 2 | Gen-4 Turbo | Gen-3 Alpha Turbo |
|---------|-------|-------|-------------|-------------------|
| **Duration** | 8s | 5-8s | 5-10s | 5-10s |
| **Resolution** | 720p | 720p | 720p | 720p |
| **Audio** | ✅ | ❌ | ❌ | ❌ |
| **Portrait** | ❌ | ✅ | ✅ | ✅ |
| **Image Input** | Optional | Optional | Required | Required |
| **Speed** | Medium | Fast | Fast | Very Fast |
| **Cost** | Free* | Free* | $0.05/s | $0.05/s |

*Subject to API quotas