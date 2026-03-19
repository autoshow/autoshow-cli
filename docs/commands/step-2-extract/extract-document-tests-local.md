# Extract Tests (local)

```bash
bun t \
  test/test-cases/e2e/step-2-extract-e2e/extract-options.test.ts \
  test/test-cases/e2e/step-2-extract-e2e/extract-paddle-ocr-image.test.ts
```

For cost-capped runs, append `--budget <whole-number-cents>` (for example `--budget 5`). In normal test mode the runner performs pricing preflight first and prints RUN/SKIP plus a skipped-command list before executing tests. Combined with `--test-price`, it marks commands under over-budget test keys as skipped in the price report.

## Outline

- [Validation / Price / Non-E2E](#validation--price--non-e2e)
- [E2E Local](#e2e-local)

## Validation / Price / Non-E2E

No separate local extract validation file exists; validation paths are included in `extract-options.test.ts`.

## E2E Local

**Tier:** `smoke`/`local`

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-options.test.ts
```

Local coverage inside this file includes:

**Core format dispatch:**
- default PDF extract (`mutool+tesseract`, `extraction.txt` only)
- `--out json` writes `extraction.json` only (strict `--out` contract)
- `--out tsv` writes `extraction.tsv` only
- `--out hocr` writes `extraction.hocr` only
- `--ocrmypdf` PDF path
- `--paddle-ocr` PDF path (when runtime exists)

**EPUB family:**
- EPUB default text extraction (`epub-text`, no OCR invoked, chapter headings present)
- EPUB with `--ocrmypdf` (LibreOffice→PDF→OCRmyPDF)
- EPUB with `--paddle-ocr` (LibreOffice→PDF→PaddleOCR)
- `--epub-bun` inspect mode (metadata-only, `step2.epub` in `metadata.json`)
- `--epub-calibre` inspect mode (same shape)
- `--epub-bun` + `--epub-calibre` mutual-exclusion error
- non-EPUB fallback when EPUB inspect flags present

**Ebook normalization:**
- MOBI input normalizes to EPUB via Calibre, extraction succeeds (`conversionChain: ['calibre']` in metadata)
- AZW3 and FB2 normalize similarly

**Office family:**
- DOCX/PPTX/XLSX/ODF native extraction success path (`office-native`)
- Office low-text fallback triggers LibreOffice+OCR (`conversionChain: ['libreoffice']` in metadata)
- Office with explicit `--ocrmypdf` skips native parser
- Spreadsheet-heavy XLSX passes quality heuristic without OCR fallback

**Other formats:**
- RTF→PDF→Tesseract (`rtf+tesseract`)
- CSV raw text (`csv-raw`); OCR flag produces warning and is ignored
- CBZ images extracted in natural numeric order (`cbz+tesseract`)
- PNG/JPG/TIF image extraction (`image+tesseract`)
- WebP image extraction via ImageMagick normalization

**Validation:**
- `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr` mutual-exclusion error
- Strict `--out` writes only the requested artifact + `metadata.json` (no dual-write)
- Conversion failure (missing Calibre/LibreOffice) produces clear error naming the missing tool
- CSV file with binary content rejected with error
- LIT input with Calibre unavailable produces actionable error

**Tier:** `slow-local`

```bash
bun t test/test-cases/e2e/step-2-extract-e2e/extract-paddle-ocr-image.test.ts
```

Covers `--paddle-ocr` image extraction (slow due to PaddleOCR Python startup overhead).

Local setup prerequisites are in [`extract-document-setup.md`](./extract-document-setup.md).
