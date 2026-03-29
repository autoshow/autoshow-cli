# music

Generate music from a text prompt with one of the hosted music providers.

## Outline

- [Usage](#usage)
- [Providers](#providers)
- [Shared Flags](#shared-flags)
- [Examples](#examples)
- [Environment](#environment)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
bun as music <prompt> [flags]
```

## Providers

| Provider | Flag | Models | Notes |
|----------|------|--------|-------|
| ElevenLabs | `--elevenlabs-music <model>` | `music_v1` | returns audio directly |
| MiniMax | `--minimax-music <model>` | `music-2.5` | auto-generates lyrics when `--music-lyrics-file` is omitted |

One or more provider flags can be specified. When both are given, each runs independently and produces its own output file.

## Shared Flags

| Flag | Description |
|------|-------------|
| `--music-duration <seconds>` | Requested duration in seconds; effective for ElevenLabs, currently ignored by MiniMax |
| `--music-lyrics-file <path>` | Lyrics file for MiniMax |
| `--music-instrumental` | Force instrumental generation for ElevenLabs; currently ignored by MiniMax |
| `--price` | Show the estimate and exit |

## Examples

```bash
# ElevenLabs
bun as music "cinematic orchestral trailer, dramatic strings and percussion" --elevenlabs-music music_v1
bun as music "lo-fi chillhop with soft piano and vinyl texture" --elevenlabs-music music_v1 --music-duration 20 --music-instrumental
bun as music "lo-fi chillhop with soft piano and vinyl texture" --elevenlabs-music music_v1 --price

# MiniMax
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5 --music-lyrics-file input/1-tts.md
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5 --price

# Both providers at once
bun as music "chill lo-fi beat" --elevenlabs-music music_v1 --minimax-music music-2.5
bun as music "chill lo-fi beat" --elevenlabs-music music_v1 --minimax-music music-2.5 --price

# Write pipeline
bun as write input/1-audio.mp3 --openai gpt-5.2 --elevenlabs-music music_v1 --music-duration 20
bun as write input/1-audio.mp3 --minimax-music music-2.5 --music-lyrics-file input/1-tts.md
bun as write input/1-audio.mp3 --openai gpt-5.2 --elevenlabs-music music_v1 --minimax-music music-2.5
bun as write input/1-audio.mp3 --minimax-music music-2.5 --price
```

## Environment

There are no local music-generation models in this project.

```bash
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
```

## Output

Single-provider runs write:

```text
output/YYYY-MM-DD_HH-mm-ss_music-gen/
  generated-music.mp3
  metadata.json
```

Multi-provider runs write one file per provider:

```text
output/YYYY-MM-DD_HH-mm-ss_music-gen/
  generated-music-elevenlabs-music_v1.mp3
  generated-music-minimax-music-2.5.mp3
  metadata.json
```

`metadata.json` includes `music` (a single object for one provider, an array for multiple), `cost`, and `timing` sections.

## Notes

- MiniMax auto-generates lyrics when `--music-lyrics-file` is omitted.
- ElevenLabs price estimation uses the explicit `--music-duration` when provided; otherwise it falls back to `180` seconds.
- MiniMax price estimation includes the extra lyrics-generation cost when lyrics are auto-generated.
