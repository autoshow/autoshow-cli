# Google Veo Video Generation

Text-to-video generation with Google's Veo models, including audio support.

## Setup

Add to `.env`:
```
GEMINI_API_KEY=your_api_key_here
```

## Models

- `veo-3.0-generate-preview` - Latest with native audio generation
- `veo-3.0-fast-generate-preview` - Faster generation, audio support
- `veo-2.0-generate-001` - Stable version, supports portrait mode

## Basic Usage

```bash
# Standard generation
npm run as -- video generate \
  --prompt "A butterfly landing on a flower" \
  --model veo-3.0-generate-preview

# With audio description (Veo 3.0)
npm run as -- video generate \
  --prompt "Ocean waves crashing. Sound of seagulls and wind." \
  --model veo-3.0-generate-preview
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--prompt` | Video and audio description | Required |
| `--model` | Veo model version | veo-3.0-generate-preview |
| `--negative` | What to exclude | None |
| `--aspect-ratio` | 16:9 or 9:16 (v2.0 only) | 16:9 |
| `--person` | Person generation mode | Varies by region |
| `--output` | Output path | Auto-generated |

## Examples

```bash
# With dialogue (Veo 3.0)
npm run as -- video generate \
  --prompt "'Hello!' she says cheerfully. Birds chirping." \
  --model veo-3.0-generate-preview

# Exclude elements
npm run as -- video generate \
  --prompt "Mountain landscape at sunrise" \
  --negative "people, buildings, text" \
  --model veo-3.0-fast-generate-preview

# Portrait mode (Veo 2.0 only)
npm run as -- video generate \
  --prompt "Fashion model on runway" \
  --model veo-2.0-generate-001 \
  --aspect-ratio 9:16

# Fast generation
npm run as -- video generate \
  --prompt "City traffic timelapse" \
  --model veo-3.0-fast-generate-preview
```

## Audio Prompting (Veo 3.0)

Include sound descriptions and dialogue in quotes:

```bash
npm run as -- video generate \
  --prompt "Two scientists in a lab. 'Eureka!' one shouts. Equipment beeping, electricity crackling." \
  --model veo-3.0-generate-preview
```

## Person Generation Modes

Control how people appear in videos:
- `allow_all` - No restrictions
- `allow_adult` - Adults only
- `dont_allow` - No people

```bash
npm run as -- video generate \
  --prompt "Busy street scene" \
  --person allow_adult \
  --model veo-3.0-generate-preview
```