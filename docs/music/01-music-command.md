# Music Generation Command

Generate AI-composed music using Meta's AudioCraft MusicGen models or Stability AI's Stable Audio diffusion models. Create original music from text descriptions, condition on melodies, or continue existing audio.

## Overview

The music command provides two powerful generation services:

1. **AudioCraft** - Meta's MusicGen models using auto-regressive Transformer architecture
2. **Stable Audio** - Stability AI's latent diffusion models for high-quality stereo music

Both services generate music from text prompts but use fundamentally different approaches and offer unique capabilities.

## Installation

The music generation features are installed automatically during setup:

```bash
npm run setup
```

This will:
- Install AudioCraft and Stable Audio Tools
- Download default models for both services
- Configure the Python environment

## Basic Usage

### Generate Music with AudioCraft (Default)
```bash
# Simple generation with default AudioCraft
npm run as -- music generate --prompt "upbeat electronic dance music with heavy bass"

# Explicitly specify AudioCraft service
npm run as -- music generate --prompt "calm piano melody" --service audiocraft

# Specify output file
npm run as -- music generate --prompt "jazz fusion" --output my-jazz-piece.wav

# Longer duration (up to 30 seconds)
npm run as -- music generate --prompt "epic orchestral soundtrack" --duration 30
```

### Generate Music with Stable Audio
```bash
# Use Stable Audio for generation
npm run as -- music generate --prompt "ambient electronic music" --service stable-audio

# With custom parameters
npm run as -- music generate \
  --prompt "cinematic orchestral piece with strings and brass" \
  --service stable-audio \
  --duration 20 \
  --steps 150 \
  --cfg-scale 9

# Reproducible generation with seed
npm run as -- music generate \
  --prompt "lo-fi hip hop beat" \
  --service stable-audio \
  --seed 42
```

## Service Comparison

| Feature | AudioCraft | Stable Audio |
|---------|------------|--------------|
| **Architecture** | Auto-regressive Transformer | Latent Diffusion |
| **Quality** | Good to excellent (model-dependent) | Consistently high |
| **Speed** | Fast to slow (model-dependent) | Moderate (step-dependent) |
| **Max Duration** | 30 seconds | 45+ seconds |
| **Sample Rate** | 32kHz | 44.1kHz |
| **Melody Conditioning** | ✅ Yes | ❌ No |
| **Audio Continuation** | ✅ Yes | ❌ No |
| **Stereo Models** | ✅ Yes | ✅ Yes (default) |
| **Reproducibility** | Limited | ✅ Full (with seed) |
| **VRAM Usage** | 2-12GB | 4-8GB |

## AudioCraft Models and Usage

### Available Models
```bash
# List AudioCraft models
npm run as -- music list --service audiocraft
```

### Model Sizes
| Model | Parameters | Features | Use Case |
|-------|------------|----------|----------|
| `facebook/musicgen-small` | 300M | Text-to-music | Fast generation, lower quality |
| `facebook/musicgen-medium` | 1.5B | Text-to-music | Balanced speed and quality |
| `facebook/musicgen-large` | 3.3B | Text-to-music | Best quality, slower |
| `facebook/musicgen-melody` | 1.5B | Text + melody | Follow provided melodies |
| `facebook/musicgen-stereo-*` | Various | Stereo output | Stereo generation |

### AudioCraft-Specific Features

#### Melody Conditioning
```bash
# Generate music following a melody (AudioCraft only)
npm run as -- music generate \
  --prompt "jazz arrangement" \
  --melody input/melody.wav \
  --model facebook/musicgen-melody \
  --service audiocraft
```

#### Audio Continuation
```bash
# Continue from existing audio (AudioCraft only)
npm run as -- music generate \
  --prompt "energetic rock solo" \
  --continuation input/intro.wav \
  --duration 15 \
  --service audiocraft
```

#### AudioCraft Parameters
```bash
npm run as -- music generate \
  --prompt "experimental jazz" \
  --service audiocraft \
  --temperature 1.5 \      # Creativity (0.0-2.0)
  --top-k 250 \            # Token choices
  --top-p 0.9 \            # Nucleus sampling
  --cfg-coef 3.0           # Prompt adherence
```

## Stable Audio Models and Usage

### Available Models
```bash
# List Stable Audio models
npm run as -- music list --service stable-audio
```

Currently available:
- `stabilityai/stable-audio-open-1.0` - High-quality 44.1kHz stereo generation

### Stable Audio-Specific Parameters

#### Diffusion Steps
More steps = higher quality but slower generation
```bash
# Quick draft (faster, lower quality)
npm run as -- music generate \
  --prompt "techno beat" \
  --service stable-audio \
  --steps 50

# High quality (slower)
npm run as -- music generate \
  --prompt "classical symphony" \
  --service stable-audio \
  --steps 200
```

#### CFG Scale (Classifier-Free Guidance)
Controls how closely the model follows the prompt
```bash
# More creative/varied (lower CFG)
npm run as -- music generate \
  --prompt "experimental ambient" \
  --service stable-audio \
  --cfg-scale 4

# Stricter prompt adherence (higher CFG)
npm run as -- music generate \
  --prompt "drum and bass at 174 bpm" \
  --service stable-audio \
  --cfg-scale 12
```

#### Sampler Types
Different sampling algorithms for the diffusion process
```bash
# Available samplers: dpmpp-3m-sde (default), dpmpp-2m-sde, k-heun, k-dpm-2, k-dpm-fast
npm run as -- music generate \
  --prompt "jazz fusion" \
  --service stable-audio \
  --sampler-type k-heun
```

#### Sigma Range
Controls the noise schedule for diffusion
```bash
# Custom sigma range for different characteristics
npm run as -- music generate \
  --prompt "orchestral piece" \
  --service stable-audio \
  --sigma-min 0.1 \
  --sigma-max 700
```

## Advanced Examples

### Creating Variations with Different Services
```bash
# Version 1: AudioCraft (fast, auto-regressive)
npm run as -- music generate \
  --prompt "cinematic trailer music with epic drums and brass" \
  --service audiocraft \
  --model facebook/musicgen-medium \
  --output trailer-audiocraft.wav

# Version 2: Stable Audio (high quality, diffusion)
npm run as -- music generate \
  --prompt "cinematic trailer music with epic drums and brass" \
  --service stable-audio \
  --steps 150 \
  --cfg-scale 8 \
  --output trailer-stable.wav
```

### Service-Specific Workflows

#### AudioCraft Workflow: Melody Development
```bash
# 1. Generate initial melody
npm run as -- music generate \
  --prompt "simple piano melody" \
  --service audiocraft \
  --model facebook/musicgen-small \
  --duration 8 \
  --output melody-base.wav

# 2. Create orchestral arrangement from melody
npm run as -- music generate \
  --prompt "full orchestral arrangement" \
  --melody melody-base.wav \
  --model facebook/musicgen-melody-large \
  --service audiocraft \
  --output melody-orchestrated.wav

# 3. Extend the piece
npm run as -- music generate \
  --prompt "dramatic crescendo finale" \
  --continuation melody-orchestrated.wav \
  --service audiocraft \
  --duration 15 \
  --output melody-complete.wav
```

#### Stable Audio Workflow: Consistent Album Generation
```bash
# Generate consistent tracks using seeds
SEED=12345

# Track 1: Opening
npm run as -- music generate \
  --prompt "ambient electronic album opener with soft pads" \
  --service stable-audio \
  --seed $SEED \
  --duration 30 \
  --output album-track1.wav

# Track 2: Building energy
npm run as -- music generate \
  --prompt "electronic track with building energy and arpeggios" \
  --service stable-audio \
  --seed $((SEED + 1)) \
  --duration 30 \
  --output album-track2.wav

# Track 3: Peak
npm run as -- music generate \
  --prompt "energetic electronic dance track with driving beat" \
  --service stable-audio \
  --seed $((SEED + 2)) \
  --duration 30 \
  --output album-track3.wav
```

### Batch Generation Script
```bash
#!/bin/bash
# Generate multiple variations for comparison

PROMPT="lo-fi hip hop beat with vinyl crackle"

# AudioCraft variations
for model in small medium large; do
  npm run as -- music generate \
    --prompt "$PROMPT" \
    --service audiocraft \
    --model facebook/musicgen-$model \
    --output lofi-audiocraft-$model.wav
done

# Stable Audio variations
for steps in 50 100 150; do
  npm run as -- music generate \
    --prompt "$PROMPT" \
    --service stable-audio \
    --steps $steps \
    --output lofi-stable-steps$steps.wav
done
```

## Prompt Engineering Tips

### Universal Tips (Both Services)
1. **Be Specific**: Include genre, instruments, mood, and tempo
2. **Use Musical Terms**: BPM, key signatures, time signatures
3. **Describe Structure**: Intro, verse, chorus, bridge, outro
4. **Reference Styles**: "in the style of", "inspired by"

### AudioCraft-Optimized Prompts
AudioCraft responds well to:
- Direct instrument mentions: "acoustic guitar fingerpicking"
- Energy descriptions: "high-energy", "mellow", "aggressive"
- Era references: "1980s synthwave", "baroque period"

Examples:
- ✅ "Funky disco with slap bass, wah-wah guitar, and four-on-the-floor drums"
- ✅ "Melancholic solo piano piece in the style of Erik Satie"

### Stable Audio-Optimized Prompts
Stable Audio excels with:
- Production descriptions: "professionally mixed", "vintage analog warmth"
- Atmospheric details: "spacious reverb", "tight compression"
- Sonic textures: "crisp highs", "warm mids", "deep sub-bass"

Examples:
- ✅ "Professional electronic music production with layered synthesizers, sidechained compression, and crystal-clear mix"
- ✅ "Cinematic orchestral piece with lush strings, soaring brass, and thunderous timpani, mixed for film"

## Memory Requirements

### AudioCraft
| Model Size | VRAM | System RAM | Speed |
|------------|------|------------|-------|
| Small (300M) | ~2GB | 4GB | Fast |
| Medium (1.5B) | ~6GB | 8GB | Medium |
| Large (3.3B) | ~12GB | 16GB | Slow |

### Stable Audio
| Configuration | VRAM | System RAM | Speed |
|---------------|------|------------|-------|
| Low Steps (50) | ~4GB | 8GB | Fast |
| Default (100) | ~6GB | 8GB | Medium |
| High Steps (200) | ~6GB | 8GB | Slow |

## Troubleshooting

### Service Selection Issues
```bash
# If service not recognized
npm run as -- music generate --prompt "..." --service audiocraft  # Explicit
npm run as -- music generate --prompt "..."                        # Uses default (audiocraft)

# Check available services
npm run as -- music list --service all
```

### AudioCraft-Specific Issues
```bash
# Out of memory with large models
--model facebook/musicgen-small  # Use smaller model

# Melody conditioning not working
--model facebook/musicgen-melody  # Must use melody-capable model
```

### Stable Audio-Specific Issues
```bash
# Generation too slow
--steps 50  # Reduce steps

# Results too random
--cfg-scale 10  # Increase CFG scale
--seed 42       # Use seed for consistency

# Quality issues
--steps 150     # Increase steps
--cfg-scale 7   # Adjust CFG scale
```

### Installation Issues
```bash
# Reinstall specific service
rm -rf python_env
npm run setup

# Check Python environment
python_env/bin/python -c "import audiocraft; import stable_audio_tools"

# Verify configuration
cat .music-config.json
```

## Configuration

The `.music-config.json` file stores settings for both services:
```json
{
  "python": "python_env/bin/python",
  "venv": "python_env",
  "audiocraft": {
    "default_model": "facebook/musicgen-small",
    "cache_dir": "models/audiocraft"
  },
  "stable_audio": {
    "default_model": "stabilityai/stable-audio-open-1.0",
    "cache_dir": "models/stable-audio"
  }
}
```

## Model Management

### Download Models
```bash
# Download AudioCraft model
npm run as -- music download facebook/musicgen-large

# Download Stable Audio model  
npm run as -- music download stabilityai/stable-audio-open-1.0
```

### List Available Models
```bash
# List all models
npm run as -- music list

# List service-specific models
npm run as -- music list --service audiocraft
npm run as -- music list --service stable-audio
```

## Best Practices

1. **Choose the Right Service**:
   - Use AudioCraft for: Quick generation, melody conditioning, audio continuation
   - Use Stable Audio for: High-quality stereo, reproducible results, longer pieces

2. **Optimize for Speed**:
   - AudioCraft: Use smaller models (`musicgen-small`)
   - Stable Audio: Reduce steps (50-75)

3. **Optimize for Quality**:
   - AudioCraft: Use larger models (`musicgen-large`)
   - Stable Audio: Increase steps (150-200)

4. **Experiment with Parameters**:
   - Start with defaults
   - Adjust one parameter at a time
   - Save successful configurations

5. **Prompt Iteration**:
   - Start simple, add details gradually
   - Test prompts with fast settings first
   - Refine based on results