# music

Generate music from a text prompt with hosted providers, or render local lyric videos from repo audio.

## Outline

- [Usage](#usage)
- [Modes](#modes)
- [Environment](#environment)
- [Setup](#setup)
- [Shared Music Options](#shared-music-options)
- [Music Services And Modes](#music-services-and-modes)
  - [ElevenLabs](#elevenlabs)
  - [MiniMax](#minimax)
  - [Gemini](#gemini)
  - [Lyric-Video Rendering](#lyric-video-rendering)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
bun as music <prompt-or-text-file> --provider elevenlabs[=<model>]
bun as music <prompt-or-text-file> --provider minimax[=<model>]
bun as music <prompt-or-text-file> --provider gemini[=<model>]
bun as music --audio input/<file>
bun as music --audio input/<file> --captions output/<run-dir>/<stem>.vtt
bun as music --batch
```

## Modes

`music` has two mutually exclusive modes:

| Mode | Required input | Description |
|------|----------------|-------------|
| Lyric-video rendering | `--audio <file>` or `--batch` | Uses local Whisper captions and ffmpeg rendering to write MP4/VTT/SRT outputs |

Do not mix hosted generation flags with lyric-video flags. `--price` is hosted-generation only.

## Environment

There are no local music-generation models in this project.

```bash
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
GEMINI_API_KEY=...
```

Lyric-video rendering uses local tools and does not require hosted API keys.

## Setup

```bash
bun as setup --step music
```

The music setup step checks hosted music API readiness and local lyric-video prerequisites:

- `ffmpeg` and `ffprobe`
- ffmpeg `ass` subtitle filter, or `pango-view` plus ImageMagick `convert` for fallback overlays
- `whisper-cli`
- the local Whisper `large-v3-turbo` model

## Shared Music Options

Hosted generation flags:

| Flag | Description |
|------|-------------|
| `--provider provider[=model]` | Hosted music provider/model selector; repeat to run multiple targets |
| `--all-providers` | Enable every supported hosted music provider/model |
| `--provider-concurrency <n>` | Hosted music providers/models to run concurrently per item; default `2`, or up to `8` for `--all-providers` |
| `--local-concurrency <n>` | Local music providers to run concurrently per item; default `1` |
| `--duration <seconds>` | Requested music duration |
| `--lyrics-file <path>` | Lyrics file path (`.md` or `.txt`) for MiniMax and Gemini music generation |
| `--instrumental` | Force instrumental generation for providers that support prompt/instrumental mode |
| `--price` | Show the estimate and exit |
| `--output-dir <dir>` | Use an exact hosted music run directory instead of `output/<timestamp>_music-gen/` |

Lyric-video flags:

| Flag | Description |
|------|-------------|
| `--batch` | Process every supported audio file under `input` recursively |
| `--audio <file>` | Single-run audio file inside `input` |
| `--captions <file>` | Edited `.vtt` or `.srt` file inside `./output`; skips Whisper and rerenders only |
| `--model <name>` | Local Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`; default `large-v3-turbo` |
| `--font <name>` | Font family for lyric overlays; default `DejaVu Sans` |
| `--keep-tmp` | Keep the per-run `.lyrics-tmp` workspace inside the output directory |

One or more hosted provider selectors can be specified. Repeating the same provider runs each selected model independently and produces its own output file.

```bash
bun as music "chill lo-fi beat" --provider elevenlabs=music_v1 --provider minimax=music-2.6
bun as music "chill lo-fi beat" --provider elevenlabs=music_v1 --provider minimax=music-2.6 --price
```

## Music Services And Modes

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--provider elevenlabs[=<model>]` |
| Models | `music_v1` |
| Duration | `--duration <seconds>`; defaults to 180 seconds for estimates when omitted |
| Instrumental | `--instrumental` |

```bash
bun as music "cinematic orchestral trailer, dramatic strings and percussion" --provider elevenlabs=music_v1
bun as music "lo-fi chillhop with soft piano and vinyl texture" --provider elevenlabs=music_v1 --duration 20 --instrumental
bun as music "lo-fi chillhop with soft piano and vinyl texture" --provider elevenlabs=music_v1 --price
```

ElevenLabs returns audio directly. Price estimation uses the explicit `--duration` when provided; otherwise it falls back to `180` seconds.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--provider minimax[=<model>]` |
| Models | `music-2.6`, `music-2.6-free` |
| Lyrics | `--lyrics-file <path>`; lyrics are auto-generated when omitted |
| Instrumental | `--instrumental` for `music-2.6` and `music-2.6-free` |

```bash
bun as music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-2.6
bun as music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-2.6 --lyrics-file input/examples/tts/1-tts.md
bun as music "ambient piano instrumental with soft tape saturation" --provider minimax=music-2.6 --instrumental
bun as music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-2.6 --price
```

MiniMax auto-generates lyrics when `--lyrics-file` is omitted. Price estimation includes the extra lyrics-generation cost when lyrics are auto-generated; `music-2.6-free` has a 0 cent track estimate but still carries the 1 cent lyrics add-on when lyrics are generated. `music-2.6` and `music-2.6-free` support instrumental mode; when instrumental mode is omitted, they generate with lyrics or auto-generated lyrics. `--duration` is currently ignored by MiniMax.

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `lyria-3-clip-preview`, `lyria-3-pro-preview` |
| Duration | Gemini Clip is fixed at 30 seconds; Gemini Pro uses `--duration` when provided |
| Lyrics/instrumental | `--lyrics-file <path>` or `--instrumental` |

```bash
bun as music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-clip-preview
bun as music "cinematic synth pop with verses, chorus, and bridge" --provider gemini=lyria-3-pro-preview --duration 120
bun as music input/examples/tts/1-tts.md --provider gemini=lyria-3-pro-preview --lyrics-file input/examples/tts/1-tts.md
bun as music "ambient piano and strings" --provider gemini=lyria-3-clip-preview --price
```

Gemini Lyria 3 Clip always generates a 30-second MP3 clip. Lyria 3 Pro uses duration instructions from `--duration`, or a 120-second timing estimate when omitted. `--lyrics-file` appends lyrics to the prompt. If `--instrumental` is also set, instrumental wins and the lyrics file is ignored with a warning.

### Lyric-Video Rendering

| Option | Value |
|--------|-------|
| Single audio | `--audio <file>` inside `input` |
| Rerender | `--captions <file>` inside `./output` |
| Batch | `--batch` |
| Whisper model | `--model tiny\|base\|small\|medium\|large-v3-turbo`, default `large-v3-turbo` |
| Overlay | `--font <name>` |
| Debug artifacts | `--keep-tmp` |

```bash
bun as music --audio input/examples/lyrics/01-example-song.mp3
bun as music --audio input/examples/lyrics/01-example-song.mp3 --model small
bun as music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt
bun as music --audio input/examples/lyrics/01-example-song.mp3 --keep-tmp
bun as music --batch --model tiny
```

Lyric-video rendering uses local Whisper captions and ffmpeg rendering. In rerender mode, the output stem comes from the caption filename, not the audio filename. If an image beside the lyric-video audio file matches by exact basename or track number, it is used as the background; otherwise a spectrogram background is rendered.

```bash
# Write pipeline
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.4 --music elevenlabs=music_v1 --music-duration 20
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --music minimax=music-2.6 --music-lyrics-file input/examples/tts/1-tts.md
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.4 --music gemini=lyria-3-pro-preview --music-duration 120
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --music minimax=music-2.6 --price
```

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
  generated-music-minimax-music-2.6.mp3
  generated-music-gemini-lyria-3-clip-preview.mp3
  run.json
```

`run.json` includes `music`, `cost`, and `timing` sections. `music` is always an array, even when only one provider succeeds.

For hosted music generation, `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.

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

- Do not mix hosted generation flags with lyric-video flags.
- `--price` is hosted-generation only.
