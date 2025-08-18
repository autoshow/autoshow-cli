# Music Generation Command

Generate AI-composed music using Meta's AudioCraft MusicGen models. Create original music from text descriptions, condition on melodies, or continue existing audio.

## Overview

The music command leverages Meta's MusicGen models to generate high-quality music from text prompts. MusicGen is a single-stage auto-regressive Transformer model that generates music at 32kHz, offering various model sizes and capabilities including melody conditioning and stereo generation.

## Installation

The music generation feature is installed automatically during setup:

```bash
npm run setup
```

This will:
- Install AudioCraft and dependencies
- Download the default `facebook/musicgen-small` model
- Configure the Python environment

## Basic Usage

### Generate Music from Text
```bash
# Simple generation with default settings
npm run as -- music generate --prompt "upbeat electronic dance music with heavy bass"

# Specify output file
npm run as -- music generate --prompt "calm piano melody" --output my-piano-piece.wav

# Longer duration (up to 30 seconds)
npm run as -- music generate --prompt "epic orchestral soundtrack" --duration 30
```

### Using Different Models
```bash
# Fast generation with small model (default)
npm run as -- music generate --prompt "jazz fusion" --model facebook/musicgen-small

# Better quality with medium model
npm run as -- music generate --prompt "classical symphony" --model facebook/musicgen-medium

# Highest quality with large model (requires more memory)
npm run as -- music generate --prompt "prog rock anthem" --model facebook/musicgen-large

# Stereo generation
npm run as -- music generate --prompt "ambient soundscape" --model facebook/musicgen-stereo-medium
```

### Melody Conditioning
Generate music that follows a provided melody:
```bash
# Provide a melody file (requires melody-capable model)
npm run as -- music generate \
  --prompt "jazz arrangement" \
  --melody input/melody.wav \
  --model facebook/musicgen-melody

# With large melody model for best quality
npm run as -- music generate \
  --prompt "orchestral version" \
  --melody input/theme.mp3 \
  --model facebook/musicgen-melody-large
```

### Audio Continuation
Continue generating music from an existing audio file:
```bash
# Continue from where an audio file ends
npm run as -- music generate \
  --prompt "energetic rock solo" \
  --continuation input/intro.wav \
  --duration 15
```

## Available Models

### List All Models
```bash
npm run as -- music list
```

### Model Comparison

| Model | Size | Parameters | Features | Use Case |
|-------|------|------------|----------|----------|
| `facebook/musicgen-small` | Small | 300M | Text-to-music | Fast generation, lower quality |
| `facebook/musicgen-medium` | Medium | 1.5B | Text-to-music | Balanced speed and quality |
| `facebook/musicgen-large` | Large | 3.3B | Text-to-music | Best quality, slower |
| `facebook/musicgen-melody` | Medium | 1.5B | Text + melody conditioning | Follow provided melodies |
| `facebook/musicgen-melody-large` | Large | 3.3B | Text + melody conditioning | Best melody following |
| `facebook/musicgen-stereo-small` | Small | 300M | Stereo output | Fast stereo generation |
| `facebook/musicgen-stereo-medium` | Medium | 1.5B | Stereo output | Balanced stereo quality |
| `facebook/musicgen-stereo-large` | Large | 3.3B | Stereo output | Best stereo quality |
| `facebook/musicgen-stereo-melody` | Medium | 1.5B | Stereo + melody | Stereo with melody control |
| `facebook/musicgen-stereo-melody-large` | Large | 3.3B | Stereo + melody | Best stereo melody following |

### Download Models
Models are downloaded automatically on first use, or you can pre-download:
```bash
# Download a specific model
npm run as -- music download facebook/musicgen-medium

# Download large model for best quality
npm run as -- music download facebook/musicgen-large
```

## Generation Parameters

### Temperature (Creativity Control)
Controls randomness in generation. Higher = more creative, lower = more predictable.
```bash
# Very creative/experimental (high temperature)
npm run as -- music generate --prompt "experimental jazz" --temperature 1.5

# More predictable/conservative (low temperature)
npm run as -- music generate --prompt "classical waltz" --temperature 0.6

# Default is 1.0
```

### Top-K Sampling
Limits the number of token choices at each step.
```bash
# More focused generation (lower k)
npm run as -- music generate --prompt "minimal techno" --top-k 50

# More variety (higher k)
npm run as -- music generate --prompt "world music fusion" --top-k 500

# Default is 250
```

### Top-P (Nucleus Sampling)
Cumulative probability threshold for token selection.
```bash
# Enable nucleus sampling
npm run as -- music generate --prompt "indie rock" --top-p 0.9

# Default is 0.0 (disabled)
```

### Classifier-Free Guidance
Controls how closely the model follows the prompt.
```bash
# Stronger prompt adherence
npm run as -- music generate --prompt "death metal" --cfg-coef 5.0

# More creative interpretation
npm run as -- music generate --prompt "folk ballad" --cfg-coef 1.5

# Default is 3.0
```

### Other Parameters
```bash
# Disable sampling (use greedy decoding)
npm run as -- music generate --prompt "techno beat" --no-sampling

# Use two-step classifier-free guidance
npm run as -- music generate --prompt "symphony" --two-step-cfg

# Adjust continuation stride
npm run as -- music generate --prompt "jazz" --extend-stride 20
```

## Advanced Examples

### Complex Prompts
```bash
# Detailed musical description
npm run as -- music generate \
  --prompt "80s synthwave with analog synthesizers, driving bassline, retro drums, and nostalgic melodies" \
  --duration 20 \
  --model facebook/musicgen-medium

# Specific instrumentation
npm run as -- music generate \
  --prompt "acoustic guitar fingerpicking with violin accompaniment in the style of Celtic folk music" \
  --temperature 0.8

# Mood and tempo
npm run as -- music generate \
  --prompt "uplifting and energetic drum and bass at 174 bpm with liquid funk influences" \
  --duration 25
```

### Creating Variations
Generate multiple variations of the same prompt:
```bash
# Variation 1: Creative
npm run as -- music generate \
  --prompt "cinematic trailer music" \
  --temperature 1.3 \
  --output trailer-v1.wav

# Variation 2: Balanced
npm run as -- music generate \
  --prompt "cinematic trailer music" \
  --temperature 1.0 \
  --output trailer-v2.wav

# Variation 3: Conservative
npm run as -- music generate \
  --prompt "cinematic trailer music" \
  --temperature 0.7 \
  --output trailer-v3.wav
```

### Production Workflow
```bash
# 1. Generate initial idea
npm run as -- music generate \
  --prompt "chill lofi hip hop beat" \
  --duration 8 \
  --output lofi-intro.wav

# 2. Continue the piece
npm run as -- music generate \
  --prompt "add jazz piano solo" \
  --continuation lofi-intro.wav \
  --duration 16 \
  --output lofi-extended.wav

# 3. Create variation with melody
npm run as -- music generate \
  --prompt "same style but more upbeat" \
  --melody lofi-intro.wav \
  --model facebook/musicgen-melody \
  --output lofi-variation.wav
```

## Prompt Engineering Tips

### Effective Prompt Structure
1. **Genre/Style**: Start with the main genre
2. **Instruments**: Specify key instruments
3. **Mood/Emotion**: Describe the feeling
4. **Tempo/Energy**: Indicate pace and energy level
5. **Additional Details**: Add specific characteristics

### Good Prompt Examples
- ✅ "Funky disco with slap bass, wah-wah guitar, and four-on-the-floor drums"
- ✅ "Melancholic solo piano piece in the style of Erik Satie"
- ✅ "High-energy dubstep with heavy sub-bass drops and syncopated rhythms"
- ✅ "Medieval lute music with Renaissance polyphony"

### Prompt Styles That Work Well
- **Specific genres**: "deep house", "bebop jazz", "death metal"
- **Era descriptions**: "1970s funk", "90s grunge", "baroque period"
- **Mood descriptors**: "uplifting", "dark and mysterious", "playful"
- **Instrumentation**: "string quartet", "solo piano", "full orchestra"
- **Production styles**: "lo-fi", "heavily compressed", "analog warmth"

## Memory Requirements

| Model | VRAM Required | System RAM | Generation Speed |
|-------|---------------|------------|------------------|
| Small (300M) | ~2 GB | 4 GB | Fast (~5 sec for 8 sec audio) |
| Medium (1.5B) | ~6 GB | 8 GB | Medium (~15 sec for 8 sec audio) |
| Large (3.3B) | ~12 GB | 16 GB | Slow (~30 sec for 8 sec audio) |

**Note**: CPU-only generation is possible but significantly slower. Models automatically run on CPU if no GPU is available.

## Troubleshooting

### Out of Memory Errors
```bash
# Use smaller model
npm run as -- music generate --prompt "..." --model facebook/musicgen-small

# Reduce duration
npm run as -- music generate --prompt "..." --duration 5

# Clear GPU memory and retry
# On macOS: Restart the terminal
# On Linux: nvidia-smi and kill processes using GPU
```

### Model Download Issues
```bash
# Manually download a model
npm run as -- music download facebook/musicgen-medium

# Check available disk space (models are 1-15 GB each)
df -h models/audiocraft

# Clear cache and re-download
rm -rf models/audiocraft/facebook_musicgen-medium
npm run as -- music download facebook/musicgen-medium
```

### Audio Quality Issues
```bash
# Increase classifier-free guidance for better prompt adherence
--cfg-coef 4.0

# Use a larger model
--model facebook/musicgen-large

# Adjust temperature for more/less variation
--temperature 0.8
```

### Configuration File
The `.music-config.json` file is created automatically:
```json
{
  "python": "python_env/bin/python",
  "venv": "python_env",
  "audiocraft": {
    "default_model": "facebook/musicgen-small",
    "cache_dir": "models/audiocraft"
  }
}
```