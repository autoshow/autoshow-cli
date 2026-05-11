# extract STT

Media inputs are downloaded and transcribed with local or hosted speech-to-text engines.

## Outline

- [STT Setup](#stt-setup)
- [STT Environment](#stt-environment)
- [Shared STT Options](#shared-stt-options)
- [URL/streaming/source-URL STT](#urlstreamingsource-url-stt)
  - [deAPI](#deapi)
  - [Happy Scribe](#happy-scribe)
  - [Supadata](#supadata)
  - [Gladia](#gladia)
- [Non-diarized STT](#non-diarized-stt)
  - [Whisper.cpp](#whispercpp)
  - [Groq](#groq)
  - [DeepInfra](#deepinfra)
  - [Together](#together)
  - [OpenAI STT](#openai-stt)
  - [Gemini STT](#gemini-stt)
  - [GLM STT](#glm-stt)
  - [Mistral](#mistral)
- [Diarized STT](#diarized-stt)
  - [Reverb](#reverb)
  - [Grok STT](#grok-stt)
  - [ElevenLabs](#elevenlabs)
  - [Deepgram](#deepgram)
  - [Soniox](#soniox)
  - [Speechmatics](#speechmatics)
  - [Rev](#rev)
  - [Google Cloud STT](#google-cloud-stt)
  - [AWS Transcribe](#aws-transcribe)
  - [AssemblyAI](#assemblyai)
- [STT Pricing And Manifests](#stt-pricing-and-manifests)
- [STT Notes](#stt-notes)

See the [`extract` overview](./01-extract.md) for input routing across STT, OCR, article HTML, and X/Twitter inputs.

If no engine flag is provided, `extract` defaults to local Whisper.cpp with the `tiny` model for media inputs. Provider flags accept an omitted model value and then resolve to the cheapest or default supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

## STT Setup

```bash
# full setup
bun as setup

# verify gcloud CLI auth, active project, Speech-to-Text, Text-to-Speech, Document AI, and Storage access
bun as setup --gcloud

# set or create the active gcloud project, link billing when possible,
# enable Speech-to-Text, Text-to-Speech, Document AI, and Storage when billing is ready,
# create/reuse the autoshow-ocr processor and GCS staging bucket,
# and save reusable Google STT/OCR/TTS defaults to config/autoshow.json
bun as setup --gcloud --gcloud-project PROJECT_ID

# pin a specific billing account when multiple open billing accounts exist
bun as setup --gcloud --gcloud-project PROJECT_ID --gcloud-billing-account ACCOUNT_ID

# run cloud setup checks together
bun as setup --gcloud --aws

# verify AWS CLI auth, region, and bucket config for Amazon Transcribe
bun as setup --aws

# create a staging bucket or create a specific bucket name, then save the shared AWS defaults
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
| deAPI | `DEAPI_API_KEY` | `DEAPI_BASE_URL` |
| Happy Scribe | `HAPPYSCRIBE_API_KEY` | `HAPPYSCRIBE_BASE_URL`, `HAPPYSCRIBE_ORGANIZATION_ID` |
| Supadata | `SUPADATA_API_KEY` | `SUPADATA_BASE_URL` |
| ElevenLabs | `ELEVENLABS_API_KEY` | - |
| Deepgram | `DEEPGRAM_API_KEY` | `DEEPGRAM_BASE_URL` |
| Soniox | `SONIOX_API_KEY` | `SONIOX_BASE_URL` |
| Speechmatics | `SPEECHMATICS_API_KEY` | `SPEECHMATICS_BASE_URL` |
| Rev | `REVAI_ACCESS_TOKEN` | `REVAI_BASE_URL` |
| OpenAI STT | `OPENAI_API_KEY` | `OPENAI_BASE_URL` |
| Gemini STT | `GEMINI_API_KEY` | `GEMINI_BASE_URL` |
| GLM STT | `GLM_API_KEY` | `GLM_BASE_URL` |
| Google Cloud STT + Document AI OCR + TTS | gcloud CLI auth (`gcloud auth login`) plus active project with linked billing | STT project is read from `gcloud config`, STT location is fixed to `us`, and requests go to `us-speech.googleapis.com`; `bun as setup --gcloud --gcloud-project ...` provisions/verifies Google resources, including `texttospeech.googleapis.com`, and prints runtime values without saving AutoShow defaults; env vars such as `AUTOSHOW_GCLOUD_PROJECT`, `AUTOSHOW_GCLOUD_DOCAI_LOCATION`, `AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID`, and `AUTOSHOW_GCLOUD_BUCKET` override saved config |
| AWS Transcribe | AWS CLI auth (`aws configure` or `AWS_PROFILE`) | `AWS_REGION` / `AWS_DEFAULT_REGION`; save `--aws-region` and `--aws-bucket` with `bun as config`, pass them per run, or run `bun as setup --aws --aws-create-bucket` to provision a staging bucket shared with AWS Textract |
| Mistral | `MISTRAL_API_KEY` | - |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | `ASSEMBLYAI_BASE_URL` |
| Gladia | `GLADIA_API_KEY` | `GLADIA_BASE_URL` |

## Shared STT Options

| Flag | Description |
|------|-------------|
| `--all-stt` | Enable every supported STT provider/model for this command |
| `--youtube-captions` | Prefer English YouTube captions before STT when available; falls back to the selected STT provider path |
| `--speaker-count <n>` | Diarization speaker-count hint for supported services |
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

```bash
# Prefer YouTube captions, then fall back to STT
bun as extract https://www.youtube.com/watch?v=dQw4w9WgXcQ --youtube-captions --deepgram-stt nova-3

# Split a long file before transcription
bun as extract input/examples/video/2-video.mp4 --whisper-stt large-v3-turbo --split

# Process a whole YouTube channel batch with caption-first routing
bun as extract https://www.youtube.com/@channelname --youtube-captions --batch-all
```

`--speaker-count` is currently honored by Google Cloud, AWS, ElevenLabs, AssemblyAI, and Gladia. It is ignored by single-speaker Whisper providers such as Groq and DeepInfra, and by deAPI, Happy Scribe, Supadata, Soniox, Speechmatics, Rev, and Mistral. Google Cloud and Gladia use exact min/max speaker hints. AWS always enables diarization and treats the value as `MaxSpeakerLabels`, defaulting to 30 when omitted.

## URL/streaming/source-URL STT

These services either work best with provider-side URLs or have source-URL-specific behavior.

### deAPI

| Option | Value |
|--------|-------|
| Selector | `--deapi-stt <model>` |
| Models | `WhisperLargeV3` |
| Diarization | Not enabled by default; `--speaker-count` is ignored |
| Pricing | Exact provider quote support when the quote endpoint succeeds |

```bash
bun as extract input/examples/audio/1-audio.mp3 --deapi-stt WhisperLargeV3
bun as extract https://www.youtube.com/watch?v=dQw4w9WgXcQ --deapi-stt WhisperLargeV3 --price
```

Supported passthrough URLs use remote URL mode, while local files and unsupported URLs use prepared-media multipart upload mode. If deAPI rejects an upload as too large, AutoShow falls back to the normal split-and-merge path, re-quotes each segment, and records the summed billed amount with `step2.billing.mode: 'segment_sum'`.

### Happy Scribe

| Option | Value |
|--------|-------|
| Selector | `--happyscribe-stt <model>` |
| Models | `auto` |
| Organization | `--happyscribe-organization-id <id>` |
| Language | Fixed to `en-US` in v1 |
| Diarization | Enabled by default; `--speaker-count` is ignored |

```bash
bun as extract input/examples/audio/1-audio.mp3 --happyscribe-stt auto
bun as extract input/examples/audio/1-audio.mp3 --happyscribe-stt --happyscribe-organization-id org_123
```

Organization resolution order is CLI `--happyscribe-organization-id`, config default, `HAPPYSCRIBE_ORGANIZATION_ID`, then auto-select only when the API key can access exactly one organization. Non-English audio and multilingual audio are unsupported and may produce poor transcripts.

### Supadata

| Option | Value |
|--------|-------|
| Selector | `--supadata-stt <auto\|native\|generate>` |
| Language | `--supadata-lang <code>` for `auto` and `native` modes |
| Required env | `SUPADATA_API_KEY` |
| Optional env | `SUPADATA_BASE_URL` |
| Input support | Public YouTube, TikTok, Instagram, X/Twitter, Facebook, or direct media/file URLs |

```bash
bun as extract https://www.youtube.com/watch?v=dQw4w9WgXcQ --supadata-stt auto --supadata-lang en
bun as extract https://www.tiktok.com/@example/video/1234567890 --supadata-stt generate
bun as extract https://example.com/audio/interview.mp3 --supadata-stt native --price
```

Supadata requires a public source URL and cannot transcribe local file inputs through the AutoShow CLI. `auto` tries provider-native transcripts first and generates a transcript when needed, `native` only fetches existing transcripts, and `generate` requests AI transcript generation. `--supadata-lang` is only sent for `auto` and `native`; generated transcripts ignore that flag.

### Gladia

| Option | Value |
|--------|-------|
| Selector | `--gladia-stt <model>` |
| Models | `default` |
| Diarization | Supports exact `--speaker-count` hints |

```bash
bun as extract input/examples/audio/1-audio.mp3 --gladia-stt default
bun as extract input/examples/audio/1-audio.mp3 --gladia-stt --speaker-count 2
```

## Non-diarized STT

These providers are documented as single-speaker or non-diarized in the CLI.

### Whisper.cpp

| Option | Value |
|--------|-------|
| Selector | default, or `--whisper-stt <model>` |
| Models | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Runtime | Local `whisper.cpp` |

```bash
bun as extract input/examples/audio/1-audio.mp3
bun as extract input/examples/audio/1-audio.mp3 --whisper-stt large-v3-turbo
```

### Groq

| Option | Value |
|--------|-------|
| Selector | `--groq-stt <model>` |
| Models | `whisper-large-v3-turbo`, `whisper-large-v3` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --groq-stt
```

### DeepInfra

| Option | Value |
|--------|-------|
| Selector | `--deepinfra-stt <model>` |
| Models | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --deepinfra-stt
```

### Together

| Option | Value |
|--------|-------|
| Selector | `--together-stt <model>` |
| Models | `openai/whisper-large-v3` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --together-stt
```

### OpenAI STT

| Option | Value |
|--------|-------|
| Selector | `--openai-stt <model>` |
| Models | `gpt-4o-mini-transcribe`, `gpt-4o-transcribe` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --openai-stt gpt-4o-mini-transcribe
```

### Gemini STT

| Option | Value |
|--------|-------|
| Selector | `--gemini-stt <model>` |
| Models | `gemini-3-flash-preview` |
| Behavior | Prompted JSON transcription via Gemini multimodal input |

```bash
bun as extract input/examples/audio/1-audio.mp3 --gemini-stt
```

### GLM STT

| Option | Value |
|--------|-------|
| Selector | `--glm-stt <model>` |
| Models | `glm-asr-2512` |
| Behavior | Single-speaker transcription with a 30-second auto-split policy |

```bash
bun as extract input/examples/audio/1-audio.mp3 --glm-stt
```

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--mistral-stt <model>` |
| Models | `voxtral-mini-2602` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --mistral-stt
```

Mistral STT follows the current documented Voxtral Mini Transcribe 2 limits: up to 500 MB per audio transcription request and approximately 3 hours of audio per request. Requests are internally serialized across batch items and split segments to reduce provider-side rate limits.

## Diarized STT

These engines either support diarization directly or AutoShow enables diarization for them.

### Reverb

| Option | Value |
|--------|-------|
| Selector | `--reverb-stt` |
| Style | `--reverb-verbatimicity <0-1>` |
| Runtime | Local diarized transcription |

```bash
bun as extract input/examples/audio/1-audio.mp3 --reverb-stt --reverb-verbatimicity 0.5
```

### Grok STT

| Option | Value |
|--------|-------|
| Selector | `--grok-stt <model>` |
| Models | `speech-to-text` |
| Behavior | REST STT with formatted output, word timestamps, and diarization enabled |

```bash
bun as extract input/examples/audio/1-audio.mp3 --grok-stt speech-to-text
```

Grok STT sends `format=true`, `language=en`, and `diarize=true` to xAI's REST STT endpoint and records word timing, confidence, and speaker evidence when the response includes it.

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--elevenlabs-stt <model>` |
| Models | `scribe_v2` |
| Diarization | Supports `--speaker-count` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --elevenlabs-stt scribe_v2 --speaker-count 2
```

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--deepgram-stt <model>` |
| Models | `nova-3` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --deepgram-stt nova-3
```

### Soniox

| Option | Value |
|--------|-------|
| Selector | `--soniox-stt <model>` |
| Models | `stt-async-v4` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --soniox-stt
```

### Speechmatics

| Option | Value |
|--------|-------|
| Selector | `--speechmatics-stt <model>` |
| Models | `standard`, `enhanced` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --speechmatics-stt standard --speechmatics-stt enhanced
```

### Rev

| Option | Value |
|--------|-------|
| Selector | `--rev-stt <model>` |
| Models | `machine`, `low_cost` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --rev-stt low_cost
```

### Google Cloud STT

| Option | Value |
|--------|-------|
| Selector | `--gcloud-stt <model>` |
| Models | `chirp_3` |
| Diarization | Always enabled; supports exact `--speaker-count` hints |

```bash
bun as extract input/examples/audio/1-audio.mp3 --gcloud-stt
bun as extract input/examples/audio/1-audio.mp3 --gcloud-stt --speaker-count 2
```

### AWS Transcribe

| Option | Value |
|--------|-------|
| Selector | `--aws-stt <model>` |
| Models | `standard` |
| Region | `--aws-region <region>` |
| Staging bucket | `--aws-bucket <bucket>` |
| Diarization | Always enabled; `--speaker-count` maps to `MaxSpeakerLabels` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --aws-stt
bun as extract input/examples/audio/1-audio.mp3 --aws-stt --speaker-count 2
```

### AssemblyAI

| Option | Value |
|--------|-------|
| Selector | `--assemblyai-stt <model>` |
| Models | `universal-3-pro` |
| Diarization | Supports `--speaker-count` |

```bash
bun as extract input/examples/audio/1-audio.mp3 --assemblyai-stt
```

## STT Pricing And Manifests

deAPI uses live provider pricing when its quote endpoint succeeds.

- `--price` and budget preflight call deAPI pricing before execution. When the original source URL is a recognized deAPI passthrough host such as YouTube, X/Twitter, Twitch, Kick, or TikTok, AutoShow quotes with `source_url`. Otherwise it quotes by prepared-media `duration_seconds`. Both quote modes request timestamps.
- Successful deAPI preflight quotes are recorded as `estimateType: exact`. If the pricing endpoint fails or returns `429`, AutoShow retries normally, warns on fallback, and uses local registry pricing instead.
- During execution, AutoShow captures the deAPI quote before each remote job submission and writes it into `run.json` under `step2.billing` with `totalCost`, `source`, and `mode`. Actual STT cost prefers this stored provider quote over duration-based registry math.
- deAPI runs stay on the existing async checkpoint flow. `providers/<service>-<model>/checkpoint.json` keeps the remote request id so `resume` can continue polling without recreating the job.

Happy Scribe price preflight is intentionally side-effect free.

- `--price` never creates Happy Scribe uploads or draft orders. Preflight uses the published AI rate of `$0.20/min` and the local timing registry.
- If preflight cannot resolve a unique organization, AutoShow still prints the generic estimate and adds a note that execution needs an explicit organization override.
- During execution, AutoShow records Happy Scribe billing in `step2.billing` using `totalCost`, `creditsUsed`, `creditRateCents`, `source: "provider_quote"`, and `mode: "order"` when the selected organization reports `currency: "usd"`. Non-USD execution is rejected in v1. If exact provider billing is unavailable, AutoShow falls back to registry math with `source: "registry_fallback"`.
- Happy Scribe split runs submit one order per segment and merge segment billing into `step2.billing.mode: "segment_sum"`.

Supadata price estimates use provider credits.

- `--price` uses the published Basic/Pro auto-recharge reference rate of `$10 / 1,000 credits`, or `1.00 cents/credit`.
- `native` estimates as one transcript request credit. `generate` estimates generated transcript credits from media duration. `auto` is priced conservatively as the higher of one native transcript request credit or generated transcript credits from media duration.
- During execution, Supadata billing metadata records credit counts from provider response headers when available.

## STT Notes

- Before any hosted STT provider upload, AutoShow stages one shared stripped audio-only artifact. The default hosted artifact is mono AAC-LC in `.m4a` capped at 96 kbps, preserves the original sample rate, and drops cover art/chapters/metadata/extra streams. Low-bitrate mono `.m4a`/AAC and `.mp3` inputs stay on a stream-copy cleanup path instead of taking a second lossy encode. Supadata uses public source URLs instead of local uploads.
- Single-provider STT runs write root `transcription.txt` plus root `result.json`.
- Hosted multi-provider runs write one transcript and one canonical structured artifact per provider under `providers/<service>-<model>/`.
- `--youtube-captions` is English-only in v1 and only applies to YouTube inputs.
- For YouTube channels and playlists, `--youtube-captions` is evaluated per selected video in the batch. Use `--batch-all` when you want the full channel or playlist instead of the default batch limit.
- If captions are found, the selected STT providers are skipped for that item and the caption result becomes the transcript source.
- Caption-backed transcripts are recorded as service `youtube-captions` with model `subtitle-track` in pricing and manifest metadata.
- STT batch roots now include `stt-summary.json`, which records per-item caption-vs-STT routing alongside completion status.
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
