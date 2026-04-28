# music

Generate music from a text prompt with hosted providers, or render local lyric videos from repo audio.

## Outline

- [Usage](#usage)
- [Modes](#modes)
- [Hosted Music Providers](#hosted-music-providers)
- [Flags](#flags)
- [Examples](#examples)
- [Environment](#environment)
- [Setup](#setup)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
bun as music <prompt-or-text-file> --elevenlabs-music <model>
bun as music <prompt-or-text-file> --minimax-music <model>
bun as music <prompt-or-text-file> --deapi-music <model>
bun as music --audio input/<file>
bun as music --audio input/<file> --captions output/<run-dir>/<stem>.vtt
bun as music --batch
```

## Modes

`music` has two mutually exclusive modes:

| Mode | Required input | Description |
|------|----------------|-------------|
| Hosted music generation | Prompt or `.md` / `.txt` file plus `--elevenlabs-music`, `--minimax-music`, `--deapi-music`, or `--all-music` | Calls hosted music APIs and writes audio files |
| Lyric-video rendering | `--audio <file>` or `--batch` | Uses local Whisper captions and ffmpeg rendering to write MP4/VTT/SRT outputs |

Do not mix hosted generation flags with lyric-video flags. `--price` is hosted-generation only.

## Hosted Music Providers

| Provider | Flag | Models | Notes |
|----------|------|--------|-------|
| ElevenLabs | `--elevenlabs-music <model>` | `music_v1` | returns audio directly |
| MiniMax | `--minimax-music <model>` | `music-2.5` | auto-generates lyrics when `--music-lyrics-file` is omitted |
| deAPI | `--deapi-music <model>` | `AceStep_1_5_Turbo`, `AceStep_1_5_Base`, `AceStep_1_5_XL_Turbo_INT8` | async ACE-Step jobs with provider quote pricing |

One or more provider flags can be specified. Repeating the same provider flag runs each selected model independently and produces its own output file.

## Flags

Hosted generation flags:

| Flag | Description |
|------|-------------|
| `--all-music` | Enable every supported hosted music provider/model |
| `--elevenlabs-music <model>` | Generate music with ElevenLabs |
| `--minimax-music <model>` | Generate music with MiniMax |
| `--deapi-music <model>` | Generate music with deAPI ACE-Step |
| `--music-duration <seconds>` | Requested duration in seconds; effective for ElevenLabs and deAPI, currently ignored by MiniMax |
| `--music-lyrics-file <path>` | Lyrics file for MiniMax and deAPI |
| `--music-instrumental` | Force instrumental generation for ElevenLabs and deAPI, currently ignored by MiniMax |
| `--price` | Show the estimate and exit |

Lyric-video flags:

| Flag | Description |
|------|-------------|
| `--batch` | Process every supported audio file under `./input` recursively |
| `--audio <file>` | Single-run audio file inside `./input` |
| `--captions <file>` | Edited `.vtt` or `.srt` file inside `./output`; skips Whisper and rerenders only |
| `--model <name>` | Local Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`; default `large-v3-turbo` |
| `--font <name>` | Font family for lyric overlays; default `DejaVu Sans` |
| `--keep-tmp` | Keep the per-run `.lyrics-tmp` workspace inside the output directory |

## Examples

```bash
# ElevenLabs
bun as music "cinematic orchestral trailer, dramatic strings and percussion" --elevenlabs-music music_v1
bun as music "lo-fi chillhop with soft piano and vinyl texture" --elevenlabs-music music_v1 --music-duration 20 --music-instrumental
bun as music "lo-fi chillhop with soft piano and vinyl texture" --elevenlabs-music music_v1 --price

# MiniMax
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5 --music-lyrics-file input/examples/tts/1-tts.md
bun as music "indie pop, nostalgic summer road trip vibe" --minimax-music music-2.5 --price

# deAPI
bun as music "uplifting synth pop, bright drums, summer chorus" --deapi-music AceStep_1_5_Turbo
bun as music "uplifting synth pop, bright drums, summer chorus" --deapi-music AceStep_1_5_Turbo --music-duration 20 --music-instrumental
bun as music "uplifting synth pop, bright drums, summer chorus" --deapi-music AceStep_1_5_Turbo --price

# Multiple providers at once
bun as music "chill lo-fi beat" --elevenlabs-music music_v1 --minimax-music music-2.5
bun as music "chill lo-fi beat" --elevenlabs-music music_v1 --minimax-music music-2.5 --price
bun as music "chill lo-fi beat" --elevenlabs-music music_v1 --minimax-music music-2.5 --deapi-music AceStep_1_5_Turbo

# Lyric-video rendering
bun as music --audio input/examples/lyrics/01-example-song.mp3
bun as music --audio input/examples/lyrics/01-example-song.mp3 --model small
bun as music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt
bun as music --audio input/examples/lyrics/01-example-song.mp3 --keep-tmp
bun as music --batch --model tiny

# Write pipeline
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --elevenlabs-music music_v1 --music-duration 20
bun as write input/examples/audio/1-audio.mp3 --minimax-music music-2.5 --music-lyrics-file input/examples/tts/1-tts.md
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --elevenlabs-music music_v1 --minimax-music music-2.5 --deapi-music AceStep_1_5_Turbo
bun as write input/examples/audio/1-audio.mp3 --minimax-music music-2.5 --price
```

## Environment

There are no local music-generation models in this project.

```bash
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
DEAPI_API_KEY=...
DEAPI_BASE_URL=https://api.deapi.ai
```

Lyric-video rendering uses local tools and does not require hosted API keys.

## Setup

```bash
bun as setup --step music
```

The music setup step checks hosted music API readiness and local lyric-video prerequisites:

- `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY`, and `DEAPI_API_KEY` status
- `ffmpeg` and `ffprobe`
- ffmpeg `ass` subtitle filter, or `pango-view` plus ImageMagick (`magick` or `convert`) for fallback overlays
- `whisper-cli`
- the local Whisper `large-v3-turbo` model

## Output

Hosted single-provider runs write:

```text
output/YYYY-MM-DD_HH-mm-ss_music-gen/
  generated-music.mp3
  run.json
```

Multi-provider runs write one file per provider:

```text
output/YYYY-MM-DD_HH-mm-ss_music-gen/
  generated-music-elevenlabs-music_v1.mp3
  generated-music-minimax-music-2.5.mp3
  generated-music-deapi-AceStep_1_5_Turbo.mp3
  run.json
```

`run.json` includes `music`, `cost`, and `timing` sections. `music` is always an array, even when only one provider succeeds.

Lyric-video single runs write:

```text
output/YYYY-MM-DD_HH-MM-SS-sss_music-lyrics-<stem>/
  <stem>.mp4
  <stem>.vtt
  <stem>.srt
  run.json
  .lyrics-tmp/          # only when --keep-tmp is set
```

Lyric-video batch runs write:

```text
output/YYYY-MM-DD_HH-MM-SS-sss_music-lyrics-batch/
  batch.json
  <slug>/
    <stem>.mp4
    <stem>.vtt
    <stem>.srt
    run.json
```

Lyric-video `run.json` uses `kind: "music"` and metadata `mode: "lyric-video"`. It records source audio, optional captions source, transcription mode and model, cue counts, render settings, artifact filenames, and timing metrics.

## Notes

- MiniMax auto-generates lyrics when `--music-lyrics-file` is omitted.
- ElevenLabs price estimation uses the explicit `--music-duration` when provided; otherwise it falls back to `180` seconds.
- MiniMax price estimation includes the extra lyrics-generation cost when lyrics are auto-generated.
- deAPI sends `[Instrumental]` when `--music-instrumental` is set or no lyrics file is provided. Turbo models accept 10-300 seconds, and `AceStep_1_5_Base` accepts 30-300 seconds.
- deAPI music price estimates use the provider quote endpoint when `DEAPI_API_KEY` is available; otherwise the local registry reports a zero-cost fallback note.
- In lyric-video rerender mode, the output stem comes from the caption filename, not the audio filename.
- If an image beside the lyric-video audio file matches by exact basename or track number, it is used as the background; otherwise a spectrogram background is rendered.
