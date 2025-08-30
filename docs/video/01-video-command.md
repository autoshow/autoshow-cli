# Video Generation Command

Generate AI videos using open-source or cloud-based models.

## Quick Setup

```bash
# Setup HunyuanVideo (open-source)
bash .github/setup/video/hunyuan.sh

# Add API keys to .env for cloud models
GEMINI_API_KEY=xxx        # Google Veo
RUNWAYML_API_SECRET=xxx   # Runway
```

## Basic Usage

```bash
# Generate video (default: HunyuanVideo)
npm run as -- video generate --prompt "A cat in a garden"

# Use specific model
npm run as -- video generate --prompt "Ocean waves" --model veo-3.0-generate-preview

# List all models
npm run as -- video list-models
```

## Available Models

| Provider | Model | Requirements |
|----------|-------|--------------|
| HunyuanVideo | `hunyuan-720p` (default) | 60GB VRAM |
| HunyuanVideo | `hunyuan-540p` | 45GB VRAM |
| HunyuanVideo | `hunyuan-fp8` | ~50GB VRAM |
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
--aspect-ratio <ratio>  # 16:9, 9:16, 4:3, 3:4, 1:1
--negative <text>       # What to exclude
--seed <number>         # For reproducible results
```

## Model-Specific Docs

- [HunyuanVideo Guide](./04-hunyuan.md) - Open-source 13B+ model
- [Google Veo Guide](./03-veo.md) - Cloud-based with audio support
- [Runway Guide](./02-runway.md) - Image-to-video animation