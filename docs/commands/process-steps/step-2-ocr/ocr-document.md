# ocr

Extract text from documents, images, and article-style HTML with local or hosted OCR paths.

## Outline

- [Setup](#setup)
- [Usage](#usage)
- [Routing](#routing)
- [Article Backends](#article-backends)
- [EPUB Options](#epub-options)
- [Examples](#examples)
- [Flags](#flags)
- [Notes](#notes)

## Setup

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
bun as ocr input/examples/document/1-document.pdf --paddle-ocr
```

`--epub-calibre` can also trigger lazy Calibre setup on supported platforms when the Calibre CLI tools are missing.

### Environment

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
FIRECRAWL_API_KEY=...
FIRECRAWL_API_URL=http://localhost:3002
AUTOSHOW_URL_BACKEND=firecrawl
# or
AUTOSHOW_URL_BACKEND=glm-reader
```

`FIRECRAWL_API_KEY` is optional when `FIRECRAWL_API_URL` points at a self-hosted Firecrawl instance.

## Usage

```bash
bun as ocr [input] [flags]
```

Batch inputs use the same shared controls as other processing commands. The default batch limit is `5`; use `--batch-all` to process every discovered item.

For backfilling missing provider outputs from an existing OCR run or batch, see [`resume`](../../setup-and-utilities/resume/resume.md).

## Routing

| Input family | Default path | Other available paths |
|--------------|--------------|-----------------------|
| PDF | `mutool+tesseract` | `--tesseract`, `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr`, `--openai-ocr`, `--anthropic-ocr`, `--gemini-ocr` |
| EPUB | cleaned native extraction (`epub-text`) | `--tesseract`, `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr`, `--openai-ocr`, `--anthropic-ocr`, `--gemini-ocr`, `--epub-bun`, `--epub-calibre` |
| MOBI / AZW3 / FB2 / LIT | normalize to EPUB, then follow the EPUB path | same |
| DOCX / PPTX / XLSX / ODF | native ZIP/XML parse first, OCR fallback if needed | hosted OCR routes convert through PDF first |
| RTF | LibreOffice to PDF, then OCR | same |
| CBZ | per-image OCR | local or hosted engines |
| CSV | raw text | OCR flags are ignored with a warning |
| Remote article URL | `html+defuddle` | `--url-backend firecrawl` or `--url-backend glm-reader` |
| Local `.html` / `.htm` | `html+defuddle` | hosted article backends are ignored with a warning |
| PNG / JPG / JPEG / TIF / TIFF | local OCR by default | hosted OCR also supported; `--gemini-ocr` supports PNG/JPG directly, and `--anthropic-ocr` / `--openai-ocr` / `--gemini-ocr` can normalize TIF/TIFF to PNG when ImageMagick is available |
| WebP / BMP | normalize locally when possible, then OCR | `--openai-ocr`, `--anthropic-ocr`, and `--gemini-ocr` support WebP directly; `--gemini-ocr` supports BMP directly and `--openai-ocr` / `--anthropic-ocr` can normalize BMP to PNG when ImageMagick is available |
| GIF | local OCR by default | `--openai-ocr` and `--anthropic-ocr` support GIF directly; `--gemini-ocr` can normalize GIF to PNG when ImageMagick is available |

## Article Backends

- `defuddle` is the default backend for article-like HTML inputs.
- Remote article URLs use `defuddle` unless you pass `--url-backend firecrawl`, `--url-backend glm-reader`, or set `AUTOSHOW_URL_BACKEND`.
- Local `.html` and `.htm` files always use `defuddle`, even if a hosted backend is requested.
- OCR engine flags do not apply to article extraction.
- If `defuddle` cannot extract meaningful content, the command suggests retrying with `--url-backend firecrawl`.

## EPUB Options

### Inspect Modes

| Flag | Result |
|------|--------|
| `--epub-bun` | Inspect EPUB structure with the Bun ZIP/XML parser and write structured EPUB data into `run.json` |
| `--epub-calibre` | Inspect EPUB structure with Calibre and write the same structured EPUB shape into `run.json` |

- Inspect mode is metadata-only for EPUB inputs.
- If `--out` is set in inspect mode, it must be `json`.
- `--chapters` and `--length` are ignored in inspect mode.

### Native EPUB Export

The default EPUB path writes cleaned native text instead of synthetic `Page N` output.

- `--chapters` writes one cleaned file per kept section under `chapters/`.
- `--length <n>` uses a hard limit of `n * 1000` characters and writes `chunks/` side artifacts.
- `--chapters --length <n>` splits oversized section files with `-part-NNN` suffixes.
- `--chapters` and `--length` are ignored for non-EPUB/non-PDF inputs and for EPUB runs that use a hosted OCR engine or image/PDF OCR path.

## PDF Chapter Detection

- `--chapters` on a PDF runs chapter autodetection and writes best-effort chapter files under `chapters/`.
- Detection is local-first by default and uses PDF bookmarks, TOC-like pages, printed-page-to-PDF-page mapping, and heading fallback.
- `--pdf-chapter-mode local` keeps detection fully heuristic and local.
- `--pdf-chapter-mode auto` starts local and only tries model assistance when the local result is weak and a default LLM is configured.
- `--pdf-chapter-mode llm` always attempts the model-assisted resolver after building the local evidence dossier.
- `--length <n>` only affects PDFs when `--chapters` is also set; it hard-splits oversized chapter files with `-part-NNN` suffixes.
- Detection diagnostics are written into `run.json` under `step2.pdfChapterDetection`, and the export summary is written under `step2.chapterExport`.

## Examples

```bash
# Default PDF extraction
bun as ocr input/examples/document/1-document.pdf

# JSON output
bun as ocr input/examples/document/1-document.pdf --out json

# PDF chapter autodetection
bun as ocr input/examples/document/3-document.pdf --chapters

# PDF chapter autodetection with model-assisted fallback
bun as ocr input/examples/document/3-document.pdf --chapters --pdf-chapter-mode auto

# Native EPUB extraction plus chapter side artifacts
bun as ocr input/examples/document/1-epub.epub --chapters

# Native EPUB chunk side artifacts at 50k characters
bun as ocr input/examples/document/1-epub.epub --length 50

# OCRmyPDF path
bun as ocr input/examples/document/1-document.pdf --ocrmypdf

# Explicit Tesseract path
bun as ocr input/examples/document/1-document.pdf --tesseract

# Hosted OCR
bun as ocr input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-2512
bun as ocr input/examples/document/1-document.pdf --glm-ocr glm-ocr
bun as ocr input/examples/document/1-document.pdf --openai-ocr gpt-5.4-nano
bun as ocr input/examples/document/1-document.pdf --anthropic-ocr claude-haiku-4-5
bun as ocr input/examples/document/1-document.pdf --gemini-ocr gemini-3.1-flash-lite-preview

# Fan out across every OCR provider in price mode
bun as ocr input/examples/document/1-document.pdf --all-ocr --price

# Remote article extraction
bun as ocr https://ajcwebdev.com
bun as ocr https://ajcwebdev.com --url-backend firecrawl

# Batch URL list extraction
bun as ocr ./input/examples/batch/2-urls.md --batch-all

# Local HTML always uses defuddle
bun as ocr ./input/article.html --out json

# EPUB inspect modes
bun as ocr input/examples/document/1-epub.epub --epub-bun --out json
bun as ocr input/examples/document/1-epub.epub --epub-calibre --out json

```

## Flags

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
| `--batch-limit <n>` | Process at most `n` items from a batch input |
| `--batch-all` | Process all items from a batch input |
| `--batch-order <order>` | Batch item order: `newest` or `oldest` |
| `--batch-concurrency <n>` | Number of batch items to process concurrently |
| `--epub-bun` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | Inspect EPUB structure with Calibre |
| `--price` | Show the aggregated OCR estimate and exit |

## Notes

- Standalone `ocr` writes the root extraction artifact (`extraction.txt` or `result.json`) plus `run.json`.
- EPUB export and PDF chapter autodetection write additive `chapters/` or `chunks/` side artifacts inside the same output directory.
- Supported document formats include PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, and CBZ.
- Supported image formats include PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, and GIF.
- Mistral OCR accepts PDF and standard images (`PNG`, `JPG`, `TIF`); GLM OCR accepts PDF plus `PNG` and `JPG`; OpenAI OCR accepts PDF plus `PNG`, `JPG`, `WEBP`, and `GIF` directly; Anthropic OCR accepts standard unencrypted PDFs plus `PNG`, `JPG`, `WEBP`, and `GIF` directly; Gemini OCR accepts PDF plus `PNG`, `JPG`, `WEBP`, and `BMP` directly.
- OpenAI OCR normalizes `BMP` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- Anthropic OCR normalizes `BMP` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- Anthropic OCR currently enforces the bundled Claude docs caps from `project/links/claude-all-links.md`: direct images up to 5 MB each, PDF chunk uploads through the Files API, and only standard unencrypted PDFs.
- Anthropic OCR splits PDFs into internal 10-page Files API uploads, sums token usage across chunks, and best-effort deletes uploaded files after each chunk run.
- Gemini OCR normalizes `GIF` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- GLM OCR currently enforces the bundled docs caps from `project/links/glm-all-links.md`: images up to 10 MB, PDFs up to 50 MB, and PDFs up to 100 pages.
- OpenAI OCR currently enforces the bundled PDF size cap from `project/links/openai-all-links.md`: PDFs up to 50 MB.
- Gemini OCR currently enforces the bundled docs caps from `project/links/gemini-all-links.md`: inline PDFs up to 50 MB, inline non-PDF inputs up to 100 MB, Files API uploads up to 2 GB per file, and PDFs up to 1000 pages.
- No numeric Mistral OCR or Firecrawl file-size/page-count caps were found in `project/links/all-all-links.md`, so this CLI does not enforce any new numeric limits for those providers from that source.
- Office inputs try native extraction first and only fall back to OCR when the extracted text quality is poor.
- Config defaults can persist chapter export settings under `defaults.extract.chapters`, `defaults.extract.length`, and `defaults.extract.pdfChapterMode`.
- Backfill existing OCR outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
- Tesseract tuning flags such as `--dpi`, `--psm`, `--oem`, `--rotate`, `--page-separator`, and `--preserve-spaces` work on standalone `ocr` and on [`write`](../step-3-write/write-text.md).
- Non-Tesseract engines may ignore Tesseract-specific tuning flags and report a warning when they do.
