# CogVideoX Video Generation

Generate videos using THUDM's open-source CogVideoX models via diffusers.

## Setup

```bash
# Install CogVideoX (one-time setup)
bash .github/setup/video/cogvideo.sh

# Models download automatically on first use (~10GB for 2B, ~20GB for 5B)
```

## Models

- `cogvideo-2b` - CogVideoX-2B: 4GB VRAM minimum, fastest
- `cogvideo-5b` - CogVideoX-5B: 5GB VRAM minimum, better quality
- `cogvideo-5b-i2v` - CogVideoX-5B Image-to-Video variant

## Basic Usage

```bash
# Generate with CogVideoX-2B (default)
npm run as -- video generate \
  --prompt "A cat playing piano" \
  --model cogvideo-2b

# Use CogVideoX-5B for better quality
npm run as -- video generate \
  --prompt "Sunset over mountains" \
  --model cogvideo-5b

# Image-to-video generation
npm run as -- video generate \
  --prompt "Camera pans across landscape" \
  --model cogvideo-5b-i2v \
  --image input.jpg
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--prompt` | Video description | Required |
| `--model` | cogvideo-2b/5b/5b-i2v | cogvideo-2b |
| `--frames` | Number of frames (8N+1, max 49) | 49 |
| `--steps` | Inference steps | 50 |
| `--guidance` | Guidance scale | 6.0 |
| `--seed` | Random seed | Random |
| `--negative` | What to exclude | None |
| `--image` | Input image (i2v model only) | None |
| `--output` | Output path | Auto-generated |

## Examples

```bash
# Fast preview with fewer frames
npm run as -- video generate \
  --prompt "Lightning storm" \
  --model cogvideo-2b \
  --frames 25 \
  --steps 30

# High quality with CogVideoX-5B
npm run as -- video generate \
  --prompt "Professional chef preparing sushi" \
  --model cogvideo-5b \
  --steps 50 \
  --guidance 7.0

# Reproducible generation
npm run as -- video generate \
  --prompt "Butterfly on flower" \
  --seed 42 \
  --model cogvideo-2b

# With negative prompt
npm run as -- video generate \
  --prompt "Clean modern architecture" \
  --negative "people, cars, text" \
  --model cogvideo-5b

# Image-to-video animation
npm run as -- video generate \
  --prompt "Gentle breeze, leaves rustling" \
  --model cogvideo-5b-i2v \
  --image landscape.jpg
```

## Memory Requirements

| Model | Minimum VRAM | Recommended | Speed |
|-------|--------------|-------------|-------|
| cogvideo-2b | 4GB | 8GB | ~90s on A100 |
| cogvideo-5b | 5GB | 12GB | ~180s on A100 |
| cogvideo-5b-i2v | 5GB | 12GB | ~180s on A100 |

With optimizations enabled (automatic):
- `enable_model_cpu_offload()` - Reduces memory usage
- `vae.enable_slicing()` - Processes frames in chunks
- `vae.enable_tiling()` - Reduces VAE memory

## Video Specifications

- Resolution: 720x480 (fixed)
- Frame rate: 8 fps
- Duration: 6 seconds (49 frames)
- Format: MP4 (H.264)

## Prompt Tips

CogVideoX works best with detailed prompts:

```bash
# Good prompt
npm run as -- video generate \
  --prompt "A golden retriever running through a field of sunflowers, \
  slow motion, sunset lighting, cinematic" \
  --model cogvideo-5b

# Better with style descriptors
npm run as -- video generate \
  --prompt "Cyberpunk city street, neon lights reflecting on wet \
  pavement, flying cars, blade runner style" \
  --model cogvideo-5b
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Out of memory | Use cogvideo-2b or reduce steps |
| Slow generation | Normal - 2B is fastest option |
| Import errors | Re-run setup script |
| Model download fails | Check internet connection, will retry |
| Poor quality | Use cogvideo-5b with more steps |

## Advanced Usage

For better results, optimize prompts with an LLM first:

```bash
# Use the prompt optimization tool
npm run as -- video optimize-prompt \
  --input "cat playing piano" \
  --model gpt-4

# Then use the optimized prompt
npm run as -- video generate \
  --prompt "[optimized prompt here]" \
  --model cogvideo-5b
```

## Notes

- First run downloads the full model (automatic)
- CogVideoX is trained on English prompts
- The 2B model uses FP16, 5B models use BF16
- CPU-only inference is possible but very slow
- Models are cached in `build/models/cogvideo/`
```

Now all the broken Wan files have been removed and replaced with working CogVideoX integration. Run:

```bash
bash .github/setup/video/cogvideo.sh
npm run as -- video generate --prompt "a panda in space" --model cogvideo-2b
```