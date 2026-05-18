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
  - [deAPI](#deapi)
  - [Gemini](#gemini)
  - [Lyric-Video Rendering](#lyric-video-rendering)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
bun as music <prompt-or-text-file> --elevenlabs <model>
bun as music <prompt-or-text-file> --minimax <model>
bun as music <prompt-or-text-file> --deapi <model>
bun as music <prompt-or-text-file> --gemini <model>
bun as music --audio input/<file>
bun as music --audio input/<file> --captions output/<run-dir>/<stem>.vtt
bun as music --batch
```

## Modes

`music` has two mutually exclusive modes:

| Mode | Required input | Description |
|------|----------------|-------------|
| Hosted music generation | Prompt or `.md` / `.txt` file plus `--elevenlabs`, `--minimax`, `--deapi`, `--gemini`, or `--all-music` | Calls hosted music APIs and writes audio files |
| Lyric-video rendering | `--audio <file>` or `--batch` | Uses local Whisper captions and ffmpeg rendering to write MP4/VTT/SRT outputs |

Do not mix hosted generation flags with lyric-video flags. `--price` is hosted-generation only.

## Environment

There are no local music-generation models in this project.

```bash
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
DEAPI_API_KEY=...
DEAPI_BASE_URL=https://api.deapi.ai
GEMINI_API_KEY=...
```

Lyric-video rendering uses local tools and does not require hosted API keys.

## Setup

```bash
bun as setup --step music
```

The music setup step checks hosted music API readiness and local lyric-video prerequisites:

- `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY`, and `DEAPI_API_KEY` status
- `ffmpeg` and `ffprobe`
- ffmpeg `ass` subtitle filter, or `pango-view` plus ImageMagick `convert` for fallback overlays
- `whisper-cli`
- the local Whisper `large-v3-turbo` model

## Shared Music Options

Hosted generation flags:

| Flag | Description |
|------|-------------|
| `--all-music` | Enable every supported hosted music provider/model |
| `--music-provider-concurrency <n>` | Hosted music providers/models to run concurrently per item; default `2`, or up to `8` for `--all-music` |
| `--music-local-concurrency <n>` | Local music providers to run concurrently per item; default `1` |
| `--music-duration <seconds>` | Requested duration in seconds; effective for ElevenLabs, deAPI, and Gemini Pro; Gemini Clip is fixed at 30 seconds; currently ignored by MiniMax |
| `--music-lyrics-file <path>` | Lyrics file for MiniMax, deAPI, and Gemini |
| `--music-instrumental` | Force instrumental generation for ElevenLabs, deAPI, Gemini, and MiniMax `music-2.6` / `music-2.6-free` |
| `--price` | Show the estimate and exit |
| `--out <dir>` / `--output-dir <dir>` | Use an exact hosted music run directory instead of `output/<timestamp>_music-gen/` |

Lyric-video flags:

| Flag | Description |
|------|-------------|
| `--batch` | Process every supported audio file under `input` recursively |
| `--audio <file>` | Single-run audio file inside `input` |
| `--captions <file>` | Edited `.vtt` or `.srt` file inside `./output`; skips Whisper and rerenders only |
| `--model <name>` | Local Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`; default `large-v3-turbo` |
| `--font <name>` | Font family for lyric overlays; default `DejaVu Sans` |
| `--keep-tmp` | Keep the per-run `.lyrics-tmp` workspace inside the output directory |

One or more hosted provider flags can be specified. Repeating the same provider flag runs each selected model independently and produces its own output file.

```bash
bun as music "chill lo-fi beat" --elevenlabs music_v1 --minimax music-2.6
bun as music "chill lo-fi beat" --elevenlabs music_v1 --minimax music-2.6 --price
bun as music "chill lo-fi beat" --elevenlabs music_v1 --minimax music-2.6 --deapi AceStep_1_5_Turbo --gemini lyria-3-clip-preview
```

## Music Services And Modes

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--elevenlabs <model>` |
| Models | `music_v1` |
| Duration | `--music-duration <seconds>`; defaults to 180 seconds for estimates when omitted |
| Instrumental | `--music-instrumental` |

```bash
bun as music "cinematic orchestral trailer, dramatic strings and percussion" --elevenlabs music_v1
bun as music "lo-fi chillhop with soft piano and vinyl texture" --elevenlabs music_v1 --music-duration 20 --music-instrumental
bun as music "lo-fi chillhop with soft piano and vinyl texture" --elevenlabs music_v1 --price
```

ElevenLabs returns audio directly. Price estimation uses the explicit `--music-duration` when provided; otherwise it falls back to `180` seconds.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--minimax <model>` |
| Models | `music-2.5`, `music-2.6`, `music-2.6-free` |
| Lyrics | `--music-lyrics-file <path>`; lyrics are auto-generated when omitted |
| Instrumental | `--music-instrumental` for `music-2.6` and `music-2.6-free` |

```bash
bun as music "indie pop, nostalgic summer road trip vibe" --minimax music-2.6
bun as music "indie pop, nostalgic summer road trip vibe" --minimax music-2.6 --music-lyrics-file input/examples/tts/1-tts.md
bun as music "ambient piano instrumental with soft tape saturation" --minimax music-2.6 --music-instrumental
bun as music "indie pop, nostalgic summer road trip vibe" --minimax music-2.6 --price
```

MiniMax auto-generates lyrics when `--music-lyrics-file` is omitted. Price estimation includes the extra lyrics-generation cost when lyrics are auto-generated; `music-2.6-free` has a 0 cent track estimate but still carries the 1 cent lyrics add-on when lyrics are generated. `music-2.6` and `music-2.6-free` support instrumental mode; `music-2.5` keeps generating with lyrics and warns when `--music-instrumental` is provided. `--music-duration` is currently ignored by MiniMax.

### deAPI

| Option | Value |
|--------|-------|
| Selector | `--deapi <model>` |
| Models | `AceStep_1_5_Turbo`, `AceStep_1_5_Base`, `AceStep_1_5_XL_Turbo_INT8` |
| Duration | `--music-duration <seconds>` |
| Lyrics/instrumental | `--music-lyrics-file <path>` or `--music-instrumental` |

```bash
bun as music "uplifting synth pop, bright drums, summer chorus" --deapi AceStep_1_5_Turbo
bun as music "uplifting synth pop, bright drums, summer chorus" --deapi AceStep_1_5_Turbo --music-duration 20 --music-instrumental
bun as music "uplifting synth pop, bright drums, summer chorus" --deapi AceStep_1_5_Turbo --price
```

deAPI uses async ACE-Step jobs with provider quote pricing. It sends `[Instrumental]` when `--music-instrumental` is set or no lyrics file is provided. Turbo models accept 10-300 seconds, and `AceStep_1_5_Base` accepts 30-300 seconds. deAPI music price estimates use the provider quote endpoint when `DEAPI_API_KEY` is available; otherwise the local registry reports a zero-cost fallback note.

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--gemini <model>` |
| Models | `lyria-3-clip-preview`, `lyria-3-pro-preview` |
| Duration | Gemini Clip is fixed at 30 seconds; Gemini Pro uses `--music-duration` when provided |
| Lyrics/instrumental | `--music-lyrics-file <path>` or `--music-instrumental` |

```bash
bun as music "bright 90s pop rock with a huge chorus" --gemini lyria-3-clip-preview
bun as music "cinematic synth pop with verses, chorus, and bridge" --gemini lyria-3-pro-preview --music-duration 120
bun as music input/examples/tts/1-tts.md --gemini lyria-3-pro-preview --music-lyrics-file input/examples/tts/1-tts.md
bun as music "ambient piano and strings" --gemini lyria-3-clip-preview --price
```

Gemini Lyria 3 Clip always generates a 30-second MP3 clip. Lyria 3 Pro uses duration instructions from `--music-duration`, or a 120-second timing estimate when omitted. `--music-lyrics-file` appends lyrics to the prompt. If `--music-instrumental` is also set, instrumental wins and the lyrics file is ignored with a warning.

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
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --elevenlabs-music music_v1 --music-duration 20
bun as write input/examples/audio/1-audio.mp3 --minimax-music music-2.6 --music-lyrics-file input/examples/tts/1-tts.md
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --gemini-music lyria-3-pro-preview --music-duration 120
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --elevenlabs-music music_v1 --minimax-music music-2.6 --deapi-music AceStep_1_5_Turbo --gemini-music lyria-3-clip-preview
bun as write input/examples/audio/1-audio.mp3 --minimax-music music-2.6 --price
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
  generated-music-deapi-AceStep_1_5_Turbo.mp3
  generated-music-gemini-lyria-3-clip-preview.mp3
  run.json
```

`run.json` includes `music`, `cost`, and `timing` sections. `music` is always an array, even when only one provider succeeds.

For hosted music generation, `--out` / `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.

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
