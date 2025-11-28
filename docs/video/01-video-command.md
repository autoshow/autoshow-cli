# Video Generation Command

Generate AI videos using cloud-based models.

## Quick Setup

```bash
# Add API keys to .env
GEMINI_API_KEY=xxx        # Google Veo
RUNWAYML_API_SECRET=xxx   # Runway
```

## Basic Usage

```bash
# Generate video with Google Veo (default)
bun as -- video generate --prompt "A cat in a garden"

# Use specific model
bun as -- video generate --prompt "Ocean waves" --model veo-3.0-generate-preview

# List all models
bun as -- video list-models
```

## Available Models

| Provider | Model | Requirements |
|----------|-------|--------------|
| Google Veo | `veo-3.0-generate-preview` | API key |
| Google Veo | `veo-3.0-fast-generate-preview` | API key |
| Google Veo | `veo-2.0-generate-001` | API key |
| Runway | `gen4_turbo` | API key + image |
| Runway | `gen3a_turbo` | API key + image |

## Common Options

```bash
--prompt <text>         # Required: video description
--model <model>         # Model to use
--output <path>         # Output file path
--aspect-ratio <ratio>  # 16:9 or 9:16
--negative <text>       # What to exclude
```

## Model-Specific Docs

- [Google Veo Guide](./03-veo.md) - Cloud-based with audio support
- [Runway Guide](./02-runway.md) - Image-to-video animation

## System Requirements

All video generation models run on cloud servers and require API keys. No local GPU or high RAM requirements.