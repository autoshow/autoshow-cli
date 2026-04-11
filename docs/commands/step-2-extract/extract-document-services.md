# ocr (services)

Extract text with the hosted OCR path currently exposed by `bun as ocr`: Mistral OCR. Alias: `extract`.

## Outline

- [Usage](#usage)
- [Mistral OCR Routing](#mistral-ocr-routing)
- [Examples](#examples)
- [Standalone `ocr` Flags](#standalone-ocr-flags)
- [Notes](#notes)

## Usage

```bash
bun as ocr [input] --mistral-ocr <model>
```

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

## Examples

```bash
bun as ocr input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-latest
bun as ocr input/examples/document/1-document.jpg --mistral-ocr mistral-ocr-2512
bun as ocr input/examples/document/1-epub.epub --mistral-ocr mistral-ocr-2512
bun as ocr input/examples/document/1-docx.docx --mistral-ocr mistral-ocr-latest
bun as ocr input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-latest --price
```

## Standalone `ocr` Flags

| Flag | Description |
|------|-------------|
| `--mistral-ocr <model>` | Use Mistral OCR |
| `--out <format>` | `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--lang <codes>` | Accepted by the CLI but ignored by Mistral OCR |
| `--epub-bun` / `--epub-calibre` | EPUB inspect modes, which take precedence on EPUB inputs |
| `--price` | Show the aggregated OCR estimate and exit |

## Notes

- Current pricing metadata in the project config is `$2 / 1000 pages` for both Mistral OCR model IDs.
- `--lang` is ignored when the active extraction method uses Mistral OCR.
- Standalone `ocr` does not expose the advanced Tesseract tuning flags; those are only available through `write`.
- Setup and env details are in [`extract-document-local.md#setup`](./extract-document-local.md#setup).
