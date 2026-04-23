# STT Path

Reference for the STT side of `extract`: media inputs are downloaded and transcribed with local or hosted speech-to-text engines.

## Outline

- [Setup](#setup)
- [Usage](#usage)
- [Supported Inputs](#supported-inputs)
- [Engines](#engines)
- [Examples](#examples)
- [Flags](#flags)
- [Pricing And Manifests](#pricing-and-manifests)
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
| DeepInfra | `DEEPINFRA_API_KEY` | `DEEPINFRA_BASE_URL` |
| deAPI | `DEAPI_API_KEY` | `DEAPI_BASE_URL` |
| Happy Scribe | `HAPPYSCRIBE_API_KEY` | `HAPPYSCRIBE_BASE_URL`, `HAPPYSCRIBE_ORGANIZATION_ID` |
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
bun as extract [input] [flags]
```

For backfilling missing provider outputs from an existing STT run or batch, see [`resume`](../../setup-and-utilities/resume/resume.md).

## Supported Inputs

`extract` uses this STT path for audio and video sources:

- YouTube, Twitch, or TikTok URLs
- direct media URLs
- local media files
- directory batches
- URL-list batches (`.md` / `.txt`)
- RSS or podcast feed batches
- YouTube channel batches

Document inputs do not use this STT path; `extract` routes them to the OCR/article pipeline instead.

## Engines

### Local

| Engine | Selection | Models / behavior |
|--------|-----------|-------------------|
| Whisper.cpp | default, or `--whisper <model>` | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Reverb | `--reverb` | diarized local transcription |

If no engine flag is provided, `extract` defaults to Whisper with the `tiny` model for media inputs.

### Hosted

| Engine | Selection | Models / behavior |
|--------|-----------|-------------------|
| Groq Whisper | `--groq-stt <model>` | `whisper-large-v3-turbo`, `whisper-large-v3` |
| DeepInfra Whisper | `--deepinfra-stt <model>` | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3`; single-speaker OpenAI-compatible Whisper |
| deAPI | `--deapi-stt <model>` | `WhisperLargeV3`; hosted async STT with exact provider quote support, no diarization by default, and no speaker-count hint support |
| Happy Scribe | `--happyscribe-stt <model>` | `auto`; hosted async STT with fixed `en-US`, diarization enabled by default, ignored speaker-count hints, and exact billing capture only for USD organizations |
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
bun as extract input/examples/audio/1-audio.mp3

# Local Reverb
bun as extract input/examples/audio/1-audio.mp3 --reverb --reverb-verbatimicity 0.5

# Split a long file before transcription
bun as extract input/examples/video/2-video.mp4 --whisper large-v3-turbo --split

# Hosted providers
bun as extract input/examples/audio/1-audio.mp3 --gcloud-stt
bun as extract input/examples/audio/1-audio.mp3 --gcloud-stt --speaker-count 2
bun as extract input/examples/audio/1-audio.mp3 --aws-stt
bun as extract input/examples/audio/1-audio.mp3 --aws-stt --speaker-count 2
bun as extract input/examples/audio/1-audio.mp3 --groq-stt
bun as extract input/examples/audio/1-audio.mp3 --deepinfra-stt
bun as extract input/examples/audio/1-audio.mp3 --deapi-stt WhisperLargeV3
bun as extract input/examples/audio/1-audio.mp3 --happyscribe-stt auto
bun as extract input/examples/audio/1-audio.mp3 --happyscribe-stt --happyscribe-organization-id org_123
bun as extract input/examples/audio/1-audio.mp3 --deepgram-stt nova-3

# Same provider, multiple models
bun as extract input/examples/audio/1-audio.mp3 --speechmatics-stt standard --speechmatics-stt enhanced

# deAPI exact preflight on a supported passthrough URL
bun as extract https://www.youtube.com/watch?v=dQw4w9WgXcQ --deapi-stt WhisperLargeV3 --price

# Prefer YouTube captions, then fall back to STT
bun as extract https://www.youtube.com/watch?v=dQw4w9WgXcQ --youtube-captions --deepgram-stt nova-3

# Process a whole YouTube channel batch with caption-first routing
bun as extract https://www.youtube.com/@channelname --youtube-captions --batch-all

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
| `--deepinfra-stt <model>` | Select one or more DeepInfra Whisper models; omit the value to use `openai/whisper-large-v3-turbo` |
| `--deapi-stt <model>` | Select one or more deAPI STT models; omit the value to keep `WhisperLargeV3` |
| `--happyscribe-stt <model>` | Select one or more Happy Scribe STT models; omit the value to keep `auto` |
| `--happyscribe-organization-id <id>` | Happy Scribe organization/workspace ID; required when the API key can access multiple organizations |
| `--mistral-stt <model>` | Select one or more Mistral STT models; omit the value to use `voxtral-mini-2602` |
| `--assemblyai-stt <model>` | Select one or more AssemblyAI STT models; omit the value to use `universal-3-pro` |
| `--gladia-stt <model>` | Select one or more Gladia STT models; omit the value to keep `default` |
| `--speaker-count <n>` | Diarization speaker-count hint for supported services |
| `--youtube-captions` | Prefer English YouTube captions before STT when available |
| `--split` | Split audio into 30-minute segments before transcription |
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
| `--price` | Show the aggregated estimate and exit |

## Pricing And Manifests

deAPI uses live provider pricing when its quote endpoint succeeds.

- `--price` and budget preflight call deAPI pricing before execution. When the original source URL is a recognized deAPI passthrough host such as YouTube, X/Twitter, Twitch, Kick, or TikTok, AutoShow quotes with `source_url`. Otherwise it quotes by prepared-media `duration_seconds`. Both quote modes request timestamps.
- Successful deAPI preflight quotes are recorded as `estimateType: exact`. If the pricing endpoint fails or returns `429`, AutoShow retries normally, warns on fallback, and uses local registry pricing instead.
- During execution, AutoShow captures the deAPI quote before each remote job submission and writes it into `run.json` under `step2.billing` with `totalCost`, `source`, and `mode`. Actual STT cost prefers this stored provider quote over duration-based registry math.
- deAPI runs stay on the existing async checkpoint flow. Supported passthrough URLs use remote URL mode, while local files and unsupported URLs use prepared-media multipart upload mode. `providers/<service>-<model>/checkpoint.json` keeps the remote request id so `resume` can continue polling without recreating the job.
- If deAPI rejects an upload as too large, AutoShow falls back to the normal split-and-merge path, re-quotes each segment, and records the summed billed amount with `step2.billing.mode: 'segment_sum'`.

Happy Scribe price preflight is intentionally side-effect free.

- `--price` never creates Happy Scribe uploads or draft orders. Preflight uses the published AI rate of `$0.20/min` and the local timing registry.
- Organization resolution order is CLI `--happyscribe-organization-id`, config default, `HAPPYSCRIBE_ORGANIZATION_ID`, then auto-select only when the API key can access exactly one organization.
- If preflight cannot resolve a unique organization, AutoShow still prints the generic estimate and adds a note that execution needs an explicit organization override.
- During execution, AutoShow records Happy Scribe billing in `step2.billing` using `totalCost`, `creditsUsed`, `creditRateCents`, `source: "provider_quote"`, and `mode: "order"` when the selected organization reports `currency: "usd"`. Non-USD execution is rejected in v1. If exact provider billing is unavailable, AutoShow falls back to registry math with `source: "registry_fallback"`.
- Happy Scribe split runs submit one order per segment and merge segment billing into `step2.billing.mode: "segment_sum"`.

## Notes

- Before any hosted STT provider upload, Autoshow now stages one shared stripped audio-only artifact. The default hosted artifact is mono AAC-LC in `.m4a` capped at 96 kbps, preserves the original sample rate, and drops cover art/chapters/metadata/extra streams. Low-bitrate mono `.m4a`/AAC and `.mp3` inputs stay on a stream-copy cleanup path instead of taking a second lossy encode.
- Single-provider STT runs write root `transcription.txt` plus root `result.json`.
- Hosted multi-provider runs write one transcript and one canonical structured artifact per provider under `providers/<service>-<model>/`.
- `--speaker-count` is currently honored by Google Cloud, AWS, ElevenLabs, AssemblyAI, and Gladia. It is ignored by single-speaker Whisper providers such as Groq and DeepInfra, and by deAPI, Happy Scribe, Soniox, Speechmatics, Rev, and Mistral. Google Cloud and Gladia use exact min/max speaker hints. AWS always enables diarization and treats the value as `MaxSpeakerLabels`, defaulting to 30 when omitted.
- Mistral STT follows the current documented Voxtral Mini Transcribe 2 limits: up to 500 MB per audio transcription request and approximately 3 hours of audio per request.
- Mistral STT requests are internally serialized across batch items and split segments to reduce provider-side rate limits.
- Happy Scribe STT is fixed to `en-US` in v1. Non-English audio and multilingual audio are unsupported and may produce poor transcripts.
- `--youtube-captions` is English-only in v1 and only applies to YouTube inputs.
- For YouTube channels and playlists, `--youtube-captions` is evaluated per selected video in the batch. Use `--batch-all` when you want the full channel or playlist instead of the default batch limit.
- If captions are found, the selected STT providers are skipped for that item and the caption result becomes the transcript source.
- STT batch roots now include `stt-summary.json`, which records per-item caption-vs-STT routing alongside completion status.
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
