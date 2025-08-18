# Image Generation Command

Create AI-generated images using multiple services including DALL-E 3, Black Forest Labs, AWS Nova Canvas, and stable-diffusion.cpp.

## Supported Services

- **DALL-E 3**: OpenAI's latest image generation model
- **Black Forest Labs (BFL)**: High-quality Flux models
- **AWS Nova Canvas**: Amazon's image generation service
- **stable-diffusion.cpp**: Local generation with SD1.5, SD3.5, and FLUX.1-Kontext

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

#### FLUX.1-Kontext
```bash
# Text-guided image editing with FLUX Kontext
npm run as -- image generate --prompt "Change the text to 'Hello World'" --service sdcpp --model flux-kontext --reference-image input.png

# Style transfer
npm run as -- image generate --prompt "Make it cyberpunk style" --service sdcpp --model flux-kontext --reference-image photo.jpg
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
```