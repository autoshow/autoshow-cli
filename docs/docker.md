# Docker Guide for AutoShow CLI

This guide covers building and running AutoShow CLI in a Docker container, providing a consistent environment with all dependencies pre-configured.

## Quick Start

### Build the Image

```bash
docker build -t autoshow-cli .
```

### Run with Help

```bash
docker run --rm autoshow-cli --help
```

## Volume Mounts

AutoShow CLI requires volume mounts for input files, output files, and models:

```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  autoshow-cli [command]
```

### Volume Directories

- `/app/input` - Place your media files, PDFs, and markdown files here
- `/app/output` - Generated content will be saved here
- `/app/models` - Whisper models, TTS models, and music models are stored here
  - `/app/models/audiocraft` - AudioCraft MusicGen models cache
  - `/app/models/stable-audio` - Stable Audio models cache

## Environment Variables

### Using .env File

```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  --env-file .env \
  autoshow-cli [command]
```

### Passing Individual Variables

```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  -e OPENAI_API_KEY=your_key \
  -e DEEPGRAM_API_KEY=your_key \
  -e HF_TOKEN=your_huggingface_token \
  autoshow-cli [command]
```

### Music Generation Variables

For accessing gated music models:

```bash
docker run --rm -it \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  -e HF_TOKEN=your_huggingface_token \
  autoshow-cli music generate --prompt "upbeat electronic music"
```

## Common Commands

### Text Processing

Process a YouTube video:
```bash
docker run --rm -it \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  --env-file .env \
  autoshow-cli text --video "https://www.youtube.com/watch?v=MORMZXEaONk"
```

Process a local file:
```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  --env-file .env \
  autoshow-cli text --file input/audio.mp3
```

Process an RSS feed:
```bash
docker run --rm -it \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  --env-file .env \
  autoshow-cli text --rss "https://podcast.rss/feed"
```

### Text-to-Speech

Generate speech from markdown:
```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  --env-file .env \
  autoshow-cli tts file input/sample.md
```

Generate conversation from JSON script:
```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  --env-file .env \
  autoshow-cli tts script input/script.json
```

### Music Generation

#### AudioCraft MusicGen

Generate music with AudioCraft (default):
```bash
docker run --rm -it \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  autoshow-cli music generate --prompt "upbeat electronic dance music with heavy bass"
```

With specific model and parameters:
```bash
docker run --rm -it \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  autoshow-cli music generate \
    --prompt "calm piano melody" \
    --service audiocraft \
    --model facebook/musicgen-medium \
    --duration 15 \
    --temperature 1.2
```

#### Stable Audio

Generate music with Stable Audio:
```bash
docker run --rm -it \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  -e HF_TOKEN=your_token \
  autoshow-cli music generate \
    --prompt "ambient electronic music" \
    --service stable-audio \
    --duration 20 \
    --steps 150 \
    --cfg-scale 9
```

#### Music Generation with Melody Conditioning (AudioCraft only)

```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  autoshow-cli music generate \
    --prompt "jazz arrangement" \
    --service audiocraft \
    --model facebook/musicgen-melody \
    --melody input/melody.wav
```

#### List Available Models

```bash
docker run --rm -it \
  -v $(pwd)/models:/app/models \
  autoshow-cli music list
```

### Image Generation

Generate with DALL-E:
```bash
docker run --rm -it \
  -v $(pwd)/output:/app/output \
  --env-file .env \
  autoshow-cli image generate -p "A futuristic city at sunset" -s dalle
```

Generate comparison across services:
```bash
docker run --rm -it \
  -v $(pwd)/output:/app/output \
  --env-file .env \
  autoshow-cli image compare "A mountain landscape"
```

### PDF Extraction

Extract text from PDF:
```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  --env-file .env \
  autoshow-cli extract pdf input/document.pdf
```

Batch process PDFs:
```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  --env-file .env \
  autoshow-cli extract batch input/pdfs
```

## Interactive Shell

Access the container shell for debugging:
```bash
docker run --rm -it \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/models:/app/models \
  --env-file .env \
  autoshow-cli bash
```

## Using npm Scripts

The package.json includes Docker helper scripts:

```bash
# Build the image
npm run docker:build

# Run with arguments
npm run docker:run -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk"

# Open shell
npm run docker:shell

# Text processing shortcuts
npm run docker:text -- --video "https://www.youtube.com/watch?v=MORMZXEaONk"
npm run docker:tts -- file input/sample.md
npm run docker:image -- generate -p "prompt"
npm run docker:extract -- pdf input/document.pdf

# Music generation shortcuts
npm run docker:run -- music generate --prompt "electronic music"
npm run docker:run -- music generate --prompt "jazz" --service stable-audio
npm run docker:run -- music list
```

## Troubleshooting

### Container Resource Requirements

Minimum recommended resources:

| Operation | RAM | Storage |
|-----------|-----|---------|
| Text processing | 2GB | 1GB |
| TTS generation | 4GB | 2GB |
| Music (AudioCraft small) | 4GB | 3GB |
| Music (AudioCraft large) | 16GB | 8GB |
| Music (Stable Audio) | 8GB | 5GB |
| Image generation | 2GB | 1GB |

### Volume Permissions

If you encounter permission issues:

```bash
# Fix ownership (Linux/macOS)
sudo chown -R $(id -u):$(id -g) ./models ./output

# Or run with user mapping
docker run --rm -it --user $(id -u):$(id -g) \
  -v $(pwd)/models:/app/models \
  -v $(pwd)/output:/app/output \
  autoshow-cli music generate --prompt "test"
```