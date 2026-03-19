# extract (local)

Extract text from documents and images using local engines only.

## Outline

- [Usage](#usage)
- [Format families and default dispatch](#format-families-and-default-dispatch)
- [EPUB default extraction](#epub-default-extraction)
- [EPUB inspect modes](#epub-inspect-modes)
- [Ebook normalization (MOBI / AZW3 / FB2 / LIT)](#ebook-normalization-mobi--azw3--fb2--lit)
- [Office quality heuristic (DOCX / PPTX / XLSX / ODF)](#office-quality-heuristic-docx--pptx--xlsx--odf)
- [CBZ page ordering](#cbz-page-ordering)
- [`--out` file contract](#--out-file-contract)
- [`--lang` behavior](#--lang-behavior)
- [Examples](#examples)
- [Flags](#flags)
  - [Basic](#basic)
  - [Advanced (Tesseract only)](#advanced-tesseract-only)
- [Notes](#notes)

## Usage

```bash
bun as extract [input] [flags]
```

## Format families and default dispatch

| Input family         | Default (no OCR flag)                                     | `--ocrmypdf`                           | `--paddle-ocr`                             |
|----------------------|-----------------------------------------------------------|----------------------------------------|--------------------------------------------|
| PDF                  | text-first + Tesseract fallback (`mutool+tesseract`)      | `pdf+ocrmypdf`                         | `pdf+paddle-ocr`                           |
| EPUB                 | chapter text extraction (`epub-text`)                     | LibreOffice→PDF→OCRmyPDF               | LibreOffice→PDF→PaddleOCR                  |
| MOBI / AZW3 / FB2 / LIT | normalized to EPUB via Calibre, then same as EPUB    | same as EPUB + OCR flag                | same as EPUB + OCR flag                    |
| DOCX / PPTX / XLSX / ODF | native ZIP+XML, fallback to LibreOffice+Tesseract   | force LibreOffice→PDF→OCRmyPDF         | force LibreOffice→PDF→PaddleOCR            |
| RTF                  | LibreOffice→PDF→Tesseract (`rtf+tesseract`)               | LibreOffice→PDF→OCRmyPDF               | LibreOffice→PDF→PaddleOCR                  |
| CBZ                  | per-image Tesseract (`cbz+tesseract`)                     | per-image OCRmyPDF (`cbz+ocrmypdf`)    | per-image PaddleOCR (`cbz+paddle-ocr`)     |
| CSV                  | raw text (`csv-raw`), OCR flags ignored with warning      | —                                      | —                                          |
| PNG / JPG / TIF      | `image+tesseract`                                         | `image+ocrmypdf`                       | `image+paddle-ocr`                         |
| WebP / BMP / GIF     | ImageMagick→PNG→Tesseract (`image+tesseract`)             | ImageMagick→PNG→OCRmyPDF               | ImageMagick→PNG→PaddleOCR                  |

Only one OCR engine flag may be used at a time.

## EPUB default extraction

EPUB inputs without an OCR flag use native chapter text extraction via the Bun ZIP/XML parser. Each chapter is output as a page with its title as a `## heading` when available. No mutool or OCR invocation occurs.

## EPUB inspect modes

Deep inspect modes are available for structured EPUB metadata:

| Flag            | Engine                        | Output                                                                                     |
|-----------------|-------------------------------|--------------------------------------------------------------------------------------------|
| `--epub-bun`    | Native Bun ZIP/XML parser     | Writes full EPUB structure/TOC/chapter text/inventory into `metadata.json` (`step2.epub`) |
| `--epub-calibre`| Calibre CLI tools             | Same unified `step2.epub` shape in `metadata.json`                                         |

Rules:
- `--epub-bun` and `--epub-calibre` are mutually exclusive.
- In EPUB inspect mode, only `metadata.json` is written (no extraction artifact).
- For non-EPUB files, these flags fall back to the normal extract flow.
- `--epub-bun` and `--epub-calibre` also apply to ebook inputs normalized to EPUB (MOBI/AZW3/FB2/LIT).

## Ebook normalization (MOBI / AZW3 / FB2 / LIT)

Ebook formats that are not EPUB are automatically normalized to EPUB via Calibre in step 1 before extraction. The conversion chain is recorded in `metadata.json` (`step1.conversionChain`). Calibre must be installed (`bun as setup --step calibre`).

LIT support is best-effort — Calibre's LIT import is deprecated and may fail on some files.

## Office quality heuristic (DOCX / PPTX / XLSX / ODF)

Native ZIP+XML extraction is attempted first. If the extracted text fails a quality check (too few words, high replacement-character ratio, or poor alpha/numeric content ratio), the document is re-processed via LibreOffice→PDF→OCR. Spreadsheet-heavy XLSX/ODS files receive a relaxed heuristic to avoid false OCR fallback on numeric tables.

If any OCR engine flag is present, the native parser is skipped entirely and LibreOffice conversion is always used.

## CBZ page ordering

CBZ archives are extracted and sorted by natural numeric filename order (`1.png, 2.png, 10.png` — not lexicographic).

## `--out` file contract

Strict output: only the requested primary artifact plus `metadata.json` is written per run.

| `--out` value  | Primary artifact   |
|----------------|--------------------|
| `text` (default) | `extraction.txt` |
| `json`         | `extraction.json`  |
| `tsv`          | `extraction.tsv`   |
| `hocr`         | `extraction.hocr`  |

## `--lang` behavior

`--lang` accepts Tesseract-format language codes (e.g. `eng`, `fra`, `deu+fra`).

| Engine      | Behavior                                                                                      |
|-------------|-----------------------------------------------------------------------------------------------|
| Tesseract   | passed directly as `-l <lang>`                                                                |
| OCRmyPDF    | passed directly (delegates to Tesseract)                                                      |
| PaddleOCR   | mapped from Tesseract codes (`eng`→`en`, `fra`→`fr`, etc.); logs a warning if no mapping     |
| Mistral OCR | ignored; `languageSupported: false` recorded in metadata                                      |

## Examples

```bash
# Default: PDF with Tesseract
bun as extract input/1-document.pdf

# EPUB default text extraction (no OCR)
bun as extract input/1-document.epub

# EPUB extract with OCRmyPDF (converts to PDF first)
bun as extract input/1-document.epub --ocrmypdf

# Ebook (MOBI) — normalized to EPUB via Calibre, then extracted
bun as extract input/1-document.mobi

# RTF document
bun as extract input/1-document.rtf

# CBZ comic archive
bun as extract input/1-document.cbz

# CSV as raw text
bun as extract input/1-document.csv

# WebP image
bun as extract input/1-image.webp

# JSON output
bun as extract input/1-document.pdf --out json

# OCRmyPDF engine
bun as extract input/1-document.pdf --ocrmypdf

# PaddleOCR engine
bun as extract input/1-document.pdf --paddle-ocr

# Multi-language Tesseract
bun as extract input/1-document.pdf --lang eng+fra

# EPUB inspect with Bun parser
bun as extract input/1-document.epub --epub-bun --out json

# EPUB inspect with Calibre parser
bun as extract input/1-document.epub --epub-calibre --out json
```

## Flags

### Basic

| Flag             | Default | Description                                                                     |
|------------------|---------|---------------------------------------------------------------------------------|
| `--lang`         | `eng`   | Tesseract language codes, e.g. `eng+fra`                                        |
| `--out`          | `text`  | Output format: `text`, `json`, `tsv`, `hocr`                                   |
| `--password`     | —       | Password for encrypted PDFs                                                     |
| `--ocrmypdf`     | `false` | Use OCRmyPDF engine                                                             |
| `--paddle-ocr`   | `false` | Use PaddleOCR engine                                                            |
| `--epub-bun`     | `false` | EPUB deep inspect using Bun ZIP/XML parser; writes structured data into `metadata.json` |
| `--epub-calibre` | `false` | EPUB deep inspect using Calibre tools; writes structured data into `metadata.json` |

### Advanced (Tesseract only)

| Flag                | Default | Description                                        |
|---------------------|---------|----------------------------------------------------|
| `--dpi`             | `300`   | Render DPI for OCR pages                           |
| `--psm`             | `3`     | Tesseract page segmentation mode                   |
| `--oem`             | `1`     | Tesseract OCR engine mode                          |
| `--page-separator`  | `\n\n`  | Custom string between pages                        |
| `--preserve-spaces` | `false` | Enable `preserve_interword_spaces=1`               |
| `--rotate`          | `0`     | Rotate pages before OCR (degrees)                  |

## Notes

- Supported document formats: PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, CBZ.
- Supported image formats: PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, GIF.
- DOCX/PPTX/XLSX/ODF attempt native ZIP+XML parsing first; OCR fallback triggers automatically if quality check fails.
- EPUB inspect modes emit metadata-only output (`metadata.json`).
- CSV always returns raw text; OCR flags produce a warning and are ignored.
- LIT support is best-effort (Calibre's LIT import is deprecated).
- Local setup/install details are in [`extract-document-setup.md`](./extract-document-setup.md).
