# ocr (services)

Extract text with the hosted extraction paths exposed by `bun as ocr`: Mistral OCR, GLM OCR, Firecrawl article extraction, and GLM Reader article extraction. Alias: `extract`.

## Outline

- [Usage](#usage)
- [Hosted Article Routing](#hosted-article-routing)
- [Mistral OCR Routing](#mistral-ocr-routing)
- [GLM OCR Routing](#glm-ocr-routing)
- [Service Environment](#service-environment)
- [Examples](#examples)
- [Standalone `ocr` Flags](#standalone-ocr-flags)
- [Notes](#notes)

## Usage

```bash
bun as ocr [input] --mistral-ocr <model>
bun as ocr [input] --glm-ocr glm-ocr
bun as ocr <article-url> --url-backend firecrawl
bun as ocr <article-url> --url-backend glm-reader
```

## Hosted Article Routing

Remote HTML/article URLs can be routed through Firecrawl or GLM Reader.

| Input family | Service path |
|--------------|--------------|
| Remote article URL (HTML response) with `--url-backend firecrawl` | `html+firecrawl` markdown extraction |
| Remote article URL (HTML response) with `--url-backend glm-reader` | `html+glm-reader` markdown extraction |
| Local `.html` / `.htm` with `--url-backend firecrawl` | ignored with a warning; falls back to `html+defuddle` |
| Local `.html` / `.htm` with `--url-backend glm-reader` | ignored with a warning; falls back to `html+defuddle` |

Rules:
- `defuddle` remains the default article backend unless you pass `--url-backend firecrawl`, `--url-backend glm-reader`, or set `AUTOSHOW_URL_BACKEND`
- the hosted default API requires `FIRECRAWL_API_KEY`
- GLM Reader requires `GLM_API_KEY`
- if `FIRECRAWL_API_URL` points at a self-hosted Firecrawl instance, API key auth is optional
- `ZAI_BASE_URL` optionally overrides the GLM API base URL
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

## GLM OCR Routing

| Input family | Service path |
|--------------|--------------|
| PDF | `glm-ocr` |
| EPUB with `--glm-ocr` | EPUB to PDF, then GLM OCR |
| MOBI / AZW3 / FB2 / LIT | Calibre to EPUB, then EPUB to PDF, then GLM OCR |
| DOCX / PPTX / XLSX / ODF | LibreOffice to PDF, then `office+glm-ocr` |
| RTF | LibreOffice to PDF, then `rtf+glm-ocr` |
| CBZ | per-image `cbz+glm-ocr` |
| PNG / JPG | `image+glm-ocr` |
| TIF / TIFF / WebP / BMP / GIF | rejected; direct GLM routing only accepts PNG / JPG |
| CSV | raw text; OCR flag is ignored with a warning |

Current GLM OCR models:
- `glm-ocr`

## Service Environment

```bash
# Mistral OCR
MISTRAL_API_KEY=...

# GLM OCR + GLM Reader
GLM_API_KEY=...

# Optional: override GLM/Z.ai API base URL
ZAI_BASE_URL=https://api.z.ai/api/paas/v4

# Firecrawl hosted API
FIRECRAWL_API_KEY=...

# Optional: point at a self-hosted Firecrawl instance
FIRECRAWL_API_URL=http://localhost:3002

# Optional: make a hosted article backend the default for remote article URLs
AUTOSHOW_URL_BACKEND=firecrawl
# or
AUTOSHOW_URL_BACKEND=glm-reader
```

## Examples

```bash
bun as ocr input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-latest
bun as ocr input/examples/document/1-document.jpg --mistral-ocr mistral-ocr-2512
bun as ocr input/examples/document/1-epub.epub --mistral-ocr mistral-ocr-2512
bun as ocr input/examples/document/1-docx.docx --mistral-ocr mistral-ocr-latest
bun as ocr input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-latest --price

bun as ocr input/examples/document/1-document.pdf --glm-ocr glm-ocr
bun as ocr input/examples/document/1-document.jpg --glm-ocr glm-ocr
bun as ocr input/examples/document/1-epub.epub --glm-ocr glm-ocr
bun as ocr input/examples/document/1-document.pdf --glm-ocr glm-ocr --price

# Remote article extraction through Firecrawl
bun as ocr https://ajcwebdev.com --url-backend firecrawl

# Remote article extraction through GLM Reader
bun as ocr https://ajcwebdev.com --url-backend glm-reader

# Firecrawl with JSON output
bun as ocr https://ajcwebdev.com --url-backend firecrawl --out json

# GLM Reader with JSON output
bun as ocr https://ajcwebdev.com --url-backend glm-reader --out json

# Make Firecrawl the default backend for remote article URLs
AUTOSHOW_URL_BACKEND=firecrawl bun as ocr https://ajcwebdev.com

# Make GLM Reader the default backend for remote article URLs
AUTOSHOW_URL_BACKEND=glm-reader bun as ocr https://ajcwebdev.com

# Self-hosted Firecrawl instance
FIRECRAWL_API_URL=http://localhost:3002 bun as ocr https://ajcwebdev.com --url-backend firecrawl
```

## Standalone `ocr` Flags

| Flag | Description |
|------|-------------|
| `--mistral-ocr <model>` | Use Mistral OCR |
| `--glm-ocr <model>` | Use GLM OCR |
| `--url-backend <defuddle|firecrawl|glm-reader>` | Select the article/HTML backend; hosted backends apply only to remote article URLs |
| `--out <format>` | `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--lang <codes>` | Accepted by the CLI but ignored by Mistral OCR |
| `--epub-bun` / `--epub-calibre` | EPUB inspect modes, which take precedence on EPUB inputs |
| `--price` | Show the aggregated OCR estimate and exit |

## Notes

- Current pricing metadata in the project config is `$2 / 1000 pages` for both Mistral OCR model IDs.
- GLM OCR preflight uses a heuristic token estimate (`4000` prompt tokens per page); actual post-run cost uses returned prompt/completion usage.
- `--lang` is ignored when the active extraction method uses Mistral OCR.
- `--lang` is also ignored when the active extraction method uses GLM OCR.
- Firecrawl article extraction preflight is estimated as `1 credit / page` at the configured Standard-plan effective rate (`$83 / 100K credits`, currently `0.08300¢` per article URL).
- GLM Reader cost is not estimated locally during `--price`.
- Local `.html` / `.htm` inputs always use `defuddle` even if `--url-backend firecrawl` or `--url-backend glm-reader` is passed.
- Standalone `ocr` does not expose the advanced Tesseract tuning flags; those are only available through `write`.
- Local tool setup is in [`extract-document-local.md#setup`](./extract-document-local.md#setup).
