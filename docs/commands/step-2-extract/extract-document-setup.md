# Extract Setup

Setup and test prerequisites for `extract`.

## Outline

- [Runtime Setup](#runtime-setup)
- [Conversion failure policy](#conversion-failure-policy)
- [Service Environment](#service-environment)
- [Setup and Validation Tests](#setup-and-validation-tests)

## Runtime Setup

```bash
# full setup
bun as setup
```

Extract-specific runtime requirements:

| Tool                                               | Required for                                                        | Install policy                                         |
|----------------------------------------------------|---------------------------------------------------------------------|--------------------------------------------------------|
| MuPDF (`mutool`)                                   | PDF/EPUB rendering and conversion                                   | auto-installed by setup                                |
| Tesseract OCR                                      | default OCR engine                                                  | auto-installed by setup                                |
| Calibre CLI (`ebook-convert`, `ebook-meta`, `calibre-debug`) | ebook normalization (MOBI/AZW3/FB2/LIT→EPUB) and `--epub-calibre` | setup-only; never auto-installs |
| LibreOffice                                        | office/RTF→PDF conversion (office quality fallback, RTF routing, EPUB+OCR path) | lazy auto-install on supported platforms; otherwise `bun as setup` |
| ImageMagick (`convert`)                            | non-standard image normalization (WebP, BMP) before OCR             | lazy auto-install on supported platforms; otherwise `bun as setup` |
| OCRmyPDF                                           | `--ocrmypdf` engine                                                 | available on `$PATH`                                   |
| PaddleOCR venv                                     | `--paddle-ocr` engine                                               | venv at `runtime/bin/paddle-ocr/`                      |

Run specific setup steps:

```bash
# Calibre tools (ebook normalization and epub-calibre inspect)
bun as setup --step calibre

# Verify sample fixture generation prerequisites
bun as setup --step sample
```

PaddleOCR can be prepared either by full setup or lazily on first use:

```bash
bun as setup
# or
bun as extract input/1-document.pdf --paddle-ocr
```

`--epub-calibre` also supports lazy setup: if Calibre tools are missing, extract triggers the same Step 1 setup path used by `bun as setup --step calibre` and then continues.

## Conversion failure policy

If a required converter (Calibre, LibreOffice, ImageMagick) is not installed, extract fails with a clear error naming the missing tool and the `bun as setup` command to fix it. If the tool is installed but the conversion process fails (non-zero exit, timeout, empty output), the item fails with the conversion error recorded in `metadata.json`.

## Service Environment

Set required env vars for service extraction:

```bash
MISTRAL_API_KEY=...
```

## Setup and Validation Tests

```bash
# all extract tests (engine conflict, local engines, service engines)
bun t test/test-cases/e2e/step-2-extract-e2e/extract-options.test.ts
```
