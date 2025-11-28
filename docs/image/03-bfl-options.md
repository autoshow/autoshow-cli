# Black Forest Labs (Flux) Options

## Basic Usage

```bash
bun as -- image generate --prompt "Cyberpunk city" --service bfl
```

## Available Options

### Custom Dimensions
```bash
bun as -- image generate --prompt "Fantasy landscape" --service bfl --width 1440 --height 1024
```
- Width: 256-2048 pixels
- Height: 256-2048 pixels

### Seed Control
```bash
bun as -- image generate --prompt "Abstract art" --service bfl --seed 12345
```
- Use seeds for reproducible results
- Random seed generated if not specified

### Safety Tolerance
```bash
bun as -- image generate --prompt "Portrait" --service bfl --safety 4
```
- Range: 0-5 (default: 2)
- Higher values allow more creative freedom
- Lower values apply stricter content filtering

## Advanced Parameters

### Prompt Upsampling
Automatically enhances short prompts for better results (enabled by default).

### Output Format
- Default: JPEG
- High quality compression for optimal file size

## Features

- **High Quality Output**: Flux models produce photorealistic and artistic images
- **Flexible Dimensions**: Support for custom aspect ratios
- **Fast Generation**: Optimized for quick turnaround times
- **Consistent Style**: Maintains artistic coherence across generations

## Best Practices

1. **Optimal Resolution**: Use 1024x768 or 1280x720 for best results
2. **Seed Usage**: Save seeds for variations of successful generations
3. **Safety Settings**: Adjust based on content requirements
4. **Prompt Length**: Keep prompts concise but descriptive

## Example Commands

```bash
bun as -- image generate --prompt "Majestic mountain landscape at golden hour" --service bfl --width 1920 --height 1080

bun as -- image generate --prompt "Steampunk inventor's workshop" --service bfl --seed 42 --safety 3

bun as -- image generate --prompt "Ethereal forest with bioluminescent plants" --service bfl --width 1024 --height 1536
```

## Rate Limits

- Maximum 24 concurrent tasks
- Queue-based processing for multiple requests
- Automatic retry on temporary failures