# ocr (local)

Extract text from documents, images, and HTML articles with the local extraction paths exposed by `bun as ocr`.

## Outline

- [Setup](#setup)
- [Runtime Setup](#runtime-setup)
- [Tooling Notes](#tooling-notes)
- [Service Environment](#service-environment)
- [Usage](#usage)
- [Default Routing](#default-routing)
- [HTML / Article Extraction](#html--article-extraction)
- [EPUB Inspect Modes](#epub-inspect-modes)
- [OCR Language Handling](#ocr-language-handling)
- [Examples](#examples)
- [Standalone `ocr` Flags](#standalone-ocr-flags)
- [Notes](#notes)
- [Local Tests](#local-tests)
- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [Core Local Paths](#core-local-paths)
- [Heavier Local Paths](#heavier-local-paths)

## Setup

### Runtime Setup

```bash
# full local setup
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

`--epub-calibre` can also trigger lazy Calibre setup on supported platforms if the Calibre CLI tools are missing.

HTML/article extraction through `defuddle` is bundled and does not require extra setup. Hosted article backends (`firecrawl`, `glm-reader`) are documented in [`ocr-document-services.md`](./ocr-document-services.md).

### Tooling Notes

| Tool | Used for | Current behavior |
|------|----------|------------------|
| MuPDF (`mutool`) | PDF rendering and document conversion | installed by the document foundation setup |
| Calibre CLI tools | ebook normalization and `--epub-calibre` | installed by `bun as setup` or `bun as setup --step calibre`; may also be installed lazily for `--epub-calibre` |
| Tesseract | default local OCR | installed by `bun as setup` |
| LibreOffice (`soffice`) | office/RTF to PDF conversion | installed by `bun as setup`; `ocr` itself does not auto-install it |
| OCRmyPDF | `--ocrmypdf` engine | must already be available on `$PATH` |
| PaddleOCR venv | `--paddle-ocr` engine | created lazily under `runtime/bin/paddle-ocr/` |
| Defuddle + linkedom | HTML/article extraction to markdown | bundled dependency; no external setup |
| ImageMagick (`convert`) | WebP/BMP normalization before OCR | optional; if missing, the file is passed through as-is |

### Service Environment

No environment variables are required for the default local OCR and `defuddle` paths.

```bash
MISTRAL_API_KEY=...
GLM_API_KEY=...
```

`MISTRAL_API_KEY` is only needed when you opt into `--mistral-ocr`.
`GLM_API_KEY` is only needed when you opt into `--glm-ocr` or `--url-backend glm-reader`.

## Usage

```bash
bun as ocr [input] [flags]
```

## Default Routing

| Input family | Default path | `--ocrmypdf` | `--paddle-ocr` |
|--------------|--------------|--------------|----------------|
| PDF | `mutool+tesseract` | `pdf+ocrmypdf` | `mutool+paddle-ocr` |
| EPUB | `epub-text` via Bun ZIP/XML chapter extraction | EPUB to PDF, then `pdf+ocrmypdf` | EPUB to PDF, then `pdf+paddle-ocr` |
| MOBI / AZW3 / FB2 / LIT | normalize to EPUB via Calibre, then follow the EPUB path | same | same |
| DOCX / PPTX / XLSX / ODF | native ZIP/XML parse first, with OCR fallback through LibreOffice if quality is poor | LibreOffice to PDF, then OCRmyPDF | LibreOffice to PDF, then PaddleOCR |
| RTF | LibreOffice to PDF, then Tesseract | LibreOffice to PDF, then OCRmyPDF | LibreOffice to PDF, then PaddleOCR |
| CBZ | per-image Tesseract (`cbz+tesseract`) | per-image OCRmyPDF (`cbz+ocrmypdf`) | per-image PaddleOCR (`cbz+paddle-ocr`) |
| CSV | raw text (`csv-raw`) | ignored with a warning | ignored with a warning |
| Article URL (HTML response) | `html+defuddle` markdown extraction | ignored with a warning | ignored with a warning |
| Local `.html` / `.htm` | `html+defuddle` markdown extraction | ignored with a warning | ignored with a warning |
| PNG / JPG / TIF | `image+tesseract` | `image+ocrmypdf` | `image+paddle-ocr` |
| WebP / BMP | normalize to PNG first when ImageMagick is available, then OCR | same | same |
| GIF | pass the image directly to the selected engine | same | same |

Only one OCR engine flag may be used at a time.

## HTML / Article Extraction

`defuddle` is the default backend for article-like HTML inputs.

Rules:
- remote article URLs use `defuddle` by default and write `step2.extractionMethod: "html+defuddle"`
- local `.html` and `.htm` files always use `defuddle`
- article extraction produces markdown-like text from the page body, not page-based OCR
- if `defuddle` cannot extract meaningful content, the command fails with a message suggesting `--url-backend firecrawl`
- OCR engine flags such as `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, and `--glm-ocr` are ignored for HTML/article inputs
- local `.html` and `.htm` still use `defuddle` even if `--url-backend firecrawl` or `--url-backend glm-reader` is passed

## EPUB Inspect Modes

Structured EPUB inspection is available through two mutually exclusive flags:

| Flag | Engine | Result |
|------|--------|--------|
| `--epub-bun` | native Bun ZIP/XML parser | writes structured EPUB payload into `run.json` (`step2.epub`) |
| `--epub-calibre` | Calibre CLI tools | writes the same unified `step2.epub` payload shape into `run.json` |

Rules:
- inspect mode is metadata-only for EPUB inputs
- if `--out` is explicitly provided in inspect mode, it must be `json`
- for non-EPUB inputs, these flags fall back to the normal OCR flow

## OCR Language Handling

`--lang` accepts Tesseract-style language codes such as `eng` or `eng+fra`.

| Engine | Behavior |
|--------|----------|
| Tesseract | passed through directly |
| OCRmyPDF | passed through to the underlying Tesseract OCR run |
| PaddleOCR | mapped from Tesseract-style codes when possible |

## Examples

```bash
# Default PDF extraction
bun as ocr input/examples/document/1-document.pdf

# JSON output
bun as ocr input/examples/document/1-document.pdf --out json

# EPUB chapter extraction
bun as ocr input/examples/document/1-epub.epub

# EPUB OCR path
bun as ocr input/examples/document/1-epub.epub --ocrmypdf

# Ebook normalized through Calibre first
bun as ocr input/1-document.mobi

# Local image OCR
bun as ocr input/examples/document/1-document.png --paddle-ocr

# Remote article extraction with the default defuddle backend
bun as ocr https://ajcwebdev.com

# Local HTML article extraction
bun as ocr ./input/article.html --out json

# Explicitly select the default article backend
bun as ocr https://ajcwebdev.com --url-backend defuddle

# Structured EPUB inspect with Bun
bun as ocr input/examples/document/1-epub.epub --epub-bun --out json

# Structured EPUB inspect with Calibre
bun as ocr input/examples/document/1-epub.epub --epub-calibre --out json
```

## Standalone `ocr` Flags

These are the flags currently exposed by the standalone `ocr` command:

| Flag | Default | Description |
|------|---------|-------------|
| `--lang` | `eng` | Tesseract language code(s) |
| `--out` | `text` | `text`, `json`, `tsv`, or `hocr` |
| `--password` | - | Password for encrypted PDFs |
| `--ocrmypdf` | `false` | Use OCRmyPDF |
| `--paddle-ocr` | `false` | Use PaddleOCR |
| `--url-backend` | `defuddle` | Article/HTML backend: `defuddle`, `firecrawl`, or `glm-reader`; local `.html` / `.htm` always use `defuddle` |
| `--epub-bun` | `false` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | `false` | Inspect EPUB structure with Calibre |
| `--price` | `false` | Show the aggregated OCR estimate and exit |

## Notes

- Supported document formats: PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ.
- Supported image formats: PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF.
- HTML/article inputs default to the bundled `defuddle` backend and produce `html+defuddle` extraction metadata.
- Office files use native ZIP/XML extraction first and only fall back to OCR when the extracted text quality is poor.
- `--mistral-ocr`, `--glm-ocr`, and hosted article backends are documented separately in [`ocr-document-services.md`](./ocr-document-services.md).
- Advanced Tesseract tuning flags such as `--dpi`, `--psm`, `--oem`, `--rotate`, `--page-separator`, and `--preserve-spaces` are currently exposed through `write`, not through standalone `ocr`.

## Local Tests

```bash
bun t \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-options.test.ts \
  test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

### Validation / Price / Non-E2E

No standalone local OCR validation or price file exists. Validation is mixed into `ocr-options.test.ts`.

### Core Local Paths

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-options.test.ts
```

Current coverage in this file includes:
- default PDF extraction
- `--out json` for PDF extraction
- PDF extraction with `--ocrmypdf`
- PDF extraction with `--paddle-ocr`
- EPUB extraction with `--ocrmypdf`
- image extraction with `--ocrmypdf`
- EPUB inspect via `--epub-bun`
- EPUB inspect via `--epub-calibre`
- rejection of non-JSON `--out` in EPUB inspect mode
- non-EPUB fallback when `--epub-bun` is passed

`ocr-options.test.ts` does not currently have mapped `--test-price` commands.

### Heavier Local Paths

```bash
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts
bun t test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts --budget 5
```

Covers PaddleOCR image extraction.
