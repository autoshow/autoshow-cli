# extract STT

Media inputs are downloaded and transcribed with local or hosted speech-to-text engines.

## Outline

- [STT Setup](#stt-setup)
- [STT Environment](#stt-environment)
- [STT Engines](#stt-engines)
  - [Local](#local)
  - [Hosted](#hosted)
- [STT Examples](#stt-examples)
- [STT Flags](#stt-flags)
- [STT Pricing And Manifests](#stt-pricing-and-manifests)
- [STT Notes](#stt-notes)

See the [`extract` overview](./01-extract.md) for input routing across STT, OCR, article HTML, and X/Twitter inputs.

## STT Setup

```bash
# full setup
bun as setup

# verify gcloud CLI auth, active project, Speech-to-Text, Text-to-Speech, Document AI, and Storage access
bun as setup --gcloud

# set or create the active gcloud project, link billing when possible,
# enable Speech-to-Text, Text-to-Speech, Document AI, and Storage when billing is ready,
# create/reuse the autoshow-ocr processor and GCS staging bucket,
# and print runtime values without changing config/autoshow.json
bun as setup --gcloud --gcloud-project PROJECT_ID

# pin a specific billing account when multiple open billing accounts exist
bun as setup --gcloud --gcloud-project PROJECT_ID --gcloud-billing-account ACCOUNT_ID

# verify AWS CLI auth, region, and bucket config for Amazon Transcribe
bun as setup --aws

# create a staging bucket or create a specific bucket name, then print the values
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

## STT Environment

| Provider | Required env | Optional override |
|----------|--------------|-------------------|
| Groq | `GROQ_API_KEY` | - |
| Grok STT | `XAI_API_KEY` | `XAI_BASE_URL` |
| DeepInfra | `DEEPINFRA_API_KEY` | `DEEPINFRA_BASE_URL` |
| Together | `TOGETHER_API_KEY` | `TOGETHER_BASE_URL` |
| Fireworks | `FIREWORKS_API_KEY` | `FIREWORKS_BASE_URL` |
| Cloudflare | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | - |
| deAPI | `DEAPI_API_KEY` | `DEAPI_BASE_URL` |
| Happy Scribe | `HAPPYSCRIBE_API_KEY` | `HAPPYSCRIBE_BASE_URL`, `HAPPYSCRIBE_ORGANIZATION_ID` |
| ElevenLabs | `ELEVENLABS_API_KEY` | - |
| Deepgram | `DEEPGRAM_API_KEY` | `DEEPGRAM_BASE_URL` |
| Soniox | `SONIOX_API_KEY` | `SONIOX_BASE_URL` |
| Speechmatics | `SPEECHMATICS_API_KEY` | `SPEECHMATICS_BASE_URL` |
| Rev | `REVAI_ACCESS_TOKEN` | `REVAI_BASE_URL` |
| OpenAI STT | `OPENAI_API_KEY` | `OPENAI_BASE_URL` |
| Gemini STT | `GEMINI_API_KEY` | `GEMINI_BASE_URL` |
| GLM STT | `GLM_API_KEY` | `GLM_BASE_URL` |
| Google Cloud STT + Document AI OCR + TTS | gcloud CLI auth (`gcloud auth login`) plus active project with linked billing | STT project is read from `gcloud config`, STT location is fixed to `us`, and requests go to `us-speech.googleapis.com`; `bun as setup --gcloud --gcloud-project ...` provisions/verifies Google resources, including `texttospeech.googleapis.com`, and prints runtime values without saving AutoShow defaults; env vars such as `AUTOSHOW_GCLOUD_PROJECT`, `AUTOSHOW_GCLOUD_DOCAI_LOCATION`, `AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID`, and `AUTOSHOW_GCLOUD_BUCKET` override saved config |
| AWS Transcribe | AWS CLI auth (`aws configure` or `AWS_PROFILE`) | `AWS_REGION` / `AWS_DEFAULT_REGION`; save `--aws-region` and `--aws-bucket` with `bun as config`, pass them per run, or run `bun as setup --aws --aws-create-bucket` to provision a staging bucket and print the values |
| Mistral | `MISTRAL_API_KEY` | - |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | `ASSEMBLYAI_BASE_URL` |
| Gladia | `GLADIA_API_KEY` | `GLADIA_BASE_URL` |

## STT Engines

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
| Grok STT | `--grok-stt <model>` | `speech-to-text`; REST STT with formatted output, word timestamps, and diarization enabled |
| DeepInfra Whisper | `--deepinfra-stt <model>` | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3`; single-speaker OpenAI-compatible Whisper |
| Together Whisper | `--together-stt <model>` | `openai/whisper-large-v3`; single-speaker OpenAI-compatible Whisper |
| Fireworks Whisper | `--fireworks-stt <model>` | `whisper-v3-turbo`, `whisper-v3`; single-speaker OpenAI-compatible Whisper |
| Cloudflare Workers AI | `--cloudflare-stt <model>` | `whisper-large-v3-turbo`, `whisper`; Cloudflare REST API |
| OpenAI STT | `--openai-stt <model>` | `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`; single-speaker transcription |
| Gemini STT | `--gemini-stt <model>` | `gemini-3-flash-preview`; prompted JSON transcription via Gemini multimodal input |
| GLM STT | `--glm-stt <model>` | `glm-asr-2512`; single-speaker transcription with 30-second auto-split policy |
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

## STT Examples

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
bun as extract input/examples/audio/1-audio.mp3 --grok-stt speech-to-text
bun as extract input/examples/audio/1-audio.mp3 --deepinfra-stt
bun as extract input/examples/audio/1-audio.mp3 --together-stt
bun as extract input/examples/audio/1-audio.mp3 --fireworks-stt whisper-v3-turbo
bun as extract input/examples/audio/1-audio.mp3 --cloudflare-stt whisper-large-v3-turbo
bun as extract input/examples/audio/1-audio.mp3 --openai-stt gpt-4o-mini-transcribe
bun as extract input/examples/audio/1-audio.mp3 --gemini-stt
bun as extract input/examples/audio/1-audio.mp3 --glm-stt
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

## STT Flags

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
| `--grok-stt <model>` | Select one or more xAI Grok STT models; omit the value to use `speech-to-text` |
| `--deepinfra-stt <model>` | Select one or more DeepInfra Whisper models; omit the value to use `openai/whisper-large-v3-turbo` |
| `--together-stt <model>` | Select one or more Together Whisper models; omit the value to use `openai/whisper-large-v3` |
| `--fireworks-stt <model>` | Select one or more Fireworks Whisper models; omit the value to use `whisper-v3-turbo` |
| `--cloudflare-stt <model>` | Select one or more Cloudflare Workers AI Whisper models; omit the value to use `whisper` |
| `--openai-stt <model>` | Select one or more OpenAI STT models; omit the value to use `gpt-4o-mini-transcribe` |
| `--gemini-stt <model>` | Select one or more Gemini STT models; omit the value to use `gemini-3-flash-preview` |
| `--glm-stt <model>` | Select one or more GLM STT models; omit the value to use `glm-asr-2512` |
| `--deapi-stt <model>` | Select one or more deAPI STT models; omit the value to keep `WhisperLargeV3` |
| `--happyscribe-stt <model>` | Select one or more Happy Scribe STT models; omit the value to keep `auto` |
| `--happyscribe-organization-id <id>` | Happy Scribe organization/workspace ID; required when the API key can access multiple organizations |
| `--mistral-stt <model>` | Select one or more Mistral STT models; omit the value to use `voxtral-mini-2602` |
| `--assemblyai-stt <model>` | Select one or more AssemblyAI STT models; omit the value to use `universal-3-pro` |
| `--gladia-stt <model>` | Select one or more Gladia STT models; omit the value to keep `default` |
| `--speaker-count <n>` | Diarization speaker-count hint for supported services |
| `--youtube-captions` | Prefer English YouTube captions before STT when available |
| `--split` | Split audio into 30-minute segments before transcription |
| `--prompt <name...>` | Named prompt presets discovered recursively under `src/prompts/entries/` |
| `--prompt-md` | Save a second prompt file (`prompt-md.md`) with markdown examples alongside the JSON prompt |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest\|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |
| `--stt-provider-concurrency <n>` | Max cloud providers running in parallel for one item |
| `--stt-local-concurrency <n>` | Max local providers running in parallel for one item |
| `--stt-segment-concurrency <n>` | Max split segments in flight per provider |
| `--stt-preflight-concurrency <n>` | Max duration probes running in parallel during preflight |
| `--refresh-cache` | Rebuild STT cache entries touched by this run |
| `--no-cache` | Bypass the media cache for this run |
| `--price` | Show the aggregated estimate and exit |

## STT Pricing And Manifests

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

## STT Notes

- Before any hosted STT provider upload, AutoShow stages one shared stripped audio-only artifact. The default hosted artifact is mono AAC-LC in `.m4a` capped at 96 kbps, preserves the original sample rate, and drops cover art/chapters/metadata/extra streams. Low-bitrate mono `.m4a`/AAC and `.mp3` inputs stay on a stream-copy cleanup path instead of taking a second lossy encode.
- Single-provider STT runs write root `transcription.txt` plus root `result.json`.
- Hosted multi-provider runs write one transcript and one canonical structured artifact per provider under `providers/<service>-<model>/`.
- `--speaker-count` is currently honored by Google Cloud, AWS, ElevenLabs, AssemblyAI, and Gladia. It is ignored by single-speaker Whisper providers such as Groq and DeepInfra, and by deAPI, Happy Scribe, Soniox, Speechmatics, Rev, and Mistral. Google Cloud and Gladia use exact min/max speaker hints. AWS always enables diarization and treats the value as `MaxSpeakerLabels`, defaulting to 30 when omitted.
- Mistral STT follows the current documented Voxtral Mini Transcribe 2 limits: up to 500 MB per audio transcription request and approximately 3 hours of audio per request.
- Mistral STT requests are internally serialized across batch items and split segments to reduce provider-side rate limits.
- Happy Scribe STT is fixed to `en-US` in v1. Non-English audio and multilingual audio are unsupported and may produce poor transcripts.
- Grok STT sends `format=true`, `language=en`, and `diarize=true` to xAI's REST STT endpoint and records word timing, confidence, and speaker evidence when the response includes it.
- `--youtube-captions` is English-only in v1 and only applies to YouTube inputs.
- For YouTube channels and playlists, `--youtube-captions` is evaluated per selected video in the batch. Use `--batch-all` when you want the full channel or playlist instead of the default batch limit.
- If captions are found, the selected STT providers are skipped for that item and the caption result becomes the transcript source.
- STT batch roots now include `stt-summary.json`, which records per-item caption-vs-STT routing alongside completion status.
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
