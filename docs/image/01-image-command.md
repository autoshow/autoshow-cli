# Image Generation Command

Create AI-generated images using multiple services including DALL-E 3, Black Forest Labs, AWS Nova Canvas, stable-diffusion.cpp, and Runway.

## Supported Services

- **DALL-E 3**: OpenAI's latest image generation model
- **Black Forest Labs (BFL)**: High-quality Flux models
- **AWS Nova Canvas**: Amazon's image generation service
- **stable-diffusion.cpp**: Local generation with SD1.5 and SD3.5
- **Runway**: Professional image generation (requires account with text-to-image access)

## Basic Usage

### Unified Generate Command
```bash
# Generate with DALL-E 3 (default)
npm run as -- image generate --prompt "A serene mountain landscape"

# Generate with Black Forest Labs
npm run as -- image generate --prompt "A majestic dragon" --service bfl

# Generate with AWS Nova Canvas
npm run as -- image generate --prompt "Space station interior" --service nova

# Generate with stable-diffusion.cpp
npm run as -- image generate --prompt "A beautiful sunset" --service sdcpp

# Generate with Runway (requires text-to-image feature access)
npm run as -- image generate --prompt "Futuristic cityscape" --service runway
```

### DALL-E 3 Options
```bash
# Specify output filename
npm run as -- image generate --prompt "Abstract art" --service dalle --output my-art.png

# High quality
npm run as -- image generate --prompt "Detailed portrait" --service dalle --quality hd

# Different sizes
npm run as -- image generate --prompt "City skyline" --service dalle --size 1792x1024
```

### Black Forest Labs Options
```bash
# Custom dimensions
npm run as -- image generate --prompt "Cyberpunk city" --service bfl --width 1440 --height 1024

# With seed for reproducibility
npm run as -- image generate --prompt "Fantasy landscape" --service bfl --seed 12345

# Adjust safety tolerance
npm run as -- image generate --prompt "Abstract art" --service bfl --safety 4
```

### AWS Nova Canvas Options
```bash
# Premium quality with custom resolution
npm run as -- image generate --prompt "Modern building" --service nova --resolution 2048x2048 --quality premium

# Multiple images
npm run as -- image generate --prompt "Sunset beach" --service nova --count 3

# With negative prompt
npm run as -- image generate --prompt "Forest path" --service nova --negative "dark, scary"
```

### Runway Options

**Note**: Runway's text-to-image feature may require specific account access. If you receive permission errors, check your Runway account features at https://app.runwayml.com

```bash
# Basic generation with Runway
npm run as -- image generate --prompt "Mystical forest" --service runway

# Custom dimensions (uses aspect ratio)
npm run as -- image generate --prompt "Ocean waves" --service runway --width 1920 --height 1080

# With artistic style
npm run as -- image generate --prompt "Portrait" --service runway --style "oil painting"

# Specify model if you have access to specific models
npm run as -- image generate --prompt "Landscape" --service runway --runway-model "your-model-name"
```

### stable-diffusion.cpp Options

#### SD 1.5 (Default)
```bash
# Basic generation with SD 1.5
npm run as -- image generate --prompt "A lovely cat" --service sdcpp

# With custom parameters
npm run as -- image generate --prompt "Mountain landscape" --service sdcpp --width 768 --height 512 --steps 30

# With negative prompt
npm run as -- image generate --prompt "Portrait" --service sdcpp --negative "blurry, low quality"
```

#### SD 3.5 Large
```bash
# High-quality generation with SD 3.5
npm run as -- image generate --prompt "A lovely cat holding a sign says 'SD3.5'" --service sdcpp --model sd3.5

# SD 3.5 automatically uses optimized settings (1024x1024, cfg-scale 4.5)
npm run as -- image generate --prompt "Futuristic city" --service sdcpp --model sd3.5
```

#### LoRA Support
```bash
# Using LCM-LoRA for faster generation (4 steps instead of 20)
npm run as -- image generate --prompt "A lovely cat<lora:lcm-lora-sdv1-5:1>" --service sdcpp --lora --steps 4 --cfg-scale 1.0

# Custom LoRA models (place in models/sd directory)
npm run as -- image generate --prompt "Fantasy art<lora:custom-style:0.8>" --service sdcpp --lora
```

#### Advanced Options
```bash
# Flash attention for lower memory usage
npm run as -- image generate --prompt "Complex scene" --service sdcpp --flash-attention

# Different quantization levels (f32, f16, q8_0, q5_0, q5_1, q4_0, q4_1)
npm run as -- image generate --prompt "Portrait" --service sdcpp --quantization q8_0

# Different sampling methods
npm run as -- image generate --prompt "Landscape" --service sdcpp --sampling-method "dpm++2m"
```

### Service Comparison
Generate the same prompt across all services:
```bash
npm run as -- image compare "A beautiful sunset over mountains"
```

## Configuration

Add API keys to your `.env` file:
```env
# For DALL-E
OPENAI_API_KEY=your_openai_key

# For Black Forest Labs
BFL_API_KEY=your_bfl_key

# For AWS Nova Canvas
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1

# For Runway
RUNWAYML_API_SECRET=your_runway_key
```

## Service Features Comparison

| Service | Resolution | Speed | Cost | Special Features |
|---------|------------|-------|------|-----------------|
| DALL-E 3 | Up to 1792x1024 | Fast | $$$ | Natural language understanding |
| Black Forest Labs | Custom | Medium | $$ | High quality, style control |
| AWS Nova Canvas | Up to 2048x2048 | Fast | $$ | Multiple images, negative prompts |
| Runway | Custom | Medium | $$$ | Professional quality (may require specific account access) |
| stable-diffusion.cpp | Custom | Slow (local) | Free | Local generation, LoRA support |

## Troubleshooting

### Runway Permission Errors
If you receive "Permission denied" or "Model not available" errors with Runway:
- Check your Runway account features at https://app.runwayml.com
- Text-to-image may require a specific subscription tier or feature access
- Try without specifying a model to use Runway's default
- Contact Runway support if the feature should be available on your account