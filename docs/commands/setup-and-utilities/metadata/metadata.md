# metadata

Collect and display metadata for media or documents without downloading files, running transcription, extraction, or LLM steps.

This is the most fundamental command in the pipeline hierarchy: `metadata` → `download` → `extract` → `write`.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [Output](#output)
- [Examples](#examples)
- [How It Works](#how-it-works)
- [Processing Step Layout](#processing-step-layout)

```bash
bun as metadata <input>
```

## Supported Inputs

| Input | Behavior |
|-------|----------|
| YouTube / Twitch / TikTok URL | `yt-dlp --dump-json` metadata extraction (no download) |
| Direct media URL (`.mp3`, `.mp4`, etc.) | URL-based metadata extraction (no download) |
| Direct document URL (`.pdf`, `.epub`, `.docx`, etc.) | HTTP fetch to temp file, detect format, extract metadata, clean up |
| Local media file | `ffprobe` metadata extraction (duration, title) |
| Local document file | Format detection + `mutool` metadata (title, author, page count) |
| YouTube channel URL | Batch metadata for latest videos |
| RSS / podcast feed URL | Batch metadata for latest episodes |
| URL list file (`.md` / `.txt`) | Batch metadata for each listed input |
| Directory | Batch metadata for each supported local input |

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

## Flags

```text
--markdown           Output metadata as Markdown frontmatter YAML
--save               Save run.json to disk (and metadata.md with --markdown)
--password           Password for encrypted PDFs
--batch-limit        Batch: number of items to process (default 5)
--batch-all          Batch: process all items
--batch-order        Batch: item order newest|oldest (default newest)
--batch-concurrency  Batch: number of items to process concurrently (default 1)
```

## Output

By default, metadata is printed to the terminal as JSON.

With `--markdown`, the same metadata is printed as Markdown frontmatter YAML.

**Terminal output (default)**

```json
{
  "title": "My Video Title",
  "duration": "12:34",
  "author": "Channel Name",
  "url": "https://www.youtube.com/watch?v=...",
  "publishDate": "2025-07-22",
  "thumbnail": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
  "channelUrl": "https://www.youtube.com/channel/..."
}
```

**Terminal output with `--markdown`**

```md
---
title: 'My Video Title'
duration: '12:34'
author: 'Channel Name'
url: 'https://www.youtube.com/watch?v=...'
publishDate: '2025-07-22'
thumbnail: 'https://i.ytimg.com/vi/.../maxresdefault.jpg'
channelUrl: 'https://www.youtube.com/channel/...'
---
```

**With `--save` flag**

When `--save` is provided, metadata artifacts are written to a timestamped output directory:

```text
output/YYYY-MM-DD_HH-MM-SS_title/
  run.json
```

With `--save --markdown`, the same directory also includes:

```text
output/YYYY-MM-DD_HH-MM-SS_title/
  run.json
  metadata.md
```

**Document metadata example**

```json
{
  "format": "pdf",
  "title": "Document Title",
  "slug": "1-document",
  "author": "Author Name",
  "pageCount": 42,
  "fileSize": 1234567
}
```

## Examples

```bash
# Display metadata for a YouTube video
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Display and save metadata to disk
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --save

# Display metadata as Markdown frontmatter YAML
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# Display and save both run.json and metadata.md
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown --save

# Local media file metadata
bun as metadata input/examples/audio/1-audio.mp3

# Document metadata from a local PDF
bun as metadata input/examples/document/1-document.pdf

# Encrypted PDF metadata
bun as metadata input/examples/document/protected.pdf --password secret

# Batch metadata for latest 3 episodes from an RSS feed
bun as metadata https://example.com/feed --batch-limit 3

# Batch metadata for a YouTube channel
bun as metadata https://www.youtube.com/@channelname --batch-limit 5

# Batch metadata from a URL list, save all to disk
bun as metadata input/examples/batch/2-urls.md --batch-all --save
```

## How It Works

**Media inputs (URLs, audio/video files)**

1. Calls `extractSourceMetadata()` which uses:
   - `yt-dlp --dump-json` for streaming URLs (YouTube, Twitch, TikTok) — no actual download
   - `ffprobe` for local media files — extracts duration and title from filename
   - URL path parsing for direct media URLs
2. Derives a `slug` from the input filename when one exists, otherwise falls back to a title-based slug
3. Prints the collected metadata (title, slug, duration, author, URL, publish date, thumbnail, chapters) as JSON by default, or as Markdown frontmatter YAML with `--markdown`

**Document inputs (PDFs, EPUBs, etc.)**

1. Calls `detectDocumentFormat()` for format identification via magic bytes
2. For PDF/EPUB, calls `getDocumentInfo()` via `mutool` to extract title, author, and page count
3. Derives a `slug` from the original filename when one exists, otherwise falls back to a title-based slug
4. Collects file size via `stat`
5. Prints the document metadata as JSON by default, or as Markdown frontmatter YAML with `--markdown`

For remote document URLs, the file is temporarily downloaded for inspection and cleaned up afterward. No permanent files are created unless `--save` is used.

For YouTube inputs, `metadata` honors the same `yt-dlp` environment overrides as `download`, including `YTDLP_COOKIES_FROM_BROWSER`, `YTDLP_COOKIES`, and `YTDLP_EXTRACTOR_ARGS`.

## Processing Step Layout

CLI commands are split between runtime processing steps and setup/utilities:

```text
src/cli/commands/
  process-steps/
    step-0-metadata/
    step-1-download/
    step-2-stt/
    step-2-ocr/
    step-3-write/
    step-4-tts/
    step-5-image/
    step-6-video/
    step-7-music/
  setup-and-utilities/
    setup/
    models/
    links/
    config/
    cache/
    sample/
```
