# transcribe (local)

Download audio and transcribe using local engines only.

## Outline

- [Usage](#usage)
- [Supported inputs](#supported-inputs)
- [Local transcription engines](#local-transcription-engines)
- [Examples](#examples)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as transcribe [input] [flags]
```

## Supported inputs

- media URL
- local media file (`.wav`, `.mp3`, `.m4a`, `.mp4`, `.webm`, `.mkv`, `.opus`, `.ogg`, `.aac`, `.mov`, `.flac`)
- directory (batch)
- URL-list file (`.md` or `.txt`, batch)

## Local transcription engines

| Engine | Selection | Models |
|--------|-----------|--------|
| Whisper.cpp | default or `--whisper <model>` | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Reverb ASR | `--reverb` | fixed Reverb engine |

Only one explicit engine flag may be used at a time.

## Examples

```bash
# Whisper default
bun as transcribe input/1-audio.mp3

# Whisper explicit model
bun as transcribe input/1-audio.mp3 --whisper large-v3-turbo

# Reverb
bun as transcribe input/1-audio.mp3 --reverb
bun as transcribe input/1-audio.mp3 --reverb --reverb-verbatimicity 0.5

# Split and batch
bun as transcribe input/2-video.mp4 --whisper large-v3-turbo --split
bun as transcribe input/2-urls.md --whisper tiny --batch-limit 5
```

## Flags

| Flag | Description |
|------|-------------|
| `--whisper <model>` | Whisper local model (default: `tiny`) |
| `--reverb` | Use Reverb ASR |
| `--reverb-verbatimicity <0-1>` | Reverb output style (default: `0.5`) |
| `--split` | Split audio into 10-minute segments before transcription |
| `--prompt <name...>` | Named prompt(s) from `src/prompts/prompts.json` |
| `--batch-limit <n>` | Process up to `n` items (default: `5`) |
| `--batch-all` | Process all discovered inputs |
| `--batch-order <order>` | Batch order control |

## Notes

- Document inputs are not supported in `transcribe`; use `extract` or `write` for documents.
- Local setup details are in [`transcribe-audio-setup.md`](./transcribe-audio-setup.md).
