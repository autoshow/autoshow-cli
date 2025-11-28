# DALL-E 3 Options

## Basic Usage

```bash
bun as -- image generate --prompt "Abstract art" --service dalle
```

## Available Options

### Output Filename
```bash
bun as -- image generate --prompt "Abstract art" --service dalle --output my-art.png
```

### Quality Settings
```bash
bun as -- image generate --prompt "Detailed portrait" --service dalle --quality hd
```
- `standard` - Default quality, faster generation
- `hd` - Higher quality, more detailed images

### Size Options
```bash
bun as -- image generate --prompt "City skyline" --service dalle --size 1792x1024
```
- `1024x1024` - Square format (default)
- `1792x1024` - Wide landscape format
- `1024x1792` - Tall portrait format

## Features

- **Natural Language Understanding**: DALL-E 3 excels at understanding complex, natural language prompts
- **Prompt Enhancement**: Automatically enhances and interprets prompts for better results
- **Text Rendering**: Can generate readable text within images
- **Style Consistency**: Maintains consistent artistic style across generations

## Best Practices

1. **Be Descriptive**: DALL-E 3 works best with detailed, narrative prompts
2. **Specify Style**: Include artistic style references for consistent results
3. **Include Context**: Add environmental and atmospheric details
4. **Use Natural Language**: Write prompts as you would describe to a person

## Example Prompts

```bash
bun as -- image generate --prompt "A cozy coffee shop interior with warm lighting, vintage furniture, and plants by the window" --service dalle --quality hd

bun as -- image generate --prompt "Digital art of a cyberpunk city at night with neon signs reflecting on wet streets" --service dalle --size 1792x1024

bun as -- image generate --prompt "Minimalist logo design for a tech startup called 'Nexus'" --service dalle
```

## Limitations

- Fixed aspect ratios (no custom dimensions)
- No seed control for reproducibility
- No negative prompts
- Maximum one image per request