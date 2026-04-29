# extract

Routes media to STT, documents/articles/images to OCR, and X/Twitter links to the X API for metadata extraction.

## Outline

- [Usage](#usage)
- [Supported Inputs](#supported-inputs)
- [STT Path](#stt-path)
- [OCR Path](#ocr-path)
- [X Space Path](#x-space-path)
- [STT Pricing And Manifests](#stt-pricing-and-manifests)
- [Notes](#notes)

## Usage

```bash
bun as extract [input] [flags]
```

Batch inputs use the same shared controls as other processing commands. The default batch limit is `5`; use `--batch-all` to process every discovered item.

For backfilling missing provider outputs from an existing run or batch, see [`resume`](../../setup-and-utilities/resume/resume.md).

## Supported Inputs

| Input | Route |
|-------|-------|
| YouTube, Twitch, or TikTok URLs | STT |
| Direct media URLs (`.mp3`, `.mp4`, `.wav`, `.webm`) | STT |
| Local media files | STT |
| PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODF, RTF, CSV, CBZ | OCR |
| PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF | OCR |
| Remote article URLs (`text/html`) | OCR (article backend) |
| Local `.html` / `.htm` files | OCR (defuddle) |
| X/Twitter Space URLs (`x.com/i/spaces/<id>`) | X Space |
| X/Twitter post URLs (`x.com/<handle>/status/<id>`) | X Space |
| Raw Space IDs (1-13 alphanumeric characters) | X Space |
| Directory batches | mixed routing |
| URL-list batches (`.md` / `.txt`) | mixed routing |
| RSS or podcast feed batches | STT |
| YouTube channel batches | STT |

---

## STT Path

Media inputs are downloaded and transcribed with local or hosted speech-to-text engines.

### STT Setup

```bash
# full setup
bun as setup

# verify gcloud CLI auth, active project, Speech-to-Text, Document AI, and Storage access
bun as setup --gcloud

# set or create the active gcloud project, link billing when possible,
# enable Speech-to-Text, Document AI, and Storage when billing is ready,
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

### STT Environment

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
| Google Cloud STT + Document AI OCR | gcloud CLI auth (`gcloud auth login`) plus active project with linked billing | STT project is read from `gcloud config`, STT location is fixed to `us`, and requests go to `us-speech.googleapis.com`; `bun as setup --gcloud --gcloud-project ...` provisions/verifies Google resources and prints runtime values without saving AutoShow defaults; env vars such as `AUTOSHOW_GCLOUD_PROJECT`, `AUTOSHOW_GCLOUD_DOCAI_LOCATION`, `AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID`, and `AUTOSHOW_GCLOUD_BUCKET` override saved config |
| AWS Transcribe | AWS CLI auth (`aws configure` or `AWS_PROFILE`) | `AWS_REGION` / `AWS_DEFAULT_REGION`; save `--aws-region` and `--aws-bucket` with `bun as config`, pass them per run, or run `bun as setup --aws --aws-create-bucket` to provision a staging bucket and print the values |
| Mistral | `MISTRAL_API_KEY` | - |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | `ASSEMBLYAI_BASE_URL` |
| Gladia | `GLADIA_API_KEY` | `GLADIA_BASE_URL` |

### STT Engines

#### Local

| Engine | Selection | Models / behavior |
|--------|-----------|-------------------|
| Whisper.cpp | default, or `--whisper <model>` | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Reverb | `--reverb` | diarized local transcription |

If no engine flag is provided, `extract` defaults to Whisper with the `tiny` model for media inputs.

#### Hosted

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

### STT Examples

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

### STT Flags

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

---

## OCR Path

Documents, images, and article-style HTML inputs route through local or hosted OCR paths.

### OCR Setup

```bash
# full setup
bun as setup

# document foundations: mutool + Calibre CLI tools
bun as setup --step calibre

# verify fixture-generation prerequisites
bun as setup --step sample
```

PaddleOCR can also be prepared lazily on first use:

```bash
bun as extract input/examples/document/1-document.pdf --paddle-ocr
```

`--epub-calibre` can also trigger lazy Calibre setup on supported platforms when the Calibre CLI tools are missing.

### OCR Environment

Use these only when you select the matching hosted engine or backend:

```bash
MISTRAL_API_KEY=...
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=...
ANTHROPIC_BASE_URL=https://api.anthropic.com
GEMINI_API_KEY=...
GLM_API_KEY=...
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
DEAPI_API_KEY=...
DEAPI_BASE_URL=https://api.deapi.ai
FIRECRAWL_API_KEY=...
FIRECRAWL_API_URL=http://localhost:3002
AUTOSHOW_URL_BACKEND=firecrawl
# or
AUTOSHOW_URL_BACKEND=glm-reader
```

`FIRECRAWL_API_KEY` is optional when `FIRECRAWL_API_URL` points at a self-hosted Firecrawl instance.

### OCR Routing

| Input family | Default path | Other available paths |
|--------------|--------------|-----------------------|
| PDF | `mutool+tesseract` | `--tesseract`, `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr`, `--openai-ocr`, `--anthropic-ocr`, `--gemini-ocr`, `--deapi-ocr` |
| EPUB | cleaned native extraction (`epub-text`) | `--tesseract`, `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr`, `--openai-ocr`, `--anthropic-ocr`, `--gemini-ocr`, `--deapi-ocr`, `--epub-bun`, `--epub-calibre` |
| MOBI / AZW3 / FB2 / LIT | normalize to EPUB, then follow the EPUB path | same |
| DOCX / PPTX / XLSX / ODF | native ZIP/XML text extraction | OCR flags are ignored with a warning |
| RTF | native RTF text extraction | OCR flags are ignored with a warning |
| CBZ | per-image OCR | local or hosted engines |
| CSV | raw text | OCR flags are ignored with a warning |
| Remote article URL | `html+defuddle` | `--url-backend firecrawl` or `--url-backend glm-reader` |
| Local `.html` / `.htm` | `html+defuddle` | hosted article backends are ignored with a warning |
| PNG / JPG / JPEG / TIF / TIFF | local OCR by default | hosted OCR also supported; `--gemini-ocr` and `--deapi-ocr` support PNG/JPG directly, and `--anthropic-ocr` / `--openai-ocr` / `--gemini-ocr` / `--deapi-ocr` can normalize TIF/TIFF to PNG when ImageMagick is available |
| WebP / BMP | normalize locally when possible, then OCR | `--openai-ocr`, `--anthropic-ocr`, `--gemini-ocr`, and `--deapi-ocr` support WebP directly; `--gemini-ocr` and `--deapi-ocr` support BMP directly and `--openai-ocr` / `--anthropic-ocr` can normalize BMP to PNG when ImageMagick is available |
| GIF | local OCR by default | `--openai-ocr`, `--anthropic-ocr`, and `--deapi-ocr` support GIF directly; `--gemini-ocr` can normalize GIF to PNG when ImageMagick is available |

### Article Backends

- `defuddle` is the default backend for article-like HTML inputs.
- Remote article URLs use `defuddle` unless you pass `--url-backend firecrawl`, `--url-backend glm-reader`, or set `AUTOSHOW_URL_BACKEND`.
- Local `.html` and `.htm` files always use `defuddle`, even if a hosted backend is requested.
- OCR engine flags do not apply to article extraction.
- If `defuddle` cannot extract meaningful content, the command suggests retrying with `--url-backend firecrawl`.

### EPUB Options

#### Inspect Modes

| Flag | Result |
|------|--------|
| `--epub-bun` | Inspect EPUB structure with the Bun ZIP/XML parser and write structured EPUB data into `run.json` |
| `--epub-calibre` | Inspect EPUB structure with Calibre and write the same structured EPUB shape into `run.json` |

- Inspect mode is metadata-only for EPUB inputs.
- If `--out` is set in inspect mode, it must be `json`.
- `--chapters` and `--length` are ignored in inspect mode.

#### Native EPUB Export

The default EPUB path writes cleaned native text instead of synthetic `Page N` output.

- `--chapters` writes one cleaned file per kept section under `chapters/`.
- `--length <n>` uses a hard limit of `n * 1000` characters and writes `chunks/` side artifacts.
- `--chapters --length <n>` splits oversized section files with `-part-NNN` suffixes.
- `--chapters` and `--length` are ignored for non-EPUB/non-PDF inputs and for EPUB runs that use a hosted OCR engine or image/PDF OCR path.

### PDF Chapter Detection

- `--chapters` on a PDF runs chapter autodetection and writes best-effort chapter files under `chapters/`.
- Detection is local-first by default and uses PDF bookmarks, TOC-like pages, printed-page-to-PDF-page mapping, and heading fallback.
- `--pdf-chapter-mode local` keeps detection fully heuristic and local.
- `--pdf-chapter-mode auto` starts local and only tries model assistance when the local result is weak and a default LLM is configured.
- `--pdf-chapter-mode llm` always attempts the model-assisted resolver after building the local evidence dossier.
- `--length <n>` only affects PDFs when `--chapters` is also set; it hard-splits oversized chapter files with `-part-NNN` suffixes.
- Detection diagnostics are written into `run.json` under `step2.pdfChapterDetection`, and the export summary is written under `step2.chapterExport`.

### OCR Examples

```bash
# Default PDF extraction
bun as extract input/examples/document/1-document.pdf

# JSON output
bun as extract input/examples/document/1-document.pdf --out json

# PDF chapter autodetection
bun as extract input/examples/document/3-document.pdf --chapters

# PDF chapter autodetection with model-assisted fallback
bun as extract input/examples/document/3-document.pdf --chapters --pdf-chapter-mode auto

# Native EPUB extraction plus chapter side artifacts
bun as extract input/examples/document/1-epub.epub --chapters

# Native EPUB chunk side artifacts at 50k characters
bun as extract input/examples/document/1-epub.epub --length 50

# OCRmyPDF path
bun as extract input/examples/document/1-document.pdf --ocrmypdf

# Paddle OCR path
bun as extract input/examples/document/1-document.pdf --paddle-ocr

# Explicit Tesseract path
bun as extract input/examples/document/1-document.pdf --tesseract

# Hosted OCR
bun as extract input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-2512
bun as extract input/examples/document/1-document.pdf --glm-ocr glm-ocr
bun as extract input/examples/document/1-document.pdf --openai-ocr gpt-5.4-nano
bun as extract input/examples/document/1-document.pdf --anthropic-ocr claude-haiku-4-5
bun as extract input/examples/document/1-document.pdf --gemini-ocr gemini-3.1-flash-lite-preview
bun as extract input/examples/document/1-document.pdf --aws-textract detect-text
bun as extract input/examples/document/1-document.pdf --gcloud-docai ocr
bun as extract input/examples/document/1-document.pdf --deapi-ocr Nanonets_Ocr_S_F16
bun as extract input/examples/document/1-document.png --deapi-ocr Nanonets_Ocr_S_F16
bun as extract input/examples/document/1-document.pdf --deapi-ocr Nanonets_Ocr_S_F16 --price

# Fan out across every OCR provider in price mode
bun as extract input/examples/document/1-document.pdf --all-ocr --price

# Remote article extraction
bun as extract https://ajcwebdev.com
bun as extract https://ajcwebdev.com --url-backend firecrawl

# Batch URL list extraction
bun as extract ./input/examples/batch/2-urls.md --batch-all

# Local HTML always uses defuddle
bun as extract ./input/article.html --out json

# EPUB inspect modes
bun as extract input/examples/document/1-epub.epub --epub-bun --out json
bun as extract input/examples/document/1-epub.epub --epub-calibre --out json
```

### OCR Flags

| Flag | Description |
|------|-------------|
| `--lang <codes>` | Tesseract language codes such as `eng` or `eng+fra` |
| `--out <format>` | Output format: `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--tesseract` | Use Tesseract explicitly |
| `--ocrmypdf` | Use OCRmyPDF |
| `--paddle-ocr` | Use PaddleOCR |
| `--mistral-ocr <model>` | Use Mistral OCR; omit the value to use the cheapest supported model |
| `--glm-ocr <model>` | Use GLM OCR; omit the value to use the cheapest supported model |
| `--openai-ocr <model>` | Use OpenAI OCR; omit the value to use the cheapest supported model |
| `--anthropic-ocr <model>` | Use Anthropic OCR; omit the value to use the cheapest supported model |
| `--gemini-ocr <model>` | Use Gemini OCR; omit the value to use the cheapest supported model |
| `--aws-textract <model>` | Use AWS Textract; `detect-text` for text-only ($1.50/1K pages) or `analyze-document` for tables/forms/layout ($15/1K pages) |
| `--gcloud-docai <model>` | Use Google Cloud Document AI; `ocr` for Enterprise Document OCR or `layout-parser` for Gemini-powered Layout Parser |
| `--deapi-ocr <model>` | Use deAPI OCR; omit the value to use `Nanonets_Ocr_S_F16` |
| `--all-ocr` | Enable every supported OCR provider/model for this command |
| `--dpi <n>` | Render DPI for OCR pages |
| `--psm <n>` | Tesseract page segmentation mode |
| `--oem <n>` | Tesseract OCR engine mode |
| `--page-separator <text>` | Custom page separator string |
| `--preserve-spaces` | Enable Tesseract `preserve_interword_spaces=1` |
| `--rotate <degrees>` | Rotate pages before OCR |
| `--chapters` | EPUB native text runs or PDF autodetection: write chapter files under `chapters/` |
| `--length <n>` | Hard export limit in thousands of characters; for EPUB alone writes `chunks/`, and with `--chapters` splits oversized EPUB or PDF chapter files |
| `--pdf-chapter-mode <mode>` | PDF chapter detection mode: `local`, `auto`, or `llm` |
| `--url-backend <backend>` | Article backend: `defuddle`, `firecrawl`, or `glm-reader` |
| `--epub-bun` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | Inspect EPUB structure with Calibre |
| `--price` | Show the aggregated OCR estimate and exit |

---

## X Space Path

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected and processed via the X v2 API. No special flags are needed.

### X Space Setup

Set the `X_BEARER_TOKEN` environment variable. Create a Bearer Token at [developer.x.com](https://developer.x.com/en/portal/dashboard).

### Supported URL Patterns

| Pattern | Example |
|---------|---------|
| Space URL | `https://x.com/i/spaces/<id>` |
| Twitter Space URL | `https://twitter.com/i/spaces/<id>` |
| Post URL (handle) | `https://x.com/<handle>/status/<id>` |
| Post URL (web) | `https://x.com/i/web/status/<id>` |
| Raw Space ID | `1DXxyRYNejbKM` (1-13 alphanumeric characters) |

Mobile (`mobile.x.com`, `mobile.twitter.com`) and www variants are also supported.

### X Space Examples

```bash
# Space URL
bun as extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# Twitter-era Space URL
bun as extract "https://twitter.com/i/spaces/1DXxyRYNejbKM"

# Post URL referencing a Space
bun as extract "https://x.com/user/status/1234567890"

# Raw Space ID (when no local file with that name exists)
bun as extract 1DXxyRYNejbKM
```

### X Space Output

X Space extraction writes three files to the output directory:

- `result.json` — full JSON artifact with Space metadata, user profiles, post references, sources, and error details
- `extraction.md` — Markdown report with summary table, Spaces table, posts table, and errors
- `run.json` — run manifest

### X Space Batch Support

X Space URLs work in batch input lists (`.md` / `.txt` files) alongside other URL types. Each URL is classified individually — YouTube URLs route to STT, document URLs route to OCR, and X URLs route to the X API:

```bash
bun as extract input/spaces.txt --batch-all
```

---

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

## OCR Pricing And Manifests

deAPI OCR uses provider quotes when possible.

- For local image preflight, `--price` calls the deAPI OCR price endpoint and records an exact estimate when `DEAPI_API_KEY` is available. For local PDFs, price mode renders pages to temporary PNGs and sums deAPI page quotes when possible.
- If exact deAPI OCR pricing is unavailable, AutoShow reports a non-zero heuristic from deAPI's published OCR output-character rate.
- During execution, deAPI OCR quotes each direct image or rendered PDF page before submission when the provider price endpoint is available. The summed quote is written to `run.json` as `providerCostCents` with `providerCostSource: "provider_quote"`.
- If quote lookup fails, deAPI OCR still runs and records a registry fallback cost.

## Notes

### STT Notes

- Before any hosted STT provider upload, Autoshow now stages one shared stripped audio-only artifact. The default hosted artifact is mono AAC-LC in `.m4a` capped at 96 kbps, preserves the original sample rate, and drops cover art/chapters/metadata/extra streams. Low-bitrate mono `.m4a`/AAC and `.mp3` inputs stay on a stream-copy cleanup path instead of taking a second lossy encode.
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

### OCR Notes

- Standalone `extract` document runs write the root extraction artifact (`extraction.txt` or `result.json`) plus `run.json`.
- EPUB export and PDF chapter autodetection write additive `chapters/` or `chunks/` side artifacts inside the same output directory.
- Supported document formats include PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, and CBZ.
- Supported image formats include PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, and GIF.
- Mistral OCR accepts PDF and standard images (`PNG`, `JPG`, `TIF`); GLM OCR accepts PDF plus `PNG` and `JPG`; OpenAI OCR accepts PDF plus `PNG`, `JPG`, `WEBP`, and `GIF` directly; Anthropic OCR accepts standard unencrypted PDFs plus `PNG`, `JPG`, `WEBP`, and `GIF` directly; Gemini OCR accepts PDF plus `PNG`, `JPG`, `WEBP`, and `BMP` directly; deAPI OCR accepts rendered PDF pages plus `PNG`, `JPG`, `JPEG`, `GIF`, `BMP`, and `WEBP` images directly.
- OpenAI OCR normalizes `BMP` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- Anthropic OCR normalizes `BMP` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- Anthropic OCR currently enforces the bundled Claude docs caps from `project/links/claude-all-links.md`: direct images up to 5 MB each, PDF chunk uploads through the Files API, and only standard unencrypted PDFs.
- Anthropic OCR splits PDFs into internal 10-page Files API uploads, sums token usage across chunks, and best-effort deletes uploaded files after each chunk run.
- Gemini OCR normalizes `GIF` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- deAPI OCR normalizes `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- GLM OCR currently enforces the bundled docs caps from `project/links/glm-all-links.md`: images up to 10 MB, PDFs up to 50 MB, and PDFs up to 100 pages.
- OpenAI OCR currently enforces the bundled PDF size cap from `project/links/openai-all-links.md`: PDFs up to 50 MB.
- Gemini OCR currently enforces the bundled docs caps from `project/links/gemini-all-links.md`: inline PDFs up to 50 MB, inline non-PDF inputs up to 100 MB, Files API uploads up to 2 GB per file, and PDFs up to 1000 pages.
- No numeric Mistral OCR or Firecrawl file-size/page-count caps were found in `project/links/all-all-links.md`, so this CLI does not enforce any new numeric limits for those providers from that source.
- Office inputs try native extraction first and only fall back to OCR when the extracted text quality is poor.
- Config defaults can persist chapter export settings under `defaults.extract.chapters`, `defaults.extract.length`, and `defaults.extract.pdfChapterMode`.
- Backfill existing OCR outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
- AWS Textract supports PDF, PNG, JPG, and TIFF natively. BMP, WebP, and GIF inputs are normalized to PNG via ImageMagick when available.
- AWS Textract uses the AWS CLI for authentication (`aws configure` or `AWS_PROFILE`/`AWS_REGION`). No separate API key is needed — it reuses the same AWS credentials as AWS STT.
- AWS Textract offers two models: `detect-text` for text-only extraction at $1.50 per 1,000 pages, and `analyze-document` for tables, forms, and layout extraction at $15 per 1,000 pages.
- Single-page images use the sync Textract API directly. PDFs and multi-page TIFF files use the async API via S3 staging, which requires an S3 bucket (pass `--aws-bucket`, save one with `bun as config`, or run `bun as setup --aws --aws-create-bucket` to create one and print the value).
- AWS Textract async supports files up to 500 MB and up to 3,000 pages per document.
- Google Cloud Document AI uses the OCR processor and GCS staging bucket from environment variables or explicitly saved config. `bun as setup --gcloud --gcloud-project PROJECT_ID` can create or discover those resources and print the values, but it does not update `config/autoshow.json`; `layout-parser` remains an explicit processor setup step unless you save `gcloudDocaiLayoutProcessorId` or set `AUTOSHOW_GCLOUD_DOCAI_LAYOUT_PROCESSOR_ID`.
- Tesseract tuning flags such as `--dpi`, `--psm`, `--oem`, `--rotate`, `--page-separator`, and `--preserve-spaces` work on the `extract` document/OCR route and on [`write`](../step-3-write/write-text.md).
- Non-Tesseract engines may ignore Tesseract-specific tuning flags and report a warning when they do.

### X Space Notes

- X Space extraction is only supported by the `extract` command. Other commands (`metadata`, `download`, `stt`, `ocr`, `write`) reject X links with a clear error.
- Post URLs that don't reference a Space still produce a report with the post metadata and an empty Spaces section.
- The X API has rate limits. Batch processing of many X URLs may encounter 429 responses.
