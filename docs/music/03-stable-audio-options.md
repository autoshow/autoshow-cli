# Stable Audio Options

## Basic Usage

```bash
npm run as -- music generate --prompt "cinematic orchestral music" --service stable-audio
```

## Available Models

- `stabilityai/stable-audio-open-1.0` - High-quality 44.1kHz stereo generation

Note: Requires Hugging Face access approval. Request access at:
https://huggingface.co/stabilityai/stable-audio-open-1.0

## Diffusion Parameters

### Steps
```bash
npm run as -- music generate --prompt "techno beat" --service stable-audio --steps 150
```
- Range: 10-200+ (default: 100)
- More steps = higher quality but slower
- Quick draft: 50 steps
- High quality: 150-200 steps

### CFG Scale
```bash
npm run as -- music generate --prompt "ambient soundscape" --service stable-audio --cfg-scale 9
```
- Range: 1.0-15.0 (default: 7.0)
- Controls prompt adherence
- Lower = more creative variation
- Higher = stricter prompt following

### Seed Control
```bash
npm run as -- music generate --prompt "drum and bass" --service stable-audio --seed 42
```
- Ensures reproducible results
- Same seed + parameters = identical output

## Advanced Parameters

### Sampler Type
```bash
npm run as -- music generate --prompt "jazz fusion" --service stable-audio --sampler-type k-heun
```
Available samplers:
- `dpmpp-3m-sde` (default, high quality)
- `dpmpp-2m-sde` (faster, good quality)
- `k-heun` (Heun's method)
- `k-dpm-2` (DPM solver)
- `k-dpm-fast` (fastest)

### Sigma Range
```bash
npm run as -- music generate --prompt "orchestral" --service stable-audio --sigma-min 0.1 --sigma-max 700
```
- Controls noise schedule
- Default: min=0.3, max=500
- Affects generation characteristics

### Batch Size
```bash
npm run as -- music generate --prompt "electronic" --service stable-audio --batch-size 2
```
- Generate multiple variations
- Memory intensive

## Example Commands

### Quick Generation
```bash
npm run as -- music generate --prompt "upbeat pop music" --service stable-audio --steps 50
```

### High Quality
```bash
npm run as -- music generate --prompt "epic movie soundtrack" --service stable-audio --steps 200 --cfg-scale 8
```

### Reproducible
```bash
npm run as -- music generate --prompt "lo-fi study music" --service stable-audio --seed 12345 --steps 150
```

### Experimental
```bash
npm run as -- music generate --prompt "experimental electronic" --service stable-audio --cfg-scale 4 --sampler-type k-dpm-fast
```

## Prompt Tips

Stable Audio excels with production-focused prompts:

### Good Prompts
- "Professional electronic music production with layered synthesizers"
- "Cinematic orchestral piece with lush strings and brass, 120 BPM"
- "Lo-fi hip hop beat with vinyl crackle and jazz samples, 85 BPM"

### Include Details
- BPM/tempo (e.g., "140 BPM")
- Key signature (e.g., "in C minor")
- Production style (e.g., "professionally mixed")
- Instruments (e.g., "analog synthesizers")
- Atmosphere (e.g., "spacious reverb")

## Memory Requirements

| Configuration | VRAM | System RAM |
|---------------|------|------------|
| 50 steps | ~4GB | 8GB |
| 100 steps | ~6GB | 8GB |
| 200 steps | ~6GB | 8GB |

## Configuration

Set Hugging Face token in `.env`:
```env
HF_TOKEN=your_token_here
```

## Workflow Examples

### Album Generation
```bash
SEED=12345
npm run as -- music generate --prompt "ambient album opener" --service stable-audio --seed $SEED --duration 30
npm run as -- music generate --prompt "building electronic energy" --service stable-audio --seed $((SEED+1)) --duration 30
npm run as -- music generate --prompt "peak dance track" --service stable-audio --seed $((SEED+2)) --duration 30
```

### Quality Comparison
```bash
for steps in 50 100 150; do
  npm run as -- music generate --prompt "cinematic trailer music" --service stable-audio --steps $steps --output trailer-${steps}steps.wav
done
```