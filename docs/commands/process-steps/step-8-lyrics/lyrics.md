# lyrics

Use `lyrics` in one of two modes:

- render mode: create a lyric video from repo-local audio using the project's Whisper runtime and fixed 1920x1080 / 30fps defaults
- generation mode: turn album text files into provider-rendered lyric drafts using the existing step-3 write / LLM integrations

## Outline

- [Usage](#usage)
- [Flags](#flags)
- [Examples](#examples)
- [Setup](#setup)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
# generation mode from ./albums/<name>
bun as lyrics album-title

# generation mode from an explicit directory with prompt.md + text/
bun as lyrics ./albums/demo 01-track --openai gpt-5.4 --prompt rockSong

# single file (audio must be inside ./input)
# bundled example fixtures: input/examples/lyrics/01-example-song.mp3,
# input/examples/lyrics/01-cover.jpeg, input/examples/lyrics/01-example-song.txt
bun as lyrics --audio input/examples/lyrics/01-example-song.mp3

# rerender from edited captions after the first run (caption file must be inside ./output)
bun as lyrics --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt

# batch mode (scan ./input recursively for supported audio files)
bun as lyrics --batch
```

## Flags

| Flag | Description |
|------|-------------|
| `--batch` | Render mode only: process every supported audio file under `./input` recursively |
| `--audio <file>` | Render mode only: single-run audio file inside `./input` |
| `--captions <file>` | Render mode only: edited `.vtt` or `.srt` file inside `./output`; skips Whisper and rerenders only |
| `--model <name>` | Render mode only: local Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| `--font <name>` | Render mode only: font family for lyric overlays; defaults to `DejaVu Sans` |
| `--keep-tmp` | Render mode only: keep the per-run `.lyrics-tmp` workspace inside the output directory |
| `--llama`, `--openai`, `--groq`, `--gemini`, `--anthropic`, `--minimax`, `--grok` | Generation mode only: select one or more LLM providers/models using the same integrations as `write` |
| `--prompt <name>` | Generation mode only: named prompt preset(s) from `src/prompts/entries/*.json` |
| `--prompt-file <file>` | Generation mode only: override the album `prompt.md` with a different local prompt file |
| `--track-list <file>` | Generation mode only: override the album `tracks.md` used for prepended track headers |
| `--price` | Generation mode only: print the estimated LLM cost and expected files, then exit |

Removed legacy flags:

- `--out`
- `--res`
- `--fps`
- `--tmp`

Those are fixed by this command: outputs always go to autoshow run directories under `./output`, rendering is always `1920x1080` at `30fps`, and temp files stay inside each run directory.

## Examples

```bash
# generate all lyric drafts for an album under ./albums
bun as lyrics album-title --prompt rockSong

# generate one lyric draft from an explicit album directory using OpenAI
bun as lyrics ./albums/demo 01-track --openai gpt-5.4 --prompt folkSong

# estimate the cost of generation mode without writing files
bun as lyrics album-title --price

# default local Whisper render with the bundled lyrics fixture set
bun as lyrics --audio input/examples/lyrics/01-example-song.mp3

# smaller local Whisper model
bun as lyrics --audio input/examples/lyrics/01-example-song.mp3 --model small

# rerender after editing the generated captions from the example run
bun as lyrics --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt

# keep the temp workspace for inspection
bun as lyrics --audio input/examples/lyrics/01-example-song.mp3 --keep-tmp

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

Generation mode writes provider-rendered markdown into the album directory and keeps normal run metadata under `./output`.

Single-file generation:

```text
<album>/lyrics/
  <stem>-chatgpt.md
  <stem>-claude.md
  <stem>-gemini.md
  <stem>-grok.md
  <stem>-groq.md
  <stem>-minimax.md
  <stem>-llama.md

output/YYYY-MM-DD_HH-MM-SS-sss_<stem>/
  prompt.md
  text.json
  run.json
```

Multi-file generation:

```text
<album>/lyrics/
  <stem>-<provider>.md
  ...

output/YYYY-MM-DD_HH-MM-SS-sss_lyrics-gen-batch/
  batch.json
  <child>/
    prompt.md
    text.json
    run.json
```

Render mode single runs write one timestamped output directory:

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
  <slug>/
    <stem>.mp4
    <stem>.vtt
    <stem>.srt
    run.json
```

Render-mode `run.json` records:

- source audio path
- optional captions source path
- transcription mode and Whisper model/descriptor
- cue counts and cue source
- render settings such as font, encoder, size, fps, and background mode
- artifact filenames and timing metrics

## Notes

- Generation mode resolves the first positional argument as an existing directory path first; if it does not exist, AutoShow tries `./albums/<name>`.
- Generation mode auto-uses `<album>/prompt.md`, `<album>/text/`, and `<album>/tracks.md` when present, unless `--prompt-file` or `--track-list` overrides them.
- If no generation-mode LLM flag is provided, AutoShow falls back to the repo's default llama.cpp model.
- `--price` is only available in generation mode.
- In rerender mode, the output stem comes from the caption filename, not the audio filename.
- The title displayed in the video comes from the audio filename.
- The bundled example run uses `input/examples/lyrics/01-example-song.mp3`; `input/examples/lyrics/01-cover.jpeg` is auto-detected as background art, and `input/examples/lyrics/01-example-song.txt` mirrors the reference lyrics text for caption review.
- If an image beside the audio file matches by exact basename or track number, it is used as the background; otherwise a spectrogram background is rendered.
- When ffmpeg lacks the `ass` subtitle filter, AutoShow falls back to image-based text overlays rendered with `pango-view` plus ImageMagick and still writes the same MP4/VTT/SRT outputs.
