# AWS Nova Canvas Options

## Basic Usage

```bash
bun as -- image generate --prompt "Modern building" --service nova
```

## Available Options

### Resolution
```bash
bun as -- image generate --prompt "Landscape" --service nova --resolution 2048x2048
```
- Supports up to 2048x2048 pixels
- Common formats: 512x512, 1024x1024, 2048x2048

### Quality Settings
```bash
bun as -- image generate --prompt "Portrait" --service nova --quality premium
```
- `standard` - Balanced quality and speed (default)
- `premium` - Maximum quality output

### Multiple Images
```bash
bun as -- image generate --prompt "Sunset beach" --service nova --count 3
```
- Generate 1-5 images in a single request
- Each image saved with unique filename

### Negative Prompts
```bash
bun as -- image generate --prompt "Forest path" --service nova --negative "dark, scary"
```
- Specify elements to avoid in generation
- Improves control over output style

### CFG Scale
```bash
bun as -- image generate --prompt "Abstract art" --service nova --cfg-scale 8.5
```
- Range: 1.1-10.0 (default: 6.5)
- Higher values = stronger prompt adherence
- Lower values = more creative interpretation

### Seed Control
```bash
bun as -- image generate --prompt "Character design" --service nova --seed 123456
```
- Use for reproducible results
- Random seed if not specified

## Features

- **Batch Generation**: Create multiple variations simultaneously
- **Negative Prompting**: Fine-tune outputs by excluding unwanted elements
- **High Resolution**: Support for up to 2048x2048 pixel images
- **AWS Integration**: Seamless integration with AWS services

## Best Practices

1. **Negative Prompts**: Use to avoid common artifacts or unwanted styles
2. **CFG Scale**: Start with default, adjust based on results
3. **Batch Generation**: Generate multiple options for selection
4. **Resolution**: Higher resolutions for detailed subjects

## Example Commands

```bash
bun as -- image generate --prompt "Futuristic architecture" --service nova --resolution 2048x2048 --quality premium

bun as -- image generate --prompt "Fantasy character" --service nova --negative "blurry, low quality" --count 3

bun as -- image generate --prompt "Product photography" --service nova --cfg-scale 9 --seed 789
```

## AWS Configuration

Requires AWS credentials in `.env`:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
```

## Content Filtering

Nova Canvas includes automatic content filtering. Some images may be blocked if they violate content policies.