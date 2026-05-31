# download

Download media or documents and collect metadata without running transcription, extraction, or LLM steps.

## Outline

- [Supported Inputs](#supported-inputs)
- [Flags](#flags)
- [Advanced yt-dlp / FFmpeg Passthrough](#advanced-yt-dlp--ffmpeg-passthrough)
- [Output](#output)
- [Examples](#examples)
- [Setup and Environment](#setup-and-environment)
- [Processing Step Layout](#processing-step-layout)

```bash
bun as download <input>
```

## Supported Inputs

| Input | Behavior |
|-------|----------|
| YouTube / Twitch / TikTok URL | `yt-dlp` download, normalize to compressed audio-only media, collect media metadata |
| Direct media URL (`.mp3`, `.mp4`, etc.) | HTTP fetch, normalize to compressed audio-only media, collect media metadata |
| Direct document URL (`.pdf`, `.epub`, `.docx`, etc.) | HTTP fetch to a temp file, detect format, collect document metadata |
| Direct document URL without an extension | HEAD probe plus download + magic-byte detection |
| Remote article / HTML URL | Article extraction through `defuddle`, `firecrawl`, `glm-reader`, `spider`, or `zyte` via `--url-provider` |
| Local `.html` / `.htm` file | Article extraction with local `defuddle` |
| Local media file | normalize to compressed audio-only media, collect media metadata |
| Local document file | detect format by magic bytes first, then extension |
| YouTube channel URL | batch the latest videos |
| RSS / podcast feed URL | batch the latest episodes |
| URL list file (`.md` / `.txt`) | batch each listed input |
| Directory | batch each supported local input |

Use `--best-quality` for streaming sources when you want the best available video stream plus the best available audio stream instead of the default audio-only artifact. For direct media URLs and local media files, `--best-quality` keeps the source file as-is because there is no alternate quality ladder to select.

**Supported document formats:** PDF, EPUB, MOBI, AZW3, AZW, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ

**Supported image formats:** PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF

MOBI, AZW3, FB2, and LIT inputs are normalized to EPUB through Calibre during step 1. The source format and conversion chain are recorded in `run.json` under `step1`.

Step-1 metadata in `run.json` also includes `slug`, which is derived from the original filename without its final extension when available.

## Flags

```text
--password           Password for encrypted PDFs
--keep-original-media  Keep downloaded media in its original/downloaded format instead of creating the normalized compressed audio artifact
--best-quality       Download the best available video+audio media and skip audio-only normalization
--flat-batch         Batch download: place primary media files directly in the batch output directory
--url-provider       Article/HTML extraction backend: defuddle|firecrawl|glm-reader|spider|zyte (default defuddle; local .html/.htm always use defuddle)
--batch-limit        Batch: number of items to process (default 5)
--batch-all          Batch: process all items
--batch-order        Batch: item order newest|oldest (default newest)
--batch-concurrency  Batch: number of items to process concurrently (default 1)
```

## Advanced yt-dlp / FFmpeg Passthrough

Use `--` after the AutoShow input and flags to pass exact argv tokens to the per-item yt-dlp download call:

```bash
# Override yt-dlp format selection inside AutoShow's normal download workflow
bun as download https://youtube.com/watch?v=abc -- --format bestvideo+bestaudio

# Pass FFmpeg args through yt-dlp's native postprocessor mechanism
bun as download https://youtube.com/watch?v=abc -- --postprocessor-args "ffmpeg:-vf scale=1280:720"

# Compose passthrough with AutoShow batch flags
bun as download input/examples/batch/2-urls.md --batch-limit 3 -- --format bestaudio
bun as download https://example.com/feed --batch-all --keep-original-media --flat-batch -- --format bestaudio
```

Passthrough is supported only for media URL downloads. For direct media URLs and podcast feed items that would normally use HTTP fetch, AutoShow uses yt-dlp instead so the extra args are honored. Local files, documents, articles, and X Space inputs reject passthrough with a usage error.

Without a positional AutoShow input, `download --` runs yt-dlp directly and skips AutoShow manifests, normalization, output directory management, pricing, and batch handling:

```bash
bun as download -- --list-extractors
bun as download -- --flat-playlist --dump-json https://youtube.com/@channelname

# Download separate highest-quality video and audio assets for a time range
bun as download -- \
  --download-sections '*14:30-14:45' \
  --force-keyframes-at-cuts \
  -f 'bestvideo,bestaudio' \
  -o 'output/D3WD52pfM8I_14m30s-14m45s_%(format_id)s.%(ext)s' \
  'https://www.youtube.com/watch?v=D3WD52pfM8I'
```

## Output

**Media inputs**

```text
output/YYYY-MM-DD_HH-MM-SS_title/
  <audio>.mp3|.m4a|.ogg|.flac
  run.json
```

With `--best-quality`, streaming outputs may be merged as `.mkv`, `.mp4`, or `.webm`, depending on the source streams selected by `yt-dlp`. Direct media URLs and local media files keep their source extension. The `run.json` `step1` payload keeps `audioFileName` and `audioFileSize` for compatibility and also includes `mediaFileName`, `mediaFileSize`, and `mediaKind`.

**Document inputs**

```text
output/YYYY-MM-DD_HH-MM-SS_title/
  run.json
```

**Batch inputs**

```text
output/YYYY-MM-DD_HH-MM-SS_batch-label/
  source.json
  batch.json  # consolidated per-item run metadata payloads
  YYYY-MM-DD-item/   # when the item has a content date
  item-slug/         # otherwise
    <artifacts for that item>
```

**Batch inputs with `--flat-batch` on media downloads**

```text
output/YYYY-MM-DD_HH-MM-SS_batch-label/
  source.json
  batch.json
  <episode-1>.mp3|.m4a|.ogg|.flac
  <episode-2>.mp3|.m4a|.ogg|.flac
```

With `--keep-original-media --flat-batch`, the same batch directory keeps the original downloaded media extensions instead of the normalized audio-only artifact:

```text
output/YYYY-MM-DD_HH-MM-SS_batch-label/
  source.json
  batch.json
  <episode-1>.mp3
  <episode-2>.mp3
```

## Examples

```bash
# Download a YouTube video
bun as download https://www.youtube.com/watch?v=u1-WHqATSQU

# Download the best available video+audio media from a YouTube video
bun as download https://www.youtube.com/watch?v=u1-WHqATSQU --best-quality

# Download a local audio file
bun as download https://ajc.pics/autoshow/examples/1-audio.mp3

# Download document metadata from a local PDF
bun as download input/examples/document/1-document.pdf

# Download 3 latest episodes from an RSS feed
bun as download https://example.com/feed --batch-limit 3

# Download every podcast episode MP3 into one batch directory
bun as download https://example.com/feed --batch-all --keep-original-media --flat-batch

# Download 2 latest videos from a YouTube channel
bun as download https://www.youtube.com/@channelname --batch-limit 2

# Download all items from a URL list
bun as download input/examples/batch/2-urls.md --batch-all

# Download one item with extra yt-dlp flags
bun as download https://youtube.com/watch?v=abc -- --write-thumbnail

# Run yt-dlp directly
bun as download -- --version
```

## Setup and Environment

Setup details are centralized in [`setup.md`](../step-0-setup/setup.md).

For YouTube inputs, anonymous `yt-dlp` requests may be rate-limited or challenged. When that happens, configure `YTDLP_COOKIES_FROM_BROWSER`, `YTDLP_COOKIES`, or `YTDLP_EXTRACTOR_ARGS` in your environment before running `download` / `extract`.

## Processing Step Layout

CLI commands are split between runtime processing steps and setup/utilities:

```text
src/cli/commands/
  process-steps/
    step-1-download/
    step-2-extract/
    step-3-write/
    step-4-tts/
    step-5-image/
    step-6-video/
    step-7-music/
  setup-and-utilities/
    setup/
```
