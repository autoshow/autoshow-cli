# ChatGPT Image Options

## Models

| Model | CLI Flag | Use Case |
|-------|----------|----------|
| ChatGPT Image 1.5 | `gpt-image-1.5` | State-of-the-art quality (default) |
| ChatGPT Image 1 | `gpt-image-1` | Good balance of quality and cost |
| ChatGPT Image 1 Mini | `gpt-image-1-mini` | Cost-effective, faster generation |

## Basic Usage

```bash
# Uses default model (gpt-image-1.5)
bun as -- image generate --prompt "Abstract art"

# Specify a model
bun as -- image generate --prompt "Abstract art" --service gpt-image-1
bun as -- image generate --prompt "Abstract art" --service gpt-image-1-mini
```

## Available Options

### Output Filename
```bash
bun as -- image generate --prompt "Abstract art" --service gpt-image-1.5 --output my-art.png
```

### Quality Settings
```bash
bun as -- image generate --prompt "Detailed portrait" --service gpt-image-1.5 --quality high
```
- `low` - Faster generation, lower quality
- `medium` - Balanced quality and speed
- `high` - Highest quality, more detailed images
- `auto` - Model selects optimal quality (default)

### Size Options
```bash
bun as -- image generate --prompt "City skyline" --service gpt-image-1.5 --size 1536x1024
```
- `1024x1024` - Square format
- `1536x1024` - Landscape format
- `1024x1536` - Portrait format
- `auto` - Model selects optimal size (default)

## Features

- **Superior Instruction Following**: Excels at understanding complex prompts
- **Text Rendering**: Significantly improved text generation within images
- **Detailed Editing**: High-fidelity image editing capabilities
- **Real-World Knowledge**: Better understanding of concepts and context
- **Transparency Support**: Supports transparent backgrounds with PNG/WebP output

## Best Practices

1. **Be Descriptive**: Use detailed, narrative prompts for best results
2. **Specify Style**: Include artistic style references for consistency
3. **Include Context**: Add environmental and atmospheric details
4. **Use Natural Language**: Write prompts as you would describe to a person

## Example Prompts

```bash
bun as -- image generate --prompt "A cozy coffee shop interior with warm lighting, vintage furniture, and plants by the window" --service gpt-image-1.5 --quality high

bun as -- image generate --prompt "Digital art of a cyberpunk city at night with neon signs reflecting on wet streets" --service gpt-image-1 --size 1536x1024

bun as -- image generate --prompt "Minimalist logo design for a tech startup called 'Nexus'" --service gpt-image-1-mini
```

## Model Comparison

| Feature | gpt-image-1.5 | gpt-image-1 | gpt-image-1-mini |
|---------|---------------|-------------|------------------|
| Quality | Best | High | Good |
| Speed | Slower | Medium | Fastest |
| Cost | Highest | Medium | Lowest |
| Text Rendering | Excellent | Good | Basic |

## Limitations

- Complex prompts may take up to 2 minutes to process
- Text placement may occasionally lack precision
- Visual consistency across multiple generations may vary
