# Image Generation Command

Create AI-generated images using multiple services including DALL-E 3, Black Forest Labs, AWS Nova Canvas, stable-diffusion.cpp, and Runway.

## Quick Start

```bash
npm run as -- image generate --prompt "A serene mountain landscape"

npm run as -- image generate --prompt "A majestic dragon" --service bfl

npm run as -- image generate --prompt "Space station interior" --service nova

npm run as -- image generate --prompt "A beautiful sunset" --service sdcpp

npm run as -- image generate --prompt "Futuristic cityscape" --service runway
```

## Available Services

- **DALL-E 3** (`dalle`) - OpenAI's latest image generation model
- **Black Forest Labs** (`bfl`) - High-quality Flux models  
- **AWS Nova Canvas** (`nova`) - Amazon's image generation service
- **stable-diffusion.cpp** (`sdcpp`) - Local generation with SD1.5 and SD3.5
- **Runway** (`runway`) - Professional image generation

## Service Comparison

```bash
npm run as -- image compare "A beautiful sunset over mountains"
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
- [stable-diffusion.cpp Options](./05-sdcpp-options.md)