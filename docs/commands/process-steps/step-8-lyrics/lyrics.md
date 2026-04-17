# lyrics

Create a lyric video from repo-local audio using the project's Whisper runtime and fixed 1920x1080 / 30fps rendering defaults.

## Outline

- [Usage](#usage)
- [Flags](#flags)
- [Examples](#examples)
- [Setup](#setup)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
# single file (audio must be inside ./input)
# bundled example fixtures: input/examples/lyrics/01-example-song.wav,
# input/examples/lyrics/01-cover.jpeg, input/examples/lyrics/01-example-song.txt
bun as lyrics --audio input/examples/lyrics/01-example-song.wav

# rerender from edited captions after the first run (caption file must be inside ./output)
bun as lyrics --audio input/examples/lyrics/01-example-song.wav --captions output/<run-dir>/01-example-song.vtt

# batch mode (scan ./input recursively for supported audio files)
bun as lyrics --batch
```

## Flags

| Flag | Description |
|------|-------------|
| `--batch` | Process every supported audio file under `./input` recursively |
| `--audio <file>` | Single-run audio file inside `./input` |
| `--captions <file>` | Optional edited `.vtt` or `.srt` file inside `./output`; skips Whisper and rerenders only |
| `--model <name>` | Local Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| `--font <name>` | Font family for lyric overlays; defaults to `DejaVu Sans` |
| `--keep-tmp` | Keep the per-run `.lyrics-tmp` workspace inside the output directory |

Removed legacy flags:

- `--out`
- `--res`
- `--fps`
- `--tmp`

Those are fixed by this command: outputs always go to autoshow run directories under `./output`, rendering is always `1920x1080` at `30fps`, and temp files stay inside each run directory.

## Examples

```bash
# default local Whisper render with the bundled lyrics fixture set
bun as lyrics --audio input/examples/lyrics/01-example-song.wav

# smaller local Whisper model
bun as lyrics --audio input/examples/lyrics/01-example-song.wav --model small

# rerender after editing the generated captions from the example run
bun as lyrics --audio input/examples/lyrics/01-example-song.wav --captions output/<run-dir>/01-example-song.vtt

# keep the temp workspace for inspection
bun as lyrics --audio input/examples/lyrics/01-example-song.wav --keep-tmp

# batch mode
bun as lyrics --batch --model tiny
```

## Setup

```bash
bun as setup --step lyrics
```

`lyrics` reuses the repo Whisper runtime. The setup step verifies `ffmpeg` and `ffprobe`, ensures `whisper-cli`, downloads `large-v3-turbo`, and confirms that either:

- ffmpeg exposes the `ass` subtitle filter, or
- `pango-view` plus ImageMagick (`magick` or `convert`) are available for the fallback overlay renderer

## Output

Single runs write one timestamped output directory:

```text
output/YYYY-MM-DD_HH-MM-SS-sss_lyrics-<stem>/
  <stem>.mp4
  <stem>.vtt
  <stem>.srt
  run.json
  .lyrics-tmp/          # only when --keep-tmp is set
```

Batch runs write a batch root plus one child run per discovered audio file:

```text
output/YYYY-MM-DD_HH-MM-SS-sss_lyrics-batch/
  batch.json
  001-<slug>/
    <stem>.mp4
    <stem>.vtt
    <stem>.srt
    run.json
```

`run.json` records:

- source audio path
- optional captions source path
- transcription mode and Whisper model/descriptor
- cue counts and cue source
- render settings such as font, encoder, size, fps, and background mode
- artifact filenames and timing metrics

## Notes

- `lyrics` is local-only and does not support `--price`.
- In rerender mode, the output stem comes from the caption filename, not the audio filename.
- The title displayed in the video comes from the audio filename.
- The bundled example run uses `input/examples/lyrics/01-example-song.wav`; `input/examples/lyrics/01-cover.jpeg` is auto-detected as background art, and `input/examples/lyrics/01-example-song.txt` mirrors the reference lyrics text for caption review.
- If an image beside the audio file matches by exact basename or track number, it is used as the background; otherwise a spectrogram background is rendered.
- When ffmpeg lacks the `ass` subtitle filter, AutoShow falls back to image-based text overlays rendered with `pango-view` plus ImageMagick and still writes the same MP4/VTT/SRT outputs.
