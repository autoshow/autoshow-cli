# extract STT

Media inputs are downloaded and transcribed with local or hosted speech-to-text engines.

## Outline

- [STT Setup](#stt-setup)
- [STT Environment](#stt-environment)
- [Shared STT Options](#shared-stt-options)
- [URL/streaming/source-URL STT](#urlstreamingsource-url-stt)
  - [Happy Scribe](#happy-scribe)
  - [Supadata](#supadata)
  - [ScrapeCreators](#scrapecreators)
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
  - [AssemblyAI](#assemblyai)
- [Transcript Videos](#transcript-videos)
- [STT Pricing And Manifests](#stt-pricing-and-manifests)
- [STT Notes](#stt-notes)

See the [`extract` overview](./01-extract.md) for input routing across STT, OCR, article HTML, and X/Twitter inputs.

If no engine flag is provided, `extract` defaults to local Whisper.cpp with the `tiny` model for media inputs. `--provider` selectors accept an omitted model value and then resolve to the cheapest or default supported model. Model-selecting selectors are repeatable, including repeated selectors from the same provider.

The standalone `extract` command uses route-aware `--provider provider[=model]` selectors. The `write` and `config` commands use the step selector `--stt provider[=model]`; `resume` uses target-aware `--provider provider[=model]`.

## STT Setup

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

## STT Environment

| Provider | Required env | Optional override |
|----------|--------------|-------------------|
| Groq | `GROQ_API_KEY` | - |
| Grok STT | `XAI_API_KEY` | `XAI_BASE_URL` |
| DeepInfra | `DEEPINFRA_API_KEY` | `DEEPINFRA_BASE_URL` |
| Together | `TOGETHER_API_KEY` | `TOGETHER_BASE_URL` |
| Happy Scribe | `HAPPYSCRIBE_API_KEY` | `HAPPYSCRIBE_BASE_URL`, `HAPPYSCRIBE_ORGANIZATION_ID` |
| Supadata | `SUPADATA_API_KEY` | `SUPADATA_BASE_URL` |
| ScrapeCreators | `SCRAPECREATORS_API_KEY` | `SCRAPECREATORS_BASE_URL` |
| ElevenLabs | `ELEVENLABS_API_KEY` | - |
| Deepgram | `DEEPGRAM_API_KEY` | `DEEPGRAM_BASE_URL` |
| Soniox | `SONIOX_API_KEY` | `SONIOX_BASE_URL` |
| Speechmatics | `SPEECHMATICS_API_KEY` | `SPEECHMATICS_BASE_URL` |
| Rev | `REVAI_ACCESS_TOKEN` | `REVAI_BASE_URL` |
| OpenAI STT | `OPENAI_API_KEY` | `OPENAI_BASE_URL` |
| Gemini STT | `GEMINI_API_KEY` | - |
| GLM STT | `GLM_API_KEY` | `GLM_BASE_URL` |
| Mistral | `MISTRAL_API_KEY` | - |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | `ASSEMBLYAI_BASE_URL` |
| Gladia | `GLADIA_API_KEY` | `GLADIA_BASE_URL` |

## Shared STT Options

| Flag | Description |
|------|-------------|
| `--all-providers` | Enable every broadly applicable STT provider/model for this route; YouTube-only ScrapeCreators is excluded |
| `--youtube-captions` | Prefer English YouTube captions before STT when available; falls back to the selected STT provider path |
| `--speaker-count <n>` | Diarization speaker-count hint for supported services |
| `--split` | Split audio into 30-minute segments before transcription |
| `--prompt <name...>` | Named prompt presets discovered recursively under `src/prompts/entries/` |
| `--prompt-md` | Save a second prompt file (`prompt-md.md`) with markdown examples alongside the JSON prompt |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest\|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |
| `--provider-concurrency <n>` | Max cloud providers running in parallel for one item |
| `--local-concurrency <n>` | Max local providers running in parallel for one item |
| `--stt-segment-concurrency <n>` | Max split segments in flight per provider |
| `--stt-preflight-concurrency <n>` | Max duration probes running in parallel during preflight |
| `--refresh-cache` | Rebuild STT cache entries touched by this run |
| `--no-cache` | Bypass the media cache for this run |
| `--price` | Show the aggregated estimate and exit |

```bash
# Prefer YouTube captions, then fall back to STT
bun as extract https://www.youtube.com/watch?v=MORMZXEaONk --youtube-captions --provider deepgram=nova-3

# Split a long file before transcription
bun as extract https://ajc.pics/autoshow/examples/2-video.mp4 --provider whisper=large-v3-turbo --split

# Process a whole YouTube channel batch with caption-first routing
bun as extract https://www.youtube.com/@channelname --youtube-captions --batch-all
```


## Transcript Videos

`extract --transcript-video` renders a local MP4 from existing STT artifacts. It does not call an STT provider. The normal path is a media extract output directory; AutoShow reads its `run.json`, infers the saved audio file, and renders the root `result.json` or the single completed provider result. Multi-provider runs with more than one result require `--transcript-result`.

```bash
# render from a completed media extract directory
bun as extract output/<extract-run-dir> --transcript-video

# choose one provider result from a multi-provider extract run
bun as extract output/<extract-run-dir> --transcript-video --transcript-result output/<extract-run-dir>/providers/deepgram-nova-3/result.json

# render from explicit files without an extract run directory
bun as extract --transcript-video --audio https://ajc.pics/autoshow/examples/1-audio.mp3 --transcript-result output/<extract-run-dir>/result.json

# render from the timestamped text transcript format
bun as extract --transcript-video --audio https://ajc.pics/autoshow/examples/1-audio.mp3 --transcript-text output/<extract-run-dir>/transcription.txt
```

The output directory contains `<label>.mp4`, `<label>.vtt`, `<label>.srt`, and `run.json`. Speaker labels from `result.json` or `[HH:MM:SS] [speaker] text` transcript lines are preserved in the rendered video and caption files. The renderer uses the same fixed 1920x1080 local ffmpeg pipeline as lyric videos, with `--font` and `--keep-tmp` available for transcript-video rendering.

## URL/streaming/source-URL STT

These services either work best with provider-side URLs or have source-URL-specific behavior.

### Happy Scribe

| Option | Value |
|--------|-------|
| Selector | `--provider happyscribe[=<model>]` |
| Models | `auto` |
| Organization | `--stt-happyscribe-organization-id <id>` |
| Language | Fixed to `en-US` in v1 |
| Diarization | Enabled by default; `--speaker-count` is ignored |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe --stt-happyscribe-organization-id org_123
```

Organization resolution order is CLI `--stt-happyscribe-organization-id`, config default, `HAPPYSCRIBE_ORGANIZATION_ID`, then auto-select only when the API key can access exactly one organization. Non-English audio and multilingual audio are unsupported and may produce poor transcripts.

### Supadata

| Option | Value |
|--------|-------|
| Selector | `--provider supadata=auto` |
| Language | `--stt-supadata-lang <code>` when a native transcript is available |
| Required env | `SUPADATA_API_KEY` |
| Optional env | `SUPADATA_BASE_URL` |
| Input support | Public YouTube, TikTok, Instagram, X/Twitter, Facebook, or direct media/file URLs |

```bash
bun as extract https://www.youtube.com/watch?v=MORMZXEaONk --provider supadata=auto --stt-supadata-lang en
bun as extract https://www.tiktok.com/@example/video/1234567890 --provider supadata=auto
bun as extract https://example.com/audio/interview.mp3 --provider supadata=auto --price
```

Supadata requires a public source URL and cannot transcribe local file inputs through the AutoShow CLI. AutoShow exposes only Supadata `auto` mode: it tries provider-native transcripts first and generates a transcript when needed. Supadata treats direct media/file URLs as generated transcripts. `--stt-supadata-lang` is sent with the auto request, but generated transcripts ignore that flag.

### ScrapeCreators

| Option | Value |
|--------|-------|
| Selector | `--provider scrapecreators=youtube-transcript` |
| Language | `--stt-scrapecreators-lang <code>`, default `en` |
| Required env | `SCRAPECREATORS_API_KEY` |
| Optional env | `SCRAPECREATORS_BASE_URL` |
| Input support | Public `youtube.com` and `youtu.be` URLs only |

```bash
bun as extract "https://www.youtube.com/watch?v=MORMZXEaONk" --provider scrapecreators=youtube-transcript
bun as extract https://youtu.be/dQw4w9WgXcQ --provider scrapecreators=youtube-transcript --stt-scrapecreators-lang es
```

ScrapeCreators is transcript retrieval, not general audio transcription. AutoShow calls `GET /v1/youtube/video/transcript` with the source URL and requested language, then normalizes returned timed transcript entries into `transcription.txt` and structured STT artifacts. It does not replace `--youtube-captions`; use ScrapeCreators when you want it as an explicit paid provider in the same target set as other STT providers.


### Gladia

| Option | Value |
|--------|-------|
| Selector | `--provider gladia[=<model>]` |
| Models | `default` |
| Diarization | Supports exact `--speaker-count` hints |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia=default
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia --speaker-count 2
```

## Non-diarized STT

These providers are documented as single-speaker or non-diarized in the CLI.

### Whisper.cpp

| Option | Value |
|--------|-------|
| Selector | default, or `--provider whisper[=<model>]` |
| Models | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Runtime | Local `whisper.cpp` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisper=large-v3-turbo
```

### Groq

| Option | Value |
|--------|-------|
| Selector | `--provider groq[=<model>]` |
| Models | `whisper-large-v3-turbo`, `whisper-large-v3` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq
```

### DeepInfra

| Option | Value |
|--------|-------|
| Selector | `--provider deepinfra[=<model>]` |
| Models | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra
```

### Together

| Option | Value |
|--------|-------|
| Selector | `--provider together[=<model>]` |
| Models | `openai/whisper-large-v3` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together
```

### OpenAI STT

| Option | Value |
|--------|-------|
| Selector | `--provider openai[=<model>]` |
| Models | `gpt-4o-mini-transcribe`, `gpt-4o-transcribe` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider openai=gpt-4o-mini-transcribe
```

### Gemini STT

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3-flash-preview` |
| Behavior | Prompted JSON transcription via Gemini multimodal input |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

### GLM STT

| Option | Value |
|--------|-------|
| Selector | `--provider glm[=<model>]` |
| Models | `glm-asr-2512` |
| Behavior | Single-speaker transcription with a 30-second auto-split policy |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider glm
```

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `voxtral-mini-2602` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider mistral
```

Mistral STT follows the current documented Voxtral Mini Transcribe 2 limits: up to 500 MB per audio transcription request and approximately 3 hours of audio per request. Requests are internally serialized across batch items and split segments to reduce provider-side rate limits.

## Diarized STT

These engines either support diarization directly or AutoShow enables diarization for them.

### Reverb

| Option | Value |
|--------|-------|
| Selector | `--provider reverb` |
| Style | `--stt-reverb-verbatimicity <0-1>` |
| Runtime | Local diarized transcription |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider reverb --stt-reverb-verbatimicity 0.5
```

### Grok STT

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `speech-to-text` |
| Behavior | REST STT with formatted output, word timestamps, and diarization enabled |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text
```

Grok STT sends `format=true`, `language=en`, and `diarize=true` to xAI's REST STT endpoint and records word timing, confidence, and speaker evidence when the response includes it.

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--provider elevenlabs[=<model>]` |
| Models | `scribe_v2` |
| Diarization | Supports `--speaker-count` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider elevenlabs=scribe_v2 --speaker-count 2
```

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--provider deepgram[=<model>]` |
| Models | `nova-3` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3
```

### Soniox

| Option | Value |
|--------|-------|
| Selector | `--provider soniox[=<model>]` |
| Models | `stt-async-v4` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider soniox
```

### Speechmatics

| Option | Value |
|--------|-------|
| Selector | `--provider speechmatics[=<model>]` |
| Models | `standard`, `enhanced` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=standard --provider speechmatics=enhanced
```

### Rev

| Option | Value |
|--------|-------|
| Selector | `--provider rev[=<model>]` |
| Models | `machine`, `low_cost` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider rev=low_cost
```

### AssemblyAI

| Option | Value |
|--------|-------|
| Selector | `--provider assemblyai[=<model>]` |
| Models | `universal-3-pro` |
| Diarization | Supports `--speaker-count` |

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai
```

## STT Pricing And Manifests



Happy Scribe price preflight is intentionally side-effect free.

- `--price` never creates Happy Scribe uploads or draft orders. Preflight uses the published AI rate of `$0.01/min` and the local timing registry.
- If preflight cannot resolve a unique organization, AutoShow still prints the generic estimate. Execution needs an explicit organization override before exact billing can be captured.
- During execution, AutoShow records Happy Scribe billing in `step2.billing` using `totalCost`, `creditsUsed`, `creditRateCents`, `source: "provider_quote"`, and `mode: "order"` when the selected organization reports `currency: "usd"`. Non-USD execution is rejected in v1. If exact provider billing is unavailable, AutoShow falls back to registry math with `source: "registry_fallback"`.
- Happy Scribe split runs submit one order per segment and merge segment billing into `step2.billing.mode: "segment_sum"`.

Supadata price estimates use provider credits.

- `--price` uses the published Basic/Pro auto-recharge reference rate of `$10 / 1,000 credits`, or `1.00 cents/credit`.
- `native` estimates one transcript request credit, including transcript-unavailable responses.
- `generate` estimates AI generation from media duration at roughly `2 credits/min`.
- `auto` is priced conservatively as the higher of one native transcript request credit or generated transcript credits from media duration.
- Direct media/file URLs are treated as generated transcripts by Supadata, so they estimate from media duration even when `auto` is selected.
- Published credit pricing can vary by plan, billing setup, promotions, or enterprise terms; AutoShow's preflight uses the Basic/Pro auto-recharge reference rate for consistency.
- During execution, Supadata billing metadata records credit counts from provider response headers when available.

ScrapeCreators price estimates use one fixed transcript-request credit.

- `--price` uses the published Freelance reference rate of `$47 / 25,000 credits`, or `0.188` cents per YouTube transcript request.
- Business pricing is lower at `$497 / 500,000 credits`, or `0.0994` cents per request, but AutoShow does not use that as the default estimator.
- Estimates and actual fallback billing ignore media duration because ScrapeCreators charges the retrieval request, not transcription minutes.

## STT Notes

- Before any hosted STT provider upload, AutoShow stages one shared stripped audio-only artifact. The default hosted artifact is mono AAC-LC in `.m4a` capped at 96 kbps, preserves the original sample rate, and drops cover art/chapters/metadata/extra streams. Low-bitrate mono `.m4a`/AAC and `.mp3` inputs stay on a stream-copy cleanup path instead of taking a second lossy encode. Supadata and ScrapeCreators use public source URLs instead of local uploads.
- Single-provider local/upload STT runs write root `transcription.txt` plus root `result.json`; URL transcript retrieval providers write under their provider directory.
- Hosted multi-provider runs write one transcript and one canonical structured artifact per provider under `providers/<service>-<model>/`.
- `--youtube-captions` is English-only in v1 and only applies to YouTube inputs.
- For YouTube channels and playlists, `--youtube-captions` is evaluated per selected video in the batch. Use `--batch-all` when you want the full channel or playlist instead of the default batch limit.
- If captions are found, the selected STT providers are skipped for that item and the caption result becomes the transcript source.
- Caption-backed transcripts are recorded as service `youtube-captions` with model `subtitle-track` in pricing and manifest metadata.
- STT batch roots now include `stt-summary.json`, which records per-item caption-vs-STT routing alongside completion status.
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
