# extract

Routes each input to the right step-2 extractor: media to STT, documents/images to OCR, article HTML to article extraction, and X/Twitter links to the X API.

## Outline

- [Usage](#usage)
- [Input Routing](#input-routing)
- [Batch Inputs](#batch-inputs)
- [Detailed Extract Docs](#detailed-extract-docs)

## Usage

```bash
bun as extract [input] [flags]
```

Batch inputs use the same shared controls as other processing commands. The default batch limit is `5`; use `--batch-all` to process every discovered item.

For backfilling missing provider outputs from an existing run or batch, see [`resume`](../../setup-and-utilities/resume/resume.md).

## Input Routing

| Input | Route |
|-------|-------|
| YouTube, Twitch, or TikTok URLs | [STT](./02-extract-stt.md) |
| Direct media URLs (`.mp3`, `.mp4`, `.wav`, `.webm`) | [STT](./02-extract-stt.md) |
| Local media files | [STT](./02-extract-stt.md) |
| RSS or podcast feed batches | [STT](./02-extract-stt.md) |
| YouTube channel batches | [STT](./02-extract-stt.md) |
| PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODF, RTF, CSV, CBZ | [OCR](./03-extract-ocr.md) |
| PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF | [OCR](./03-extract-ocr.md) |
| Remote article URLs (`text/html`) | [URL / HTML extraction](./04-extract-url.md) |
| Local `.html` / `.htm` files | [URL / HTML extraction](./04-extract-url.md) |
| X/Twitter Space URLs (`x.com/i/spaces/<id>`) | [X Space metadata](./04-extract-url.md#x-space-path) |
| X/Twitter post URLs (`x.com/<handle>/status/<id>`) | [X Space metadata](./04-extract-url.md#x-space-path) |
| Raw Space IDs (1-13 alphanumeric characters) | [X Space metadata](./04-extract-url.md#x-space-path) |
| Directory batches | Mixed routing per discovered item |
| URL-list batches (`.md` / `.txt`) | Mixed routing per listed URL |

Media inputs are downloaded, normalized when needed, and transcribed with local or hosted speech-to-text engines. If no STT engine flag is provided, `extract` defaults to local Whisper with the `tiny` model.

Document and image inputs route through OCR or native text extraction depending on the file type. PDFs and images can use local or hosted OCR engines, EPUBs default to cleaned native text extraction, Office-style files use native ZIP/XML or text extraction, and CSV inputs are treated as raw text.

Remote article URLs and local HTML files use article extraction instead of OCR engine flags. Remote URLs default to `defuddle` and can use `--url-backend firecrawl` or `--url-backend glm-reader`; local `.html` and `.htm` files always use `defuddle`.

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected and processed through the X v2 API. They produce metadata artifacts rather than an STT transcript.

## Batch Inputs

Directory batches and URL-list batches classify each item independently. A single batch can include media URLs, article URLs, document URLs, X/Twitter links, and local files.

```bash
# Process every item in a URL list
bun as extract ./input/examples/batch/2-urls.md --batch-all

# Process a whole YouTube channel batch with caption-first STT routing
bun as extract https://www.youtube.com/@channelname --youtube-captions --batch-all
```

## Detailed Extract Docs

- [STT extraction](./02-extract-stt.md): setup, engines, provider flags, examples, pricing, and STT output notes.
- [OCR extraction](./03-extract-ocr.md): document/image routing, local and hosted OCR engines, EPUB/PDF behavior, pricing, and OCR output notes.
- [URL and X extraction](./04-extract-url.md): remote article URLs, local HTML, article backends, X/Twitter Space inputs, and X output notes.
