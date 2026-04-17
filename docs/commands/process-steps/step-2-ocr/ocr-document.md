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
bun as ocr --resume-missing [batch-dir] [provider flags]
```

## Routing

| Input family | Default path | Other available paths |
|--------------|--------------|-----------------------|
| PDF | `mutool+tesseract` | `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr` |
| EPUB | cleaned native extraction (`epub-text`) | `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr`, `--epub-bun`, `--epub-calibre` |
| MOBI / AZW3 / FB2 / LIT | normalize to EPUB, then follow the EPUB path | same |
| DOCX / PPTX / XLSX / ODF | native ZIP/XML parse first, OCR fallback if needed | hosted OCR routes convert through PDF first |
| RTF | LibreOffice to PDF, then OCR | same |
| CBZ | per-image OCR | local or hosted engines |
| CSV | raw text | OCR flags are ignored with a warning |
| Remote article URL | `html+defuddle` | `--url-backend firecrawl` or `--url-backend glm-reader` |
| Local `.html` / `.htm` | `html+defuddle` | hosted article backends are ignored with a warning |
| PNG / JPG / JPEG / TIF / TIFF | local OCR by default | hosted OCR also supported |
| WebP / BMP | normalize locally when possible, then OCR | hosted OCR may reject unsupported formats |
| GIF | local OCR only | hosted OCR rejects it |

Only one OCR engine flag may be active at a time: `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, or `--glm-ocr`.

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
- `--chapters` and `--length` are ignored for non-EPUB inputs and for EPUB runs that use a hosted OCR engine or image/PDF OCR path.

## Examples

```bash
# Default PDF extraction
bun as ocr input/examples/document/1-document.pdf

# JSON output
bun as ocr input/examples/document/1-document.pdf --out json

# Native EPUB extraction plus chapter side artifacts
bun as ocr input/examples/document/1-epub.epub --chapters

# Native EPUB chunk side artifacts at 50k characters
bun as ocr input/examples/document/1-epub.epub --length 50

# OCRmyPDF path
bun as ocr input/examples/document/1-document.pdf --ocrmypdf

# Hosted OCR
bun as ocr input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-2512
bun as ocr input/examples/document/1-document.pdf --glm-ocr glm-ocr

# Remote article extraction
bun as ocr https://ajcwebdev.com
bun as ocr https://ajcwebdev.com --url-backend firecrawl

# Local HTML always uses defuddle
bun as ocr ./input/article.html --out json

# EPUB inspect modes
bun as ocr input/examples/document/1-epub.epub --epub-bun --out json
bun as ocr input/examples/document/1-epub.epub --epub-calibre --out json

# Resume missing OCR provider outputs from an earlier batch
bun as ocr --resume-missing
```

## Flags

| Flag | Description |
|------|-------------|
| `--lang <codes>` | Tesseract language codes such as `eng` or `eng+fra` |
| `--out <format>` | Output format: `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--ocrmypdf` | Use OCRmyPDF |
| `--paddle-ocr` | Use PaddleOCR |
| `--mistral-ocr <model>` | Use Mistral OCR; omit the value to use the cheapest supported model |
| `--glm-ocr <model>` | Use GLM OCR; omit the value to use the cheapest supported model |
| `--chapters` | EPUB native text runs: write one cleaned file per kept section under `chapters/` |
| `--length <n>` | EPUB native text runs: hard export limit in thousands of characters |
| `--url-backend <backend>` | Article backend: `defuddle`, `firecrawl`, or `glm-reader` |
| `--epub-bun` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | Inspect EPUB structure with Calibre |
| `--resume-missing [batch-dir]` | Reuse an OCR batch directory and rerun only missing provider outputs; omit the path to auto-pick the newest compatible batch under `./output` |
| `--price` | Show the aggregated OCR estimate and exit |

## Notes

- Standalone `ocr` writes the root extraction artifact (`extraction.txt` or `result.json`) plus `run.json`.
- Native EPUB export writes additive `chapters/` or `chunks/` side artifacts inside the same output directory.
- Supported document formats include PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, and CBZ.
- Supported image formats include PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, and GIF.
- Mistral OCR accepts PDF and standard images (`PNG`, `JPG`, `TIF`); GLM OCR accepts PDF plus `PNG` and `JPG`.
- Office inputs try native extraction first and only fall back to OCR when the extracted text quality is poor.
- Config defaults can persist EPUB export settings under `defaults.extract.chapters` and `defaults.extract.length`.
- `--resume-missing` does not accept a positional input and does not support `--price`.
- Advanced Tesseract tuning flags such as `--dpi`, `--psm`, `--oem`, `--rotate`, `--page-separator`, and `--preserve-spaces` are exposed through [`write`](../step-3-write/write-text.md), not standalone `ocr`.
