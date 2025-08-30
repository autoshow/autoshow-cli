# HunyuanVideo Generation

Open-source 13B+ parameter video model with high-quality output.

## Setup

```bash
# Install and download models (~30GB)
bash .github/setup/video/hunyuan.sh

# Models will be stored in build/models/hunyuan/
```

## Models

- `hunyuan-720p` - Default, 1280x720, 60GB VRAM
- `hunyuan-540p` - Lower resolution, 960x544, 45GB VRAM
- `hunyuan-fp8` - FP8 quantized, saves ~10GB memory

## Basic Usage

```bash
# Standard generation
npm run as -- video generate --prompt "A majestic eagle soaring"

# Memory-efficient
npm run as -- video generate --prompt "City lights" --use-fp8

# Lower resolution
npm run as -- video generate --prompt "Forest path" --model hunyuan-540p
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--prompt` | Video description | Required |
| `--model` | hunyuan-720p/540p/fp8 | hunyuan-720p |
| `--aspect-ratio` | 16:9/9:16/4:3/3:4/1:1 | 16:9 |
| `--frames` | Number of frames | 129 |
| `--steps` | Inference steps | 50 |
| `--guidance` | Guidance scale | 6.0 |
| `--flow-shift` | Flow shift value | 7.0 |
| `--seed` | Random seed | Random |
| `--negative` | What to exclude | None |
| `--use-fp8` | Use FP8 quantization | False |
| `--no-cpu-offload` | Disable CPU offload | False |

## Examples

```bash
# High quality
npm run as -- video generate \
  --prompt "Professional chef preparing sushi" \
  --steps 50 \
  --guidance 6.0

# Memory optimization
npm run as -- video generate \
  --prompt "Northern lights dancing" \
  --model hunyuan-540p \
  --use-fp8

# Different aspect ratios
npm run as -- video generate \
  --prompt "Waterfall in slow motion" \
  --aspect-ratio 9:16

# Square format
npm run as -- video generate \
  --prompt "Abstract patterns morphing" \
  --aspect-ratio 1:1

# Reproducible results
npm run as -- video generate \
  --prompt "Clouds forming" \
  --seed 42

# With negative prompt
npm run as -- video generate \
  --prompt "Clean modern architecture" \
  --negative "people, cars, text, logos"

# Custom parameters
npm run as -- video generate \
  --prompt "Galaxy formation timelapse" \
  --steps 30 \
  --guidance 7.5 \
  --flow-shift 8.0
```

## Memory Management

| Issue | Solution |
|-------|----------|
| Out of memory | Use `--use-fp8` or `--model hunyuan-540p` |
| Slow generation | Normal - expect 5-20 minutes on consumer GPUs |
| CUDA errors | CPU offload is enabled by default |

## Supported Resolutions

### 720p Mode
- 16:9 → 1280x720
- 9:16 → 720x1280  
- 4:3 → 1104x832
- 3:4 → 832x1104
- 1:1 → 960x960

### 540p Mode
- 16:9 → 960x544
- 9:16 → 544x960
- 4:3 → 624x832
- 3:4 → 832x624
- 1:1 → 720x720

## Tips

- Start with hunyuan-540p if you have <60GB VRAM
- FP8 reduces quality slightly but saves significant memory
- CPU offload is automatic but slows generation
- Higher guidance values (6-8) produce more coherent videos
- Flow shift affects motion smoothness (7.0 is optimal)