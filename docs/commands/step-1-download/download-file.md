# download

Download media or documents and collect metadata without running transcription, extraction, or LLM steps.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [Output](#output)
- [Examples](#examples)
- [Setup and Environment](#setup-and-environment)
- [Processing Step Layout](#processing-step-layout)

```bash
bun as download <input>
bun as dl <input>          # alias
```

## Supported Inputs

| Input | Behavior |
|-------|----------|
| YouTube / Twitch / TikTok URL | `yt-dlp` download, convert to WAV, collect media metadata |
| Direct media URL (`.mp3`, `.mp4`, etc.) | HTTP fetch, convert to WAV, collect media metadata |
| Direct document URL (`.pdf`, `.epub`, `.docx`, etc.) | HTTP fetch to a temp file, detect format, collect document metadata |
| Direct document URL without an extension | HEAD probe plus download + magic-byte detection |
| Local media file | ffmpeg convert to WAV, collect media metadata |
| Local document file | detect format by magic bytes first, then extension |
| YouTube channel URL | batch the latest videos |
| RSS / podcast feed URL | batch the latest episodes |
| URL list file (`.md` / `.txt`) | batch each listed input |
| Directory | batch each supported local input |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

MOBI, AZW3, FB2, and LIT inputs are normalized to EPUB through Calibre during step 1. The source format and conversion chain are recorded in `metadata.json`.

Step-1 metadata also includes `slug`, which is derived from the original filename without its final extension when available.

## Flags

```text
--password           Password for encrypted PDFs
--batch-limit        Batch: number of items to process (default 5)
--batch-all          Batch: process all items
--batch-order        Batch: item order newest|oldest (default newest)
--batch-concurrency  Batch: number of items to process concurrently (default 1)
```

## Output

**Media inputs**

```text
output/YYYY-MM-DD_HH-MM-SS_title/
  <audio>.wav
  metadata.json
```

**Document inputs**

```text
output/YYYY-MM-DD_HH-MM-SS_title/
  metadata.json
```

**Batch inputs**

```text
output/YYYY-MM-DD_HH-MM-SS_batch-label/
  source.json
  info.json   # consolidated per-item metadata.json payloads
  YYYY-MM-DD_HH-MM-SS_item/
    <artifacts for that item>
```

## Examples

```bash
# Download a YouTube video
bun as download https://www.youtube.com/watch?v=u1-WHqATSQU

# Download a local audio file
bun as download input/examples/audio/1-audio.mp3

# Download document metadata from a local PDF
bun as download input/examples/document/1-document.pdf

# Download 3 latest episodes from an RSS feed
bun as download https://example.com/feed --batch-limit 3

# Download 2 latest videos from a YouTube channel
bun as download https://www.youtube.com/@channelname --batch-limit 2

# Download all items from a URL list
bun as dl input/examples/document/2-urls.md --batch-all
```

## Setup and Environment

Setup details are centralized in [`setup.md`](../step-0-setup/setup.md).

For YouTube inputs, anonymous `yt-dlp` requests may be rate-limited or challenged. When that happens, configure `YTDLP_COOKIES_FROM_BROWSER`, `YTDLP_COOKIES`, or `YTDLP_EXTRACTOR_ARGS` in your environment before running `download` / `stt`.

## Processing Step Layout

Runtime processing steps and shared routing live under:

```text
src/cli/commands/process-steps/
  step-0-setup/
  step-1-download/
  step-2-stt/
  step-2-document/
  step-3-write/
  step-4-tts/
  step-5-image/
  step-6-video/
  step-7-music/
```
