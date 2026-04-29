# setup

Install local runtimes and prerequisite tools. Focused setup utilities also cover fixture generation (`--sample`) and model pre-downloads (`--models`).

## Outline

- [Step Setup Docs](#step-setup-docs)
- [Global Setup Command](#global-setup-command)
- [Doctor](#doctor)
- [YouTube Cookies](#youtube-cookies)
- [Targeted Setup Steps](#targeted-setup-steps)
- [Sample Fixtures](#sample-fixtures)

## Step Setup Docs

- Step 2 extract: [`01-extract.md`](../step-2-extract/01-extract.md) — [STT setup](../step-2-extract/02-extract-stt.md#stt-setup) | [OCR setup](../step-2-extract/03-extract-ocr.md#ocr-setup) | [X Space setup](../step-2-extract/04-extract-url.md#x-space-setup)
- Step 3 Write: [`write-text.md#setup`](../step-3-write/write-text.md#setup)
- Step 4 TTS: [`text-to-speech.md#setup`](../step-4-tts/text-to-speech.md#setup)
- Step 5 Image: [`text-to-image.md#setup`](../step-5-image/text-to-image.md#setup)
- Step 6 Video: [`text-to-video-services.md`](../step-6-video/text-to-video-services.md) for env/setup notes
- Step 7 Music: [`text-to-music-services.md`](../step-7-music/text-to-music-services.md) for env/setup notes

## Global Setup Command

```bash
bun as setup
```

Use full setup on a clean machine when you want local download, OCR, STT, write, or TTS workflows to work without manually installing their prerequisites first.

Check gcloud CLI readiness for Google Cloud Speech-to-Text and Document AI OCR separately:

```bash
bun as setup --gcloud
bun as setup --gcloud --gcloud-project PROJECT_ID
bun as setup --gcloud --gcloud-project PROJECT_ID --gcloud-billing-account ACCOUNT_ID
```

`bun as setup --gcloud` verifies the `gcloud` binary, Google Cloud CLI auth, the active project, project billing state, and whether `speech.googleapis.com`, `documentai.googleapis.com`, and `storage.googleapis.com` are enabled. `bun as setup --gcloud --gcloud-project PROJECT_ID` sets the active project or creates it when missing, auto-links billing when exactly one open billing account is visible, enables the required APIs when billing is ready, creates or reuses an `autoshow-ocr` Document AI OCR processor in `us`, creates or verifies a GCS staging bucket for batch OCR, and prints the runtime values to use. It does not save Google defaults to `config/autoshow.json`; use `bun as config --gcloud-stt chirp_3 --gcloud-docai ocr` for model defaults and set the printed environment values when you want reusable Document AI runtime settings. Use `--gcloud-billing-account ACCOUNT_ID` when multiple open billing accounts are available or when you want to force a specific billing account. When anything is still missing, setup prints the exact next-step commands to run.

Check AWS CLI readiness for Amazon Transcribe separately:

```bash
bun as setup --aws
```

This verifies the `aws` binary, AWS CLI auth, the effective region, the configured S3 bucket (when passed or saved explicitly), and basic Amazon Transcribe access. It does not create a bucket or save AWS defaults to `config/autoshow.json`.

Create a staging bucket or create a specific bucket name:

```bash
bun as setup --aws --aws-create-bucket
```

You can optionally pin the region or bucket name:

```bash
bun as setup --aws --aws-create-bucket --aws-region us-east-2
bun as setup --aws --aws-create-bucket --aws-region us-east-2 --aws-bucket my-transcribe-bucket
```

## Doctor

Check prerequisites, API keys, and configuration without installing anything:

```bash
bun as setup --doctor
```

Reports the status of required tools (yt-dlp, ffmpeg, ffprobe, tesseract), API keys (including hosted write keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `MINIMAX_API_KEY`, `XAI_API_KEY`, and `GLM_API_KEY`, hosted extract keys such as `MISTRAL_API_KEY`, `GLM_API_KEY`, `DEEPINFRA_API_KEY`, and `FIRECRAWL_API_KEY`, hosted STT keys such as `DEEPINFRA_API_KEY`, `DEAPI_API_KEY`, and `XAI_API_KEY`, hosted TTS keys such as `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, and `RUNWAYML_API_SECRET`, and generation keys such as `XAI_API_KEY`, `RUNWAYML_API_SECRET`, `BFL_API_KEY`, and `MINIMAX_API_KEY`), Google Cloud STT + Document AI OCR gcloud readiness, AWS CLI Transcribe readiness, config file validity, and Bun version.

Doctor also reports YouTube cookie state separately:

- active mode: `cookies-file`, `cookies-from-browser`, or `none`
- cookie-file readability when `YTDLP_COOKIES` is configured

## YouTube Cookies

If YouTube starts challenging anonymous `yt-dlp` requests, configure cookies using the step-by-step guide in [docs/cookies.md](../../../cookies.md).

The same precedence rules apply everywhere in the CLI:

1. `YTDLP_COOKIES` wins when it is set and readable.
2. Otherwise `YTDLP_COOKIES_FROM_BROWSER` is used.
3. If `YTDLP_COOKIES` is set but unreadable, AutoShow warns and does not fall back silently.

## Targeted Setup Steps

The `setup` command currently supports:

```text
uv | yt-dlp | whisper-binary | whisper-model | llama-binary | reverb | calibre | all | transcription | write | tts | image | video | music | sample
```

Isolated steps assume their prerequisites are already present. On a clean machine, prefer `bun as setup`.

```bash
# Document foundations: mutool + Calibre CLI tools
bun as setup --step calibre

# Focus only on Google Cloud STT + Document AI OCR readiness
bun as setup --gcloud

# Set or create the Google Cloud project, link billing when possible,
# enable Speech-to-Text, Document AI, and Storage, then print runtime values
bun as setup --gcloud --gcloud-project PROJECT_ID

# Force a specific Google Cloud billing account during bootstrap
bun as setup --gcloud --gcloud-project PROJECT_ID --gcloud-billing-account ACCOUNT_ID

# Focus only on AWS CLI Transcribe readiness
bun as setup --aws

# Create an AWS Transcribe staging bucket and print the values to use
bun as setup --aws --aws-create-bucket

# Build whisper.cpp binary only
bun as setup --step whisper-binary

# Download the default whisper model only
bun as setup --step whisper-model

# Download large-v3-turbo + Reverb assets
bun as setup --step transcription

# Install llama.cpp and download all supported local write models
bun as setup --step write

# Install Kitten TTS and download all supported local TTS models
bun as setup --step tts

# Image providers are API-based, so this is effectively a no-op confirmation step
bun as setup --step image

# Video providers are API-based, so this checks hosted provider API-key readiness
bun as setup --step video

# Check hosted music API-key readiness, including GEMINI_API_KEY for Lyria,
# verify ffmpeg/ffprobe, ensure whisper-cli,
# and download large-v3-turbo for lyric-video rendering.
bun as setup --step music

# Verify fixture-generation prerequisites (ffmpeg, ffprobe)
bun as setup --step sample

# Remove existing artifacts before re-downloading
bun as setup --step write --force-redownload

# Benchmark a setup step
bun as setup --step tts --repeat 3
```

## Sample Fixtures

```bash
# Generate fixtures under input/samples/
bun as setup --sample

# Verify an existing manifest without regenerating
bun as setup --sample --verify-only

# Regenerate fixtures even if the manifest is valid
bun as setup --sample --refresh

# Download a Whisper or llama.cpp model without running inference
bun as setup --models base
bun as setup --models ggml-org/gemma-3-270m-it-GGUF
```

See [`sample.md`](../../setup-and-utilities/sample/sample.md) for the focused `setup --sample` reference.
