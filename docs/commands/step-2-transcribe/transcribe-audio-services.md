# transcribe (services)

Download audio and transcribe using service APIs only.

## Outline

- [Usage](#usage)
- [Service transcription engines](#service-transcription-engines)
- [Examples](#examples)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as transcribe [input] [flags]
```

## Service transcription engines

| Engine | Selection | Models |
|--------|-----------|--------|
| Groq Whisper | `--groq-stt <model>` | `whisper-large-v3`, `whisper-large-v3-turbo` |
| ElevenLabs STT | `--elevenlabs-stt <model>` | `scribe_v2` |
| OpenAI STT | `--openai-stt <model>` | `gpt-4o-transcribe-diarize` |
| Mistral STT | `--mistral-stt <model>` | `voxtral-mini-latest`, `voxtral-mini-2602` |
| AssemblyAI STT | `--assemblyai-stt <model>` | `universal-2`, `universal-3-pro` |

Only one service flag may be used at a time.

## Examples

```bash
# Groq
bun as transcribe input/1-audio.mp3 --groq-stt whisper-large-v3

# ElevenLabs
bun as transcribe input/1-audio.mp3 --elevenlabs-stt scribe_v2 --speaker-count 3

# OpenAI
bun as transcribe input/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize --speaker-count 2

# Mistral
bun as transcribe input/1-audio.mp3 --mistral-stt voxtral-mini-2602 --speaker-count 2

# AssemblyAI
bun as transcribe input/1-audio.mp3 --assemblyai-stt universal-2 --speaker-count 3

# Price preflight
bun as transcribe input/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize --price
```

## Flags

| Flag | Description |
|------|-------------|
| `--groq-stt <model>` | Groq Whisper STT model |
| `--elevenlabs-stt <model>` | ElevenLabs STT model |
| `--openai-stt <model>` | OpenAI STT model |
| `--mistral-stt <model>` | Mistral STT model |
| `--assemblyai-stt <model>` | AssemblyAI STT model |
| `--speaker-count <n>` | Speaker-count hint for diarization-capable services |
| `--price` | Show cost estimate and exit |
| `--prompt <name...>` | Named prompt(s) from `src/prompts/prompts.json` |

## Notes

- With Mistral, diarization can be enabled but `--speaker-count` is treated as a hint and may be ignored.
- AssemblyAI supports speaker count hints, diarization, and word-level timestamps.
- Service setup/env details are in [`transcribe-audio-setup.md`](./transcribe-audio-setup.md).
