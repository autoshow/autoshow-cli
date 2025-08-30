# stable-diffusion.cpp Options

## Basic Usage

```bash
npm run as -- image generate --prompt "A lovely cat" --service sdcpp
```

## Model Selection

### SD 1.5 (Default)
```bash
npm run as -- image generate --prompt "Portrait" --service sdcpp
```

### SD 3.5 Large
```bash
npm run as -- image generate --prompt "A cat holding a sign" --service sdcpp --model sd3.5
```
- Automatically uses optimized settings (1024x1024, cfg-scale 4.5)
- Requires model access approval from Hugging Face

## Core Options

### Custom Dimensions
```bash
npm run as -- image generate --prompt "Landscape" --service sdcpp --width 768 --height 512
```

### Sampling Steps
```bash
npm run as -- image generate --prompt "Detailed art" --service sdcpp --steps 30
```
- Default: 20 steps
- More steps = higher quality but slower

### Negative Prompts
```bash
npm run as -- image generate --prompt "Portrait" --service sdcpp --negative "blurry, low quality"
```

### CFG Scale
```bash
npm run as -- image generate --prompt "Abstract" --service sdcpp --cfg-scale 7.5
```
- Controls prompt adherence (1.0-20.0)
- Default: 7.0

### Seed Control
```bash
npm run as -- image generate --prompt "Character" --service sdcpp --seed 42
```

## Advanced Features

### LoRA Support
```bash
npm run as -- image generate --prompt "A cat<lora:lcm-lora-sdv1-5:1>" --service sdcpp --lora --steps 4 --cfg-scale 1.0
```
- LCM-LoRA enables 4-step generation
- Place LoRA models in build/models/sd directory

### Sampling Methods
```bash
npm run as -- image generate --prompt "Art" --service sdcpp --sampling-method "dpm++2m"
```
Available methods:
- `euler` (default)
- `euler_a`
- `heun`
- `dpm++2m`
- `dpm++2s_a`
- `lcm`

### Quantization
```bash
npm run as -- image generate --prompt "Scene" --service sdcpp --quantization q8_0
```
Options: `f32`, `f16`, `q8_0`, `q5_0`, `q5_1`, `q4_0`, `q4_1`

### Performance Options
```bash
npm run as -- image generate --prompt "Complex scene" --service sdcpp --flash-attention

npm run as -- image generate --prompt "Simple art" --service sdcpp --cpu-only
```

## Model Requirements

### SD 1.5
- Model: `v1-5-pruned-emaonly.safetensors`
- Auto-downloads during setup

### SD 3.5
- Requires Hugging Face access approval
- Visit: https://huggingface.co/stabilityai/stable-diffusion-3.5-large
- Set `HF_TOKEN` in `.env` after approval

## Example Commands

```bash
npm run as -- image generate --prompt "Photorealistic portrait" --service sdcpp --steps 50 --cfg-scale 8

npm run as -- image generate --prompt "Anime style<lora:anime-style:0.8>" --service sdcpp --lora --width 512 --height 768

npm run as -- image generate --prompt "Text logo saying 'HELLO'" --service sdcpp --model sd3.5

npm run as -- image generate --prompt "Quick sketch" --service sdcpp --steps 4 --lora --sampling-method lcm
```

## Local Generation Benefits

- No API costs
- Complete privacy
- Full control over parameters
- Custom model support
- LoRA compatibility