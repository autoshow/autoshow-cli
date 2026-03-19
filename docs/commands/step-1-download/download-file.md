# download

Download media or documents and collect metadata without running transcription, extraction, or LLM steps.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [Output](#output)
- [Examples](#examples)
- [Setup and environment](#setup-and-environment)
- [Processing Step Layout](#processing-step-layout)

```bash
bun as download <input>
bun as dl <input>          # alias
```

## Supported Inputs

| Input | Behavior |
|-------|----------|
| YouTube/Twitch URL | yt-dlp download, convert to WAV, collect video metadata |
| Direct media URL (.mp3, .mp4, etc.) | HTTP fetch, convert to WAV, collect metadata |
| Direct document URL (.pdf, .epub, .docx, etc.) | HTTP fetch to temp file, detect format, extract document metadata |
| Direct document URL (no extension) | HEAD probe for `content-type`/`content-disposition`; falls back to download + magic-byte detection |
| Local media file | ffmpeg convert to WAV, collect metadata |
| Local document file | Format detected by magic bytes first, then extension; see supported formats below |
| YouTube channel URL | Batch download latest videos (use `--batch-limit`) |
| RSS/podcast feed URL | Batch download latest episodes (use `--batch-limit`) |
| .md/.txt URL list | Batch process each URL |
| Directory | Batch process each supported file |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

MOBI/AZW3/FB2/LIT inputs are automatically normalized to EPUB via Calibre during step 1. The source format and conversion chain are recorded in `metadata.json`.

## Flags

```
--password           Password for encrypted PDFs
--batch-limit        Number of items to process in batch mode (default 5)
--batch-all          Process all items in batch mode
--batch-order        Item order: newest|oldest (default newest)
--batch-concurrency  Concurrent items in batch mode (default 1)
```

## Output

**Media (YouTube, direct URL, local file):**
```
output/YYYY-MM-DD_HH-MM-SS_title/
├── YYYY-MM-DD-title.wav       # Downloaded & converted audio
└── metadata.json              # { step1: Step1Metadata }
```

**Documents (PDF, EPUB, DOCX, MOBI, RTF, CSV, CBZ, images, etc.):**
```
output/YYYY-MM-DD_HH-MM-SS_title/
└── metadata.json              # { step1: DocumentMetadata }
```

**Batch (YouTube channel, RSS feed, URL list, directory):**
```
output/YYYY-MM-DD_HH-MM-SS_batch-label/
├── source.json                # Batch source metadata
├── info.json                  # Per-item info
└── YYYY-MM-DD_HH-MM-SS_item/
    ├── *.wav
    └── metadata.json
```

## Examples

```bash
# Download a YouTube video
bun as download https://www.youtube.com/watch?v=VIDEO_ID

# Download a local audio file
bun as download input/1-audio.mp3

# Download document metadata from a local PDF
bun as download input/1-document.pdf

# Download 3 latest episodes from an RSS feed
bun as download https://example.com/feed --batch-limit 3

# Download 2 latest videos from a YouTube channel
bun as download https://www.youtube.com/@channelname --batch-limit 2

# Download all items from a URL list
bun as dl urls.md --batch-all
```

## Setup and environment

For setup command usage, model pre-downloads, environment variables, setup module layout, and runtime/output directory structure, see:

- [`setup.md`](../step-0-setup/setup.md)

## Processing Step Layout

Runtime processing steps and shared routing live under the current CLI step layout:

```text
src/cli/commands/process-steps/
  step-0-setup/
    setup-orchestrator/
  step-1-download/
    audio/
    document/
    setup-download/
    targets/
  step-2-stt/
    stt-local/
    stt-services/
  step-2-document/
    document-local/
    document-services/
    epub/
  step-3-write/
    write-local/
    write-services/
    structured-output/
  step-4-tts/
    tts-local/
    tts-services/
  step-5-image/
    image-services/
  step-6-video/
    video-services/
  step-7-music/
    music-services/
```
