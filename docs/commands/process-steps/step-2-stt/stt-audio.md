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

# verify gcloud CLI auth, active project, and Speech-to-Text API access
bun as setup --gcloud

# set or create the active gcloud project, link billing when possible,
# enable Speech-to-Text when billing is ready, and save chirp_3 when no
# Google STT default is saved yet
bun as setup --gcloud --gcloud-project PROJECT_ID

# pin a specific billing account when multiple open billing accounts exist
bun as setup --gcloud --gcloud-project PROJECT_ID --gcloud-billing-account ACCOUNT_ID

# verify AWS CLI auth, region, and bucket config for Amazon Transcribe
# creates and saves a staging bucket automatically when one is not configured
bun as setup --aws

# force creation of a staging bucket or create a specific bucket name
bun as setup --aws --aws-create-bucket

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
| Google Cloud STT | gcloud CLI auth (`gcloud auth login`) plus active project with linked billing | none; project is read from `gcloud config`, location is fixed to `us`, and requests go to `us-speech.googleapis.com`; use `bun as setup --gcloud --gcloud-project ...` to set or create the active project from AutoShow |
| AWS Transcribe | AWS CLI auth (`aws configure` or `AWS_PROFILE`) | `AWS_REGION` / `AWS_DEFAULT_REGION`; save `--aws-region` and `--aws-bucket` with `bun as config`, or run `bun as setup --aws` to provision/save a staging bucket automatically when none is configured |
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
| Google Cloud STT | `--gcloud-stt <model>` | `chirp_3`; sync REST via gcloud CLI auth with diarization always enabled |
| AWS Transcribe | `--aws-stt <model>` | `standard`; async batch via AWS CLI with diarization always enabled |
| Deepgram | `--deepgram-stt <model>` | `nova-3` |
| Soniox | `--soniox-stt <model>` | `stt-async-v4` |
| Speechmatics | `--speechmatics-stt <model>` | `standard`, `enhanced` |
| Rev | `--rev-stt <model>` | `machine`, `low_cost` |
| Mistral | `--mistral-stt <model>` | `voxtral-mini-2602` |
| AssemblyAI | `--assemblyai-stt <model>` | `universal-3-pro` |
| Gladia | `--gladia-stt <model>` | `default` |
| YouTube captions | `--youtube-captions` | prefer manual English captions, then auto English captions, before STT |

Hosted provider flags accept an omitted model value and then resolve to the cheapest or default supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

## Examples

```bash
# Default local Whisper
bun as stt input/examples/audio/1-audio.mp3

# Local Reverb
bun as stt input/examples/audio/1-audio.mp3 --reverb --reverb-verbatimicity 0.5

# Split a long file before transcription
bun as stt input/examples/video/2-video.mp4 --whisper large-v3-turbo --split

# Hosted providers
bun as stt input/examples/audio/1-audio.mp3 --gcloud-stt
bun as stt input/examples/audio/1-audio.mp3 --gcloud-stt --speaker-count 2
bun as stt input/examples/audio/1-audio.mp3 --aws-stt
bun as stt input/examples/audio/1-audio.mp3 --aws-stt --speaker-count 2
bun as stt input/examples/audio/1-audio.mp3 --groq-stt
bun as stt input/examples/audio/1-audio.mp3 --deepgram-stt nova-3

# Same provider, multiple models
bun as stt input/examples/audio/1-audio.mp3 --speechmatics-stt standard --speechmatics-stt enhanced

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
| `--whisper <model>` | Select one or more local Whisper models |
| `--reverb` | Use Reverb instead of Whisper |
| `--reverb-verbatimicity <0-1>` | Reverb output style |
| `--gcloud-stt <model>` | Select one or more Google Cloud STT models; omit the value to use `chirp_3` |
| `--aws-stt <model>` | Select one or more AWS Transcribe models; omit the value to use `standard` |
| `--aws-region <region>` | Override the AWS CLI region used for AWS Transcribe jobs |
| `--aws-bucket <bucket>` | S3 bucket used for temporary AWS Transcribe input/output objects |
| `--elevenlabs-stt <model>` | Select one or more ElevenLabs STT models; omit the value to keep `scribe_v2` |
| `--deepgram-stt <model>` | Select one or more Deepgram STT models; omit the value to keep `nova-3` |
| `--soniox-stt <model>` | Select one or more Soniox STT models; omit the value to keep `stt-async-v4` |
| `--speechmatics-stt <model>` | Select one or more Speechmatics STT models; omit the value to use `standard` |
| `--rev-stt <model>` | Select one or more Rev STT models; omit the value to use `low_cost` |
| `--groq-stt <model>` | Select one or more Groq STT models; omit the value to use the cheapest supported model |
| `--mistral-stt <model>` | Select one or more Mistral STT models; omit the value to use `voxtral-mini-2602` |
| `--assemblyai-stt <model>` | Select one or more AssemblyAI STT models; omit the value to use `universal-3-pro` |
| `--gladia-stt <model>` | Select one or more Gladia STT models; omit the value to keep `default` |
| `--speaker-count <n>` | Diarization speaker-count hint for supported services |
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

- Before any hosted STT provider upload, Autoshow now extracts/persists a shared compressed audio-only artifact and avoids fresh lossy re-encoding whenever it can preserve the original audio stream.
- Single-provider STT runs write root `transcription.txt` plus root `result.json`.
- Hosted multi-provider runs write one transcript and one canonical structured artifact per provider under `providers/<service>-<model>/`.
- `--speaker-count` is currently honored by Google Cloud, AWS, ElevenLabs, AssemblyAI, and Gladia. Google Cloud and Gladia use exact min/max speaker hints. AWS always enables diarization and treats the value as `MaxSpeakerLabels`, defaulting to 30 when omitted.
- `--youtube-captions` is English-only in v1 and only applies to YouTube inputs.
- For YouTube channels and playlists, `--youtube-captions` is evaluated per selected video in the batch. Use `--batch-all` when you want the full channel or playlist instead of the default batch limit.
- If captions are found, the selected STT providers are skipped for that item and the caption result becomes the transcript source.
- STT batch roots now include `stt-summary.json`, which records per-item caption-vs-STT routing alongside completion status.
- `--resume-missing` reuses an earlier STT batch, does not take a positional input, does not support `--price`, and any provider flags must be a subset of the original requested providers.
