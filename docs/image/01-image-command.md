# Image Generation Command

Create AI-generated images using multiple services including DALL-E 3, Black Forest Labs, and AWS Nova Canvas.

## Supported Services

- **DALL-E 3**: OpenAI's latest image generation model
- **Black Forest Labs (BFL)**: High-quality Flux models
- **AWS Nova Canvas**: Amazon's image generation service

## Basic Usage

### Unified Generate Command
```bash
# Generate with DALL-E 3 (default)
npm run as -- image generate --prompt "A serene mountain landscape"

# Generate with Black Forest Labs
npm run as -- image generate --prompt "A majestic dragon" --service bfl

# Generate with AWS Nova Canvas
npm run as -- image generate --prompt "Space station interior" --service nova
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

## Output Structure

Images are saved to the `output/` directory:
```
output/
├── dalle-mountain-landscape.png
├── bfl-dragon.jpg
├── nova-space-station.png
└── comparisons/
    └── sunset-comparison/
        ├── dalle-sunset.png
        ├── bfl-sunset.jpg
        └── nova-sunset.png
```

## Service-Specific Options

### DALL-E 3
- **Sizes**: 1024x1024, 1792x1024, 1024x1792
- **Quality**: standard, hd
- **Style**: vivid, natural

### Black Forest Labs
- **Models**: flux-pro-1.1, flux-pro, flux-dev
- **Width/Height**: 256-1440 pixels
- **Safety tolerance**: 0-6
- **Prompt upsampling**: true/false

### AWS Nova Canvas
- **Resolutions**: 512x512, 1024x1024, 2048x2048
- **Quality**: standard, premium
- **CFG Scale**: 1.0-15.0 (creative control)
- **Negative prompts**: Specify what to avoid

## Tips and Best Practices

1. **Prompt Engineering**
   - Be specific and descriptive
   - Include style, mood, and lighting details
   - Mention camera angles for dynamic shots

2. **Service Selection**
   - DALL-E: Best for creative, artistic images
   - BFL: High quality, good for realistic images
   - Nova: Good balance of quality and cost

3. **Quality vs Speed**
   - Use standard quality for drafts
   - Use premium/HD for final outputs
   - Generate multiple variations to choose from

4. **Cost Optimization**
   - Start with lower resolutions for concepts
   - Use service comparison to find best value
   - Save seeds for reproducible results