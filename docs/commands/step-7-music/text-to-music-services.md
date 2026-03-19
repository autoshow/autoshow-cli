# music

Generate music from a text prompt.

## Outline

- [Usage](#usage)
- [Providers](#providers)
- [Shared flags](#shared-flags)
- [Examples](#examples)
  - [ElevenLabs](#elevenlabs)
  - [MiniMax](#minimax)
  - [Music generation in the write pipeline](#music-generation-in-the-write-pipeline)
- [Output](#output)
  - [metadata.json schema](#metadatajson-schema)
- [Notes](#notes)

## Usage

```bash
bun as music <prompt> [flags]
```

## Providers

Two music generation providers are supported:

| Provider | Flag | Models | Notes |
|----------|------|--------|-------|
| **ElevenLabs Music** | `--elevenlabs-music <model>` | `music_v1` | Returns binary audio directly |
| **MiniMax Music** | `--minimax-music <model>` | `music-2.5` | Requires lyrics; auto-generates lyrics when `--music-lyrics-file` is omitted |

Exactly one provider flag must be set.

## Shared flags

| Flag | Description |
|------|-------------|
| `--music-duration <seconds>` | Requested duration in seconds (applies to ElevenLabs) |
| `--music-lyrics-file <path>` | Lyrics file for MiniMax music generation |
| `--music-instrumental` | Force instrumental generation (ElevenLabs prompt mode) |
| `--price` | Show cost estimate and exit |

## Examples

### ElevenLabs

```bash
# Basic generation
bun as music "cinematic orchestral trailer, dramatic strings and percussion" --elevenlabs-music music_v1

# Instrumental generation with explicit duration
bun as music "lo-fi chillhop with soft piano and vinyl texture" --elevenlabs-music music_v1 --music-duration 20 --music-instrumental

# Pricing preflight
bun as music "lo-fi chillhop with soft piano and vinyl texture" --elevenlabs-music music_v1 --price
```

### MiniMax

```bash
# Auto-generate lyrics, then generate music
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5

# Use provided lyrics file
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5 --music-lyrics-file input/1-tts.md

# Pricing preflight
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5 --price
```

### Music generation in the write pipeline

Music generation runs after LLM output, in parallel with TTS/image/video when enabled.

```bash
# Generate summary + music
bun as write input/1-audio.mp3 --openai gpt-5.2 --elevenlabs-music music_v1 --music-duration 20

# Generate summary + MiniMax music with provided lyrics
bun as write input/1-audio.mp3 --minimax-music music-2.5 --music-lyrics-file input/1-tts.md

# Preflight write + music cost
bun as write input/1-audio.mp3 --minimax-music music-2.5 --price
```

## Output

Each standalone `music` run writes to a timestamped output directory:

```text
output/YYYY-MM-DD_HH-mm-ss_music-gen/
  generated-music.mp3
  metadata.json
```

### metadata.json schema

```json
{
  "music": {
    "musicService": "minimax",
    "musicModel": "music-2.5",
    "processingTime": 31234,
    "musicFileName": "generated-music.mp3",
    "musicFileSize": 813651,
    "musicDurationMs": 25364,
    "lyricsSource": "generated"
  }
}
```

When run through `write`, metadata is stored under `step7`.

## Notes

- Exactly one music provider must be selected.
- MiniMax requires lyrics input. If `--music-lyrics-file` is not provided, lyrics are generated via MiniMax lyrics API.
- ElevenLabs `--price` uses explicit `--music-duration` when provided, otherwise defaults to 180 seconds for estimate calculation.
- MiniMax `--price` includes fixed song generation pricing and the lyrics add-on when lyrics are auto-generated.
- Setup and environment variable details are centralized in [`setup.md`](../step-0-setup/setup.md).
