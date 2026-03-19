# setup

Install local dependencies and generate test fixtures.

## Outline

- [Step Setup Docs](#step-setup-docs)
- [Global Setup Command](#global-setup-command)
- [Common setup steps](#common-setup-steps)
- [Sample fixture generation](#sample-fixture-generation)

## Step Setup Docs

- Step 2 Extract: [`extract-document-setup.md`](../step-2-extract/extract-document-setup.md)
- Step 2 Transcribe: [`transcribe-audio-setup.md`](../step-2-transcribe/transcribe-audio-setup.md)
- Step 3 Write: [`write-text-setup.md`](../step-3-write/write-text-setup.md)
- Step 4 TTS: [`text-to-speech-setup.md`](../step-4-tts/text-to-speech-setup.md)
- Step 5 Image: [`text-to-image-setup.md`](../step-5-image/text-to-image-setup.md)
- Step 6 Video: [`text-to-video-services.md`](../step-6-video/text-to-video-services.md)
- Step 7 Music: [`text-to-music-services.md`](../step-7-music/text-to-music-services.md)

## Global Setup Command

```bash
bun as setup
```

## Common setup steps

```bash
# Step 1 download foundations (documents): mutool + Calibre CLI tools
bun as setup --step calibre

# Verify sample fixture generation prerequisites (ffmpeg, libreoffice)
bun as setup --step sample
```

## Sample fixture generation

```bash
# Generate all test fixtures under input/samples/
bun as sample

# Alias
bun as samples

# Verify existing fixtures without regenerating
bun as sample --verify-only

# Force regeneration
bun as sample --refresh
```

See [`sample.md`](../sample/sample.md) for the full `sample` command reference.

Use the per-step setup docs above for setup subcommands, environment variables, and test prerequisites.
