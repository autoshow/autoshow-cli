# stt

Download audio and transcribe it with local or hosted speech-to-text engines.

## Outline

- [Setup](#setup)
- [Usage](#usage)
- [Supported Inputs](#supported-inputs)
- [Engines](#engines)
- [Examples](#examples)
- [Flags](#flags)
- [Notes](#notes)

## Setup

```bash
# full setup
bun as setup

# build whisper.cpp binary only
bun as setup --step whisper-binary

# download the default whisper model only
bun as setup --step whisper-model

# download large-v3-turbo plus Reverb assets
bun as setup --step transcription

# install the Reverb environment and models
bun as setup --step reverb
```

### Environment

| Provider | Required env | Optional override |
|----------|--------------|-------------------|
| Groq | `GROQ_API_KEY` | - |
| ElevenLabs | `ELEVENLABS_API_KEY` | - |
| Deepgram | `DEEPGRAM_API_KEY` | `DEEPGRAM_BASE_URL` |
| Soniox | `SONIOX_API_KEY` | `SONIOX_BASE_URL` |
| Speechmatics | `SPEECHMATICS_API_KEY` | `SPEECHMATICS_BASE_URL` |
| Rev | `REVAI_ACCESS_TOKEN` | `REVAI_BASE_URL` |
| OpenAI | `OPENAI_API_KEY` | - |
| Mistral | `MISTRAL_API_KEY` | - |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | `ASSEMBLYAI_BASE_URL` |
| Gladia | `GLADIA_API_KEY` | `GLADIA_BASE_URL` |

## Usage

```bash
bun as stt [input] [flags]
bun as stt --resume-missing [batch-dir] [provider flags]
```

## Supported Inputs

`stt` uses the same input routing as `download` for audio and video sources:

- YouTube, Twitch, or TikTok URLs
- direct media URLs
- local media files
- directory batches
- URL-list batches (`.md` / `.txt`)
- RSS or podcast feed batches
- YouTube channel batches

Document inputs are not supported by `stt`.

## Engines

### Local

| Engine | Selection | Models / behavior |
|--------|-----------|-------------------|
| Whisper.cpp | default, or `--whisper <model>` | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Reverb | `--reverb` | diarized local transcription |

If no engine flag is provided, `stt` defaults to Whisper with the `tiny` model.

### Hosted

| Engine | Selection | Models / behavior |
|--------|-----------|-------------------|
| Groq Whisper | `--groq-stt <model>` | `whisper-large-v3-turbo`, `whisper-large-v3` |
| ElevenLabs | `--elevenlabs-stt <model>` | `scribe_v2` |
| Deepgram | `--deepgram-stt <model>` | `nova-3` |
| Soniox | `--soniox-stt <model>` | `stt-async-v4` |
| Speechmatics | `--speechmatics-stt <model>` | `standard`, `enhanced` |
| Rev | `--rev-stt <model>` | `machine`, `low_cost` |
| OpenAI | `--openai-stt <model>` | `gpt-4o-transcribe-diarize` |
| Mistral | `--mistral-stt <model>` | `voxtral-mini-2602` |
| AssemblyAI | `--assemblyai-stt <model>` | `universal-3-pro` |
| Gladia | `--gladia-stt <model>` | `default` |
| YouTube captions | `--youtube-captions` | prefer manual English captions, then auto English captions, before STT |

Hosted provider flags accept an omitted model value and then resolve to the cheapest or default supported model.

## Examples

```bash
# Default local Whisper
bun as stt input/examples/audio/1-audio.mp3

# Local Reverb
bun as stt input/examples/audio/1-audio.mp3 --reverb --reverb-verbatimicity 0.5

# Split a long file before transcription
bun as stt input/examples/video/2-video.mp4 --whisper large-v3-turbo --split

# Hosted providers
bun as stt input/examples/audio/1-audio.mp3 --groq-stt
bun as stt input/examples/audio/1-audio.mp3 --deepgram-stt nova-3

# OpenAI known speaker references
bun as stt input/examples/audio/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize \
  --speaker-name Host --speaker-reference clips/host.mp3 \
  --speaker-name Guest --speaker-reference clips/guest.mp3

# Prefer YouTube captions, then fall back to STT
bun as stt https://www.youtube.com/watch?v=dQw4w9WgXcQ --youtube-captions --deepgram-stt nova-3

# Process a whole YouTube channel batch with caption-first routing
bun as stt https://www.youtube.com/@channelname --youtube-captions --batch-all

# Resume missing provider outputs from an earlier batch
bun as stt --resume-missing
```

## Flags

| Flag | Description |
|------|-------------|
| `--whisper <model>` | Select the local Whisper model |
| `--reverb` | Use Reverb instead of Whisper |
| `--reverb-verbatimicity <0-1>` | Reverb output style |
| `--elevenlabs-stt <model>` | Select the ElevenLabs STT model; omit the value to keep `scribe_v2` |
| `--deepgram-stt <model>` | Select the Deepgram STT model; omit the value to keep `nova-3` |
| `--soniox-stt <model>` | Select the Soniox STT model; omit the value to keep `stt-async-v4` |
| `--speechmatics-stt <model>` | Select the Speechmatics STT model; omit the value to use `standard` |
| `--rev-stt <model>` | Select the Rev STT model; omit the value to use `low_cost` |
| `--groq-stt <model>` | Select the Groq STT model; omit the value to use the cheapest supported model |
| `--openai-stt <model>` | Select the OpenAI STT model; omit the value to keep `gpt-4o-transcribe-diarize` |
| `--mistral-stt <model>` | Select the Mistral STT model; omit the value to use `voxtral-mini-2602` |
| `--assemblyai-stt <model>` | Select the AssemblyAI STT model; omit the value to use `universal-3-pro` |
| `--gladia-stt <model>` | Select the Gladia STT model; omit the value to keep `default` |
| `--speaker-count <n>` | Diarization speaker-count hint for supported services |
| `--speaker-name <name...>` | OpenAI known speaker names; repeat in the same order as `--speaker-reference` |
| `--speaker-reference <path...>` | OpenAI speaker reference clips or data URLs |
| `--youtube-captions` | Prefer English YouTube captions before STT when available |
| `--split` | Split audio into 10-minute segments before transcription |
| `--prompt <name...>` | Named prompt presets from `src/prompts/entries/*.json` |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |
| `--stt-provider-concurrency <n>` | Max cloud providers running in parallel for one item |
| `--stt-local-concurrency <n>` | Max local providers running in parallel for one item |
| `--stt-segment-concurrency <n>` | Max split segments in flight per provider |
| `--stt-preflight-concurrency <n>` | Max duration probes running in parallel during preflight |
| `--refresh-cache` | Rebuild STT cache entries touched by this run |
| `--no-cache` | Bypass the media cache for this run |
| `--resume-missing [batch-dir]` | Reuse an STT batch directory and rerun only missing provider outputs |
| `--price` | Show the aggregated estimate and exit |

## Notes

- Hosted multi-provider runs write one transcript and metadata set per provider under `providers/<service>-<model>/`.
- `--speaker-count` is currently honored by ElevenLabs, AssemblyAI, and Gladia. It is ignored by local engines and the other hosted STT providers.
- OpenAI does not support count-only diarization hints. Use `--speaker-name` with matching `--speaker-reference` clips instead.
- `--youtube-captions` is English-only in v1 and only applies to YouTube inputs.
- For YouTube channels and playlists, `--youtube-captions` is evaluated per selected video in the batch. Use `--batch-all` when you want the full channel or playlist instead of the default batch limit.
- If captions are found, the selected STT providers are skipped for that item and the caption result becomes the transcript source.
- STT batch roots now include `stt-summary.json`, which records per-item caption-vs-STT routing alongside completion status.
- `--resume-missing` reuses an earlier STT batch, does not take a positional input, does not support `--price`, and any provider flags must be a subset of the original requested providers.
