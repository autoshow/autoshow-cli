# ocr (services)

Extract text with the hosted extraction paths currently exposed by `bun as ocr`: Mistral OCR and Firecrawl article extraction. Alias: `extract`.

## Outline

- [Usage](#usage)
- [Firecrawl Article Routing](#firecrawl-article-routing)
- [Mistral OCR Routing](#mistral-ocr-routing)
- [Service Environment](#service-environment)
- [Examples](#examples)
- [Standalone `ocr` Flags](#standalone-ocr-flags)
- [Notes](#notes)

## Usage

```bash
bun as ocr [input] --mistral-ocr <model>
bun as ocr <article-url> --url-backend firecrawl
```

## Firecrawl Article Routing

Firecrawl is the hosted backend for remote HTML/article URLs.

| Input family | Service path |
|--------------|--------------|
| Remote article URL (HTML response) with `--url-backend firecrawl` | `html+firecrawl` markdown extraction |
| Local `.html` / `.htm` with `--url-backend firecrawl` | ignored with a warning; falls back to `html+defuddle` |

Rules:
- `defuddle` remains the default article backend unless you pass `--url-backend firecrawl` or set `AUTOSHOW_URL_BACKEND=firecrawl`
- the hosted default API requires `FIRECRAWL_API_KEY`
- if `FIRECRAWL_API_URL` points at a self-hosted Firecrawl instance, API key auth is optional
- OCR engine flags do not apply to HTML/article extraction

## Mistral OCR Routing

| Input family | Service path |
|--------------|--------------|
| PDF | `mistral-ocr` |
| EPUB with `--mistral-ocr` | EPUB to PDF, then Mistral OCR |
| MOBI / AZW3 / FB2 / LIT | Calibre to EPUB, then EPUB to PDF, then Mistral OCR |
| DOCX / PPTX / XLSX / ODF | LibreOffice to PDF, then `office+mistral-ocr` |
| RTF | LibreOffice to PDF, then `rtf+mistral-ocr` |
| CBZ | per-image `cbz+mistral-ocr` |
| PNG / JPG / TIF | `image+mistral-ocr` |
| WebP / BMP / GIF | rejected; direct Mistral routing only accepts PNG / JPG / TIF |
| CSV | raw text; OCR flag is ignored with a warning |

Current Mistral OCR models:
- `mistral-ocr-latest`
- `mistral-ocr-2512`

## Service Environment

```bash
# Mistral OCR
MISTRAL_API_KEY=...

# Firecrawl hosted API
FIRECRAWL_API_KEY=...

# Optional: point at a self-hosted Firecrawl instance
FIRECRAWL_API_URL=http://localhost:3002

# Optional: make firecrawl the default for remote article URLs
AUTOSHOW_URL_BACKEND=firecrawl
```

## Examples

```bash
bun as ocr input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-latest
bun as ocr input/examples/document/1-document.jpg --mistral-ocr mistral-ocr-2512
bun as ocr input/examples/document/1-epub.epub --mistral-ocr mistral-ocr-2512
bun as ocr input/examples/document/1-docx.docx --mistral-ocr mistral-ocr-latest
bun as ocr input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-latest --price

# Remote article extraction through Firecrawl
bun as ocr https://ajcwebdev.com --url-backend firecrawl

# Firecrawl with JSON output
bun as ocr https://ajcwebdev.com --url-backend firecrawl --out json

# Make Firecrawl the default backend for remote article URLs
AUTOSHOW_URL_BACKEND=firecrawl bun as ocr https://ajcwebdev.com

# Self-hosted Firecrawl instance
FIRECRAWL_API_URL=http://localhost:3002 bun as ocr https://ajcwebdev.com --url-backend firecrawl
```

## Standalone `ocr` Flags

| Flag | Description |
|------|-------------|
| `--mistral-ocr <model>` | Use Mistral OCR |
| `--url-backend <defuddle|firecrawl>` | Select the article/HTML backend; `firecrawl` applies only to remote article URLs |
| `--out <format>` | `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--lang <codes>` | Accepted by the CLI but ignored by Mistral OCR |
| `--epub-bun` / `--epub-calibre` | EPUB inspect modes, which take precedence on EPUB inputs |
| `--price` | Show the aggregated OCR estimate and exit |

## Notes

- Current pricing metadata in the project config is `$2 / 1000 pages` for both Mistral OCR model IDs.
- `--lang` is ignored when the active extraction method uses Mistral OCR.
- Firecrawl article extraction reports that credits apply, but exact Firecrawl cost is not estimated locally during `--price`.
- Local `.html` / `.htm` inputs always use `defuddle` even if `--url-backend firecrawl` is passed.
- Standalone `ocr` does not expose the advanced Tesseract tuning flags; those are only available through `write`.
- Local tool setup is in [`extract-document-local.md#setup`](./extract-document-local.md#setup).
