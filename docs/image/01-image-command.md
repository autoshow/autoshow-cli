# Image Generation Command

Create AI-generated images using multiple cloud-based services including ChatGPT Image models, Black Forest Labs, AWS Nova Canvas, and Runway.

## Quick Start

```bash
bun as -- image generate --prompt "A serene mountain landscape"

bun as -- image generate --prompt "A serene mountain landscape" --service gpt-image-1

bun as -- image generate --prompt "A majestic dragon" --service bfl

bun as -- image generate --prompt "Space station interior" --service nova

bun as -- image generate --prompt "Futuristic cityscape" --service runway
```

## Available Services

- **ChatGPT Image 1.5** (`gpt-image-1.5`) - OpenAI's state-of-the-art image generation (default)
- **ChatGPT Image 1** (`gpt-image-1`) - Balanced quality and cost
- **ChatGPT Image 1 Mini** (`gpt-image-1-mini`) - Cost-effective, faster generation
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

- [ChatGPT Image Options](./02-chatgpt-image-options.md)
- [Black Forest Labs Options](./03-bfl-options.md)
- [AWS Nova Canvas Options](./04-nova-options.md)
