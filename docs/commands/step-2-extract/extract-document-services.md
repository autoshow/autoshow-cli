# extract (services)

Extract text from documents and images using service OCR only.

## Outline

- [Usage](#usage)
- [Service engine](#service-engine)
- [Mistral OCR](#mistral-ocr)
- [Examples](#examples)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as extract [input] [flags]
```

## Service engine

| Format                     | `--mistral-ocr <model>`                          |
|----------------------------|--------------------------------------------------|
| PDF                        | `pdf+mistral-ocr`                                |
| EPUB (with OCR flag)       | LibreOffice→PDF→`pdf+mistral-ocr`                |
| MOBI / AZW3 / FB2 / LIT   | Calibre→EPUB→LibreOffice→PDF→`pdf+mistral-ocr`   |
| DOCX / PPTX / XLSX / ODF  | force LibreOffice→PDF→`office+mistral-ocr`       |
| RTF                        | LibreOffice→PDF→`rtf+mistral-ocr`                |
| CBZ                        | per-image `cbz+mistral-ocr`                      |
| PNG / JPG / TIF            | `image+mistral-ocr`                              |
| WebP / BMP / GIF           | unsupported (standard image formats only)        |
| CSV                        | raw text (`csv-raw`), OCR flag ignored with warning |

## Mistral OCR

- Supports PDF and standard image (PNG/JPG/TIF) input directly.
- Other formats are converted to PDF or processed per-image before routing to Mistral.
- Supported models: `mistral-ocr-latest`, `mistral-ocr-2512`.
- File limits: up to 50 MB and 1000 pages per request.
- Current pricing reference: `$2 / 1000 pages`.
- `--lang` is ignored by Mistral OCR; `languageSupported: false` is recorded in metadata.

## Examples

```bash
bun as extract input/1-document.pdf --mistral-ocr mistral-ocr-2512
bun as extract input/1-document.jpg --mistral-ocr mistral-ocr-2512
bun as extract input/1-document.epub --mistral-ocr mistral-ocr-2512
bun as extract input/1-document.docx --mistral-ocr mistral-ocr-2512
```

## Flags

| Flag                      | Description                                               |
|---------------------------|-----------------------------------------------------------|
| `--mistral-ocr <model>`   | Use Mistral OCR engine (PDF, image, and convertible formats) |
| `--out`                   | Output format: `text`, `json`, `tsv`, `hocr`             |
| `--password`              | Password for encrypted PDFs                               |

## Notes

- Supported document formats: PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CBZ.
- Supported image formats for direct Mistral routing: PNG, JPG, JPEG, TIF, TIFF.
- WebP/BMP/GIF are not supported with `--mistral-ocr` (use local engines for those formats).
- CSV always returns raw text regardless of OCR flags.
- EPUB deep inspection (`--epub-bun`, `--epub-calibre`) produces metadata-only JSON output and is unaffected by `--mistral-ocr`.
- Service setup/env details are in [`extract-document-setup.md`](./extract-document-setup.md).
