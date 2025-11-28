# Image Generation Command

Create AI-generated images using multiple cloud-based services including DALL-E 3, Black Forest Labs, AWS Nova Canvas, and Runway.

## Quick Start

```bash
bun as -- image generate --prompt "A serene mountain landscape"

bun as -- image generate --prompt "A majestic dragon" --service bfl

bun as -- image generate --prompt "Space station interior" --service nova

bun as -- image generate --prompt "Futuristic cityscape" --service runway
```

## Available Services

- **DALL-E 3** (`dalle`) - OpenAI's latest image generation model
- **Black Forest Labs** (`bfl`) - High-quality Flux models  
- **AWS Nova Canvas** (`nova`) - Amazon's image generation service
- **Runway** (`runway`) - Professional image generation

## Service Comparison

```bash
bun as -- image compare "A beautiful sunset over mountains"
```

## Configuration

Add API keys to your `.env` file:
```env
OPENAI_API_KEY=your_openai_key
BFL_API_KEY=your_bfl_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
RUNWAYML_API_SECRET=your_runway_key
```

## Service Documentation

- [DALL-E 3 Options](./02-dalle-options.md)
- [Black Forest Labs Options](./03-bfl-options.md)
- [AWS Nova Canvas Options](./04-nova-options.md)