# Music Generation Command

Generate AI-composed music using Meta's AudioCraft MusicGen models or Stability AI's Stable Audio diffusion models.

## Quick Start

```bash
npm run as -- music generate --prompt "upbeat electronic dance music"

npm run as -- music generate --prompt "calm piano melody" --service audiocraft

npm run as -- music generate --prompt "ambient electronic" --service stable-audio

npm run as -- music generate --prompt "jazz fusion" --duration 30
```

## Available Services

- **AudioCraft** (`audiocraft`) - Meta's MusicGen auto-regressive models
- **Stable Audio** (`stable-audio`) - Stability AI's latent diffusion models

## Basic Options

```bash
--prompt <text>       Required. Text description of music
--output <path>       Output file path (default: auto-generated)
--service <service>   audiocraft or stable-audio (default: audiocraft)
--duration <seconds>  Duration in seconds (default: 8)
--model <model>       Model to use (service-specific)
```

## List Available Models

```bash
npm run as -- music list

npm run as -- music list --service audiocraft

npm run as -- music list --service stable-audio
```

## Configuration

The music generation features use a shared Python environment installed during setup:
```bash
npm run setup
```

Configuration is stored in `build/config/.music-config.json`.

## Service Documentation

- [AudioCraft Options](./02-audiocraft-options.md)
- [Stable Audio Options](./03-stable-audio-options.md)

## Service Comparison

| Feature | AudioCraft | Stable Audio |
|---------|------------|--------------|
| Architecture | Auto-regressive | Latent Diffusion |
| Max Duration | 30 seconds | 45+ seconds |
| Sample Rate | 32kHz | 44.1kHz |
| Melody Conditioning | Yes | No |
| Audio Continuation | Yes | No |
| Reproducibility | Limited | Full (with seed) |