# setup

Install local runtimes and prerequisite tools. Sample fixture generation is handled by `sample`, not by `setup`.

## Outline

- [Step Setup Docs](#step-setup-docs)
- [Global Setup Command](#global-setup-command)
- [Doctor](#doctor)
- [Targeted Setup Steps](#targeted-setup-steps)
- [Sample Fixtures](#sample-fixtures)

## Step Setup Docs

- Step 2 Extract: [`extract-document-local.md#setup`](../step-2-extract/extract-document-local.md#setup)
- Step 2 Transcribe: [`transcribe-audio-local.md#setup`](../step-2-transcribe/transcribe-audio-local.md#setup)
- Step 3 Write: [`write-text-local.md#setup`](../step-3-write/write-text-local.md#setup)
- Step 4 TTS: [`text-to-speech-local.md#setup`](../step-4-tts/text-to-speech-local.md#setup)
- Step 5 Image: [`text-to-image-setup.md`](../step-5-image/text-to-image-setup.md)
- Step 6 Video: [`text-to-video-services.md`](../step-6-video/text-to-video-services.md) for env/setup notes
- Step 7 Music: [`text-to-music-services.md`](../step-7-music/text-to-music-services.md) for env/setup notes

## Global Setup Command

```bash
bun as setup
```

Use full setup on a clean machine when you want local download, extract, transcribe, write, or TTS workflows to work without manually installing their prerequisites first.

## Doctor

Check prerequisites, API keys, and configuration without installing anything:

```bash
bun as setup --doctor
```

Reports the status of required tools (yt-dlp, ffmpeg, ffprobe, tesseract), API keys, config file validity, and Bun version.

## Targeted Setup Steps

The `setup` command currently supports:

```text
uv | yt-dlp | whisper-binary | whisper-model | llama-binary | reverb | calibre | all | transcription | write | tts | image | sample
```

Isolated steps assume their prerequisites are already present. On a clean machine, prefer `bun as setup`.

```bash
# Document foundations: mutool + Calibre CLI tools
bun as setup --step calibre

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

# Alias
bun as samples

# Verify an existing manifest without regenerating
bun as sample --verify-only

# Regenerate fixtures even if the manifest is valid
bun as sample --refresh
```

See [`sample.md`](../sample/sample.md) for the full `sample` command reference.
