# setup

Install local runtimes and prerequisite tools. Sample fixture generation is handled by `sample`, not by `setup`.

## Outline

- [Step Setup Docs](#step-setup-docs)
- [Global Setup Command](#global-setup-command)
- [Doctor](#doctor)
- [YouTube Cookies](#youtube-cookies)
- [Targeted Setup Steps](#targeted-setup-steps)
- [Sample Fixtures](#sample-fixtures)

## Step Setup Docs

- Step 2 OCR: [`ocr-document.md#setup`](../step-2-ocr/ocr-document.md#setup)
- Step 2 STT: [`stt-audio.md#setup`](../step-2-stt/stt-audio.md#setup)
- Step 3 Write: [`write-text.md#setup`](../step-3-write/write-text.md#setup)
- Step 4 TTS: [`text-to-speech.md#setup`](../step-4-tts/text-to-speech.md#setup)
- Step 5 Image: [`text-to-image.md#setup`](../step-5-image/text-to-image.md#setup)
- Step 6 Video: [`text-to-video-services.md`](../step-6-video/text-to-video-services.md) for env/setup notes
- Step 7 Music: [`text-to-music-services.md`](../step-7-music/text-to-music-services.md) for env/setup notes
- Step 8 Lyrics: [`lyrics.md`](../step-8-lyrics/lyrics.md)

## Global Setup Command

```bash
bun as setup
```

Use full setup on a clean machine when you want local download, OCR, STT, write, or TTS workflows to work without manually installing their prerequisites first.

Check gcloud CLI readiness for Google Cloud Speech-to-Text separately:

```bash
bun as setup --gcloud
bun as setup --gcloud --gcloud-project PROJECT_ID
bun as setup --gcloud --gcloud-project PROJECT_ID --gcloud-billing-account ACCOUNT_ID
```

`bun as setup --gcloud` verifies the `gcloud` binary, Google Cloud CLI auth, the active project, project billing state, and whether `speech.googleapis.com` is enabled. `bun as setup --gcloud --gcloud-project PROJECT_ID` sets the active project or creates it when missing, auto-links billing when exactly one open billing account is visible, enables `speech.googleapis.com` when billing is ready, and saves `chirp_3` as the default Google STT model when no Google STT default has been saved yet. Use `--gcloud-billing-account ACCOUNT_ID` when multiple open billing accounts are available or when you want to force a specific billing account. When anything is still missing, setup prints the exact next-step commands to run.

Check AWS CLI readiness for Amazon Transcribe separately:

```bash
bun as setup --aws
```

This verifies the `aws` binary, AWS CLI auth, the effective region, the configured S3 bucket (when saved in AutoShow config), and basic Amazon Transcribe access. When auth and region are ready but no bucket is configured yet, `bun as setup --aws` now creates and saves a staging bucket automatically.

Force creation of a staging bucket or create a specific bucket name:

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

Reports the status of required tools (yt-dlp, ffmpeg, ffprobe, tesseract), API keys (including hosted extract keys such as `MISTRAL_API_KEY`, `GLM_API_KEY`, and `FIRECRAWL_API_KEY`), Google Cloud STT gcloud readiness, AWS CLI Transcribe readiness, config file validity, and Bun version.

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
uv | yt-dlp | whisper-binary | whisper-model | llama-binary | reverb | calibre | all | transcription | write | tts | image | lyrics | sample
```

Isolated steps assume their prerequisites are already present. On a clean machine, prefer `bun as setup`.

```bash
# Document foundations: mutool + Calibre CLI tools
bun as setup --step calibre

# Focus only on Google Cloud STT readiness
bun as setup --gcloud

# Set or create the Google Cloud project, link billing when possible,
# enable Speech-to-Text, and save the default Google STT model
bun as setup --gcloud --gcloud-project PROJECT_ID

# Force a specific Google Cloud billing account during bootstrap
bun as setup --gcloud --gcloud-project PROJECT_ID --gcloud-billing-account ACCOUNT_ID

# Focus only on AWS CLI Transcribe readiness
bun as setup --aws

# Create and save an AWS Transcribe staging bucket automatically
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

# Verify ffmpeg/ffprobe, ensure whisper-cli, and download large-v3-turbo.
# Also confirms either ffmpeg ass-filter support or the pango-view + ImageMagick fallback renderer.
bun as setup --step lyrics

# Verify fixture-generation prerequisites (ffmpeg, ffprobe, soffice)
bun as setup --step sample

# Remove existing artifacts before re-downloading
bun as setup --step write --force-redownload

# Benchmark a setup step
bun as setup --step tts --repeat 3
```

## Sample Fixtures

```bash
# Generate fixtures under input/samples/
bun as sample

# Verify an existing manifest without regenerating
bun as sample --verify-only

# Regenerate fixtures even if the manifest is valid
bun as sample --refresh
```

See [`sample.md`](../../setup-and-utilities/sample/sample.md) for the full `sample` command reference.
