# AudioCraft MusicGen Options

## Basic Usage

```bash
npm run as -- music generate --prompt "energetic rock music" --service audiocraft
```

## Available Models

### Small Models (Fast)
- `facebook/musicgen-small` - 300M parameters, fast generation
- `facebook/musicgen-stereo-small` - Small stereo model

### Medium Models (Balanced)
- `facebook/musicgen-medium` - 1.5B parameters, balanced quality
- `facebook/musicgen-stereo-medium` - Medium stereo model
- `facebook/musicgen-melody` - Medium with melody conditioning

### Large Models (Best Quality)
- `facebook/musicgen-large` - 3.3B parameters, highest quality
- `facebook/musicgen-stereo-large` - Large stereo model
- `facebook/musicgen-melody-large` - Large with melody conditioning

## Generation Parameters

### Temperature
```bash
npm run as -- music generate --prompt "jazz" --temperature 1.5
```
- Range: 0.0-2.0 (default: 1.0)
- Higher = more creative/random
- Lower = more predictable

### Top-K Sampling
```bash
npm run as -- music generate --prompt "classical" --top-k 250
```
- Number of top tokens to consider
- Default: 250

### Top-P (Nucleus Sampling)
```bash
npm run as -- music generate --prompt "ambient" --top-p 0.9
```
- Range: 0.0-1.0 (default: 0.0)
- Cumulative probability threshold

### CFG Coefficient
```bash
npm run as -- music generate --prompt "electronic" --cfg-coef 3.0
```
- Classifier-free guidance strength
- Default: 3.0

### Sampling Control
```bash
npm run as -- music generate --prompt "rock" --no-sampling
```
- Use greedy decoding instead of sampling

## Special Features

### Melody Conditioning
```bash
npm run as -- music generate --prompt "jazz arrangement" --melody input/melody.wav --model facebook/musicgen-melody
```
- Requires melody-capable model
- Input audio guides the generation

### Audio Continuation
```bash
npm run as -- music generate --prompt "energetic solo" --continuation input/intro.wav --duration 15
```
- Extends existing audio
- Seamless continuation from input

### Two-Step CFG
```bash
npm run as -- music generate --prompt "orchestral" --two-step-cfg
```
- Enhanced classifier-free guidance

### Extend Stride
```bash
npm run as -- music generate --prompt "ambient" --extend-stride 18
```
- Controls continuation overlap
- Default: 18

## Example Commands

### Quick Draft
```bash
npm run as -- music generate --prompt "lo-fi hip hop beat" --model facebook/musicgen-small --duration 10
```

### High Quality
```bash
npm run as -- music generate --prompt "cinematic orchestral piece" --model facebook/musicgen-large --duration 30 --temperature 0.8
```

### Melody-Based
```bash
npm run as -- music generate --prompt "full band arrangement" --melody melody.wav --model facebook/musicgen-melody-large
```

### Continuation
```bash
npm run as -- music generate --prompt "dramatic finale" --continuation intro.wav --duration 20 --extend-stride 15
```

## Memory Requirements

| Model | VRAM | System RAM |
|-------|------|------------|
| Small | ~2GB | 4GB |
| Medium | ~6GB | 8GB |
| Large | ~12GB | 16GB |

## Tips

1. Start with smaller models for experimentation
2. Use temperature 0.7-1.2 for balanced results
3. Melody models require matching input sample rate
4. Continuation works best with similar style prompts
5. Stereo models produce richer soundscapes