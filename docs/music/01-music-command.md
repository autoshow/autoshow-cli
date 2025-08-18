# Music Generation Command

Generate AI-powered instrumental music using Google's Lyria RealTime or AWS SageMaker MusicGen models.

## Basic Usage

```bash
npm run as -- music generate --prompt "A salsa jazz tune"

npm run as -- music generate --prompt "techno:1.0,ambient:0.5"

npm run as -- music generate --service sagemaker --prompt "80s pop track with bassy drums"

npm run as -- music generate --service sagemaker --sagemaker-model musicgen-medium --prompt "jazz fusion"
```

## Command Options

### Core Options
- `-p, --prompt <text>` - **Required**. Music generation prompt(s)
- `-s, --service <service>` - Music generation service: `lyria` or `sagemaker` (default: lyria)
- `-o, --output <path>` - Output file path (default: auto-generated in output/)
- `-d, --duration <seconds>` - Duration in seconds (default: 30)

### Musical Parameters (Lyria)
- `--bpm <number>` - Beats per minute (60-200)
- `--scale <scale>` - Musical scale (e.g., C_MAJOR_A_MINOR)
- `--guidance <number>` - How strictly to follow prompts (0.0-6.0, default: 4.0)
- `--density <number>` - Note density (0.0-1.0)
- `--brightness <number>` - Tonal brightness (0.0-1.0)
- `--mute-bass` - Reduce/remove bass frequencies
- `--mute-drums` - Reduce/remove drums
- `--only-bass-drums` - Generate only bass and drums

### Generation Settings
- `--mode <mode>` - Generation mode: QUALITY, DIVERSITY, or VOCALIZATION (default: QUALITY)
- `--temperature <number>` - Sampling temperature (0.0-3.0, default: 1.1)
- `--seed <number>` - Random seed for reproducibility

### SageMaker-Specific Options
- `--sagemaker-model <model>` - Model size: `musicgen-small`, `musicgen-medium`, or `musicgen-large` (default: musicgen-large)
- `--sagemaker-endpoint <name>` - Override SageMaker endpoint name from environment
- `--sagemaker-bucket <name>` - Override S3 bucket name from environment

## Other Commands

```bash
npm run as -- music check

npm run as -- music check --service sagemaker

npm run as -- music list-prompts

npm run as -- music list-prompts --service sagemaker
```

## Prompt Format

### Single Prompt
```bash
--prompt "minimal techno"
```

### Weighted Prompts (Lyria)
```bash
--prompt "jazz:1.0,ambient:0.5,piano:0.3"
```

### Descriptive Prompts (SageMaker)
```bash
--prompt "A cheerful country song with acoustic guitars"
```

## Usage Examples

```bash
npm run as -- music generate \
  --prompt "meditation,tibetan bowls,ambient:1.0,peaceful:0.8" \
  --duration 300 \
  --density 0.2 \
  --brightness 0.3

npm run as -- music generate \
  --service sagemaker \
  --prompt "Peaceful meditation music with tibetan bowls and ambient textures" \
  --duration 60 \
  --temperature 0.8

npm run as -- music generate \
  --prompt "techno:1.0,acid bass:0.5,303:0.3" \
  --bpm 128 \
  --density 0.8 \
  --mode QUALITY

npm run as -- music generate \
  --service sagemaker \
  --prompt "High energy techno track with acid bass and 303 synthesizer at 128 BPM" \
  --sagemaker-model musicgen-large \
  --guidance 3.5
```