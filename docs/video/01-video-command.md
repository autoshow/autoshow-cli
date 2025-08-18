# Video Generation Command

Generate AI-powered videos using Google's Veo models through the Gemini API. Create high-quality videos from text prompts or animate existing images with sound.

## Prerequisites

You need a Gemini API key to use video generation:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to your `.env` file:
```env
GEMINI_API_KEY=your_api_key_here
```

## Basic Usage

### Generate from Text Prompt
```bash
# Simple video generation
npm run as -- video generate --prompt "A dancing panda in space"

# With custom output path
npm run as -- video generate --prompt "Sunset over mountains" --output my-video.mp4

# Using fast generation model
npm run as -- video generate --prompt "Ocean waves" --model veo-3.0-fast-generate-preview
```

### Generate from Image (Image-to-Video)
```bash
# Animate an existing image
npm run as -- video generate --prompt "Camera slowly zooms in" --image input/photo.jpg

# Add movement to artwork
npm run as -- video generate --prompt "Gentle wind blowing through trees" --image landscape.png
```

## Available Models

### Veo 3 Preview (Default)
- **Model**: `veo-3.0-generate-preview`
- **Features**: Native audio generation, high quality
- **Duration**: 8 seconds
- **Resolution**: 720p
- **Best for**: Cinematic shots, dialogue, sound effects

```bash
npm run as -- video generate --prompt "A man whispers 'This is amazing' while looking at stars"
```

### Veo 3 Fast Preview
- **Model**: `veo-3.0-fast-generate-preview`
- **Features**: Faster generation, audio support
- **Duration**: 8 seconds
- **Resolution**: 720p
- **Best for**: Rapid prototyping, A/B testing, social media content

```bash
npm run as -- video generate --prompt "Quick product showcase" --model veo-3.0-fast-generate-preview
```

### Veo 2 Stable
- **Model**: `veo-2.0-generate-001`
- **Features**: Stable version, portrait mode support
- **Duration**: 5-8 seconds
- **Resolution**: 720p
- **Best for**: Reliable generation, vertical videos

```bash
# Portrait mode (9:16) - only supported by Veo 2
npm run as -- video generate --prompt "Person walking" --model veo-2.0-generate-001 --aspect-ratio 9:16
```

## Command Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `-p, --prompt <text>` | Text description for video | Required | `"A cat playing piano"` |
| `-m, --model <model>` | Model to use | `veo-3.0-generate-preview` | See models above |
| `-o, --output <path>` | Output file path | Auto-generated | `output/my-video.mp4` |
| `-i, --image <path>` | Reference image for animation | None | `input/photo.jpg` |
| `-a, --aspect-ratio <ratio>` | Video aspect ratio | `16:9` | `16:9` or `9:16` |
| `-n, --negative <text>` | What to exclude from video | None | `"blurry, low quality"` |
| `--person <mode>` | Person generation control | Varies by region | `allow_all`, `allow_adult`, `dont_allow` |

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

#### With Sound Effects
```bash
npm run as -- video generate --prompt "Sports car accelerating, engine roaring loudly, tires screeching. Camera follows from low angle"
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

### Negative Prompts

Specify what you don't want in the video:

```bash
npm run as -- video generate --prompt "Beautiful landscape" --negative "people, buildings, text, watermarks"
```

## Advanced Examples

### Product Showcase
```bash
npm run as -- video generate \
  --prompt "Sleek smartphone rotating 360 degrees, highlighting metallic finish, professional product shot, white background" \
  --model veo-3.0-fast-generate-preview
```

### Nature Scene with Audio
```bash
npm run as -- video generate \
  --prompt "Waterfall in tropical rainforest, mist rising, birds chirping, water rushing sound, peaceful atmosphere" \
  --negative "people, man-made structures"
```

### Animated Illustration
```bash
npm run as -- video generate \
  --prompt "Cartoon style animation of a happy robot dancing, colorful, bouncy movements" \
  --image robot-drawing.png
```

### Social Media Content (Portrait)
```bash
npm run as -- video generate \
  --prompt "Fashion model walking towards camera, urban background, trendy outfit" \
  --model veo-2.0-generate-001 \
  --aspect-ratio 9:16
```

## Tips for Best Results

### Do's
- Be specific and descriptive
- Include style keywords (cinematic, cartoon, realistic)
- Specify camera movements (pan, zoom, tracking shot)
- Add lighting details (sunset, neon, dramatic shadows)
- Use scene composition terms (close-up, wide shot, aerial view)

### Don'ts
- Avoid overly complex multi-scene descriptions
- Don't use negative words in main prompt (use --negative instead)
- Avoid copyrighted character names
- Don't expect perfect lip-sync for dialogue

## Processing Time

Video generation typically takes:
- **Minimum**: 11 seconds
- **Average**: 1-2 minutes
- **Peak hours**: Up to 6 minutes

The command will automatically poll for completion and download when ready.

## Limitations

- **Duration**: Videos are 5-8 seconds long
- **Resolution**: 720p maximum
- **Format**: MP4 with H.264 encoding
- **Retention**: Videos are stored on Google's servers for 2 days
- **Watermark**: All videos include SynthID watermarking
- **Regional restrictions**: Person generation may be limited in EU/UK regions
- **Safety filters**: Some content may be blocked by safety systems

## Troubleshooting

### "No video URI in response"
The video was likely blocked by safety filters. Try:
- Adjusting your prompt to be less ambiguous
- Using negative prompts to exclude problematic content
- Avoiding prompts that might generate restricted content

### "API quota exceeded"
Check your Gemini API quotas and limits at [Google AI Studio](https://aistudio.google.com)

### "Invalid API key"
Ensure your `GEMINI_API_KEY` is correctly set in `.env`

### Portrait mode not working
Portrait aspect ratio (9:16) is only supported by `veo-2.0-generate-001`

## List Available Models
```bash
npm run as -- video list-models
```

## Cost Considerations

Video generation uses the Gemini API. Check current pricing at [Google AI Pricing](https://ai.google.dev/pricing)

## Examples Gallery

### Business & Marketing
```bash
# Product launch teaser
npm run as -- video generate --prompt "New smartphone emerging from smoke, dramatic reveal, spotlight, suspenseful music"

# Real estate tour
npm run as -- video generate --prompt "Smooth walkthrough of modern luxury apartment, natural lighting, elegant interior"
```

### Creative & Artistic
```bash
# Abstract art
npm run as -- video generate --prompt "Colorful paint swirling and mixing, abstract patterns forming, mesmerizing flow"

# Music visualization
npm run as -- video generate --prompt "Geometric shapes pulsing to electronic beat, neon colors, synchronized movement"
```

### Educational
```bash
# Science demonstration
npm run as -- video generate --prompt "DNA double helix rotating slowly, scientific visualization, educational style"

# Historical recreation
npm run as -- video generate --prompt "Ancient Rome marketplace, bustling with people in togas, historically accurate"
```

### Entertainment
```bash
# Action scene
npm run as -- video generate --prompt "Superhero landing from sky, ground cracking impact, dust clouds, dramatic pose"

# Comedy skit
npm run as -- video generate --prompt "Clumsy robot trying to make coffee, slapstick comedy style, 'Oops!' sound effect"
```