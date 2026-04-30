# extract OCR

Documents and images route through local OCR, hosted OCR, or native text extraction depending on the input format.

## Outline

- [OCR Setup](#ocr-setup)
- [OCR Environment](#ocr-environment)
- [OCR Routing](#ocr-routing)
- [EPUB Options](#epub-options)
  - [Inspect Modes](#inspect-modes)
  - [Native EPUB Export](#native-epub-export)
- [PDF Chapter Detection](#pdf-chapter-detection)
- [OCR Examples](#ocr-examples)
- [OCR Flags](#ocr-flags)
- [OCR Pricing And Manifests](#ocr-pricing-and-manifests)
- [OCR Notes](#ocr-notes)

See the [`extract` overview](./01-extract.md) for input routing across STT, OCR, article HTML, and X/Twitter inputs. Remote article URLs and local HTML are documented separately in [URL and X extraction](./04-extract-url.md).

## OCR Setup

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
bun as extract input/examples/document/1-document.pdf --paddle-ocr
```

`--epub-calibre` can also trigger lazy Calibre setup on supported platforms when the Calibre CLI tools are missing.

## OCR Environment

Use these only when you select the matching hosted OCR engine:

```bash
MISTRAL_API_KEY=...
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=...
ANTHROPIC_BASE_URL=https://api.anthropic.com
GEMINI_API_KEY=...
GLM_API_KEY=...
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
KIMI_API_KEY=...
KIMI_BASE_URL=https://api.moonshot.ai/v1
DEEPINFRA_API_KEY=...
DEEPINFRA_BASE_URL=https://api.deepinfra.com/v1/openai
DEAPI_API_KEY=...
DEAPI_BASE_URL=https://api.deapi.ai
```

## OCR Routing

| Input family | Default path | Other available paths |
|--------------|--------------|-----------------------|
| PDF | `mutool+tesseract` | `--tesseract`, `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr`, `--kimi-ocr`, `--openai-ocr`, `--anthropic-ocr`, `--gemini-ocr`, `--deepinfra-ocr`, `--deapi-ocr` |
| EPUB | cleaned native extraction (`epub-text`) | `--tesseract`, `--ocrmypdf`, `--paddle-ocr`, `--mistral-ocr`, `--glm-ocr`, `--kimi-ocr`, `--openai-ocr`, `--anthropic-ocr`, `--gemini-ocr`, `--deepinfra-ocr`, `--deapi-ocr`, `--epub-bun`, `--epub-calibre` |
| MOBI / AZW3 / FB2 / LIT | normalize to EPUB, then follow the EPUB path | same |
| DOCX / PPTX / XLSX / ODF | native ZIP/XML text extraction | OCR flags are ignored with a warning |
| RTF | native RTF text extraction | OCR flags are ignored with a warning |
| CBZ | per-image OCR | local or hosted engines |
| CSV | raw text | OCR flags are ignored with a warning |
| PNG / JPG / JPEG / TIF / TIFF | local OCR by default | hosted OCR also supported; `--deepinfra-ocr`, `--gemini-ocr`, `--kimi-ocr`, and `--deapi-ocr` support PNG/JPG directly, and `--anthropic-ocr` / `--openai-ocr` / `--gemini-ocr` / `--kimi-ocr` / `--deepinfra-ocr` / `--deapi-ocr` can normalize TIF/TIFF to PNG when ImageMagick is available |
| WebP / BMP | normalize locally when possible, then OCR | `--openai-ocr`, `--anthropic-ocr`, `--gemini-ocr`, `--kimi-ocr`, `--deepinfra-ocr`, and `--deapi-ocr` support WebP directly; `--gemini-ocr` and `--deapi-ocr` support BMP directly and `--openai-ocr` / `--anthropic-ocr` / `--kimi-ocr` / `--deepinfra-ocr` can normalize BMP to PNG when ImageMagick is available |
| GIF | local OCR by default | `--openai-ocr`, `--anthropic-ocr`, `--kimi-ocr`, and `--deapi-ocr` support GIF directly; `--gemini-ocr` and `--deepinfra-ocr` can normalize GIF to PNG when ImageMagick is available |

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

## OCR Examples

```bash
# Default PDF extraction
bun as extract input/examples/document/1-document.pdf

# JSON output
bun as extract input/examples/document/1-document.pdf --out json

# PDF chapter autodetection
bun as extract input/examples/document/3-document.pdf --chapters

# PDF chapter autodetection with model-assisted fallback
bun as extract input/examples/document/3-document.pdf --chapters --pdf-chapter-mode auto

# Native EPUB extraction plus chapter side artifacts
bun as extract input/examples/document/1-epub.epub --chapters

# Native EPUB chunk side artifacts at 50k characters
bun as extract input/examples/document/1-epub.epub --length 50

# OCRmyPDF path
bun as extract input/examples/document/1-document.pdf --ocrmypdf

# Paddle OCR path
bun as extract input/examples/document/1-document.pdf --paddle-ocr

# Explicit Tesseract path
bun as extract input/examples/document/1-document.pdf --tesseract

# Hosted OCR
bun as extract input/examples/document/1-document.pdf --mistral-ocr mistral-ocr-2512
bun as extract input/examples/document/1-document.pdf --glm-ocr glm-ocr
bun as extract input/examples/document/1-document.pdf --kimi-ocr kimi-k2.6
bun as extract input/examples/document/1-document.pdf --openai-ocr gpt-5.4-nano
bun as extract input/examples/document/1-document.pdf --anthropic-ocr claude-haiku-4-5
bun as extract input/examples/document/1-document.pdf --gemini-ocr gemini-3.1-flash-lite-preview
bun as extract input/examples/document/1-document.pdf --deepinfra-ocr allenai/olmOCR-2-7B-1025
bun as extract input/examples/document/1-document.jpg --deepinfra-ocr Qwen/Qwen3-VL-30B-A3B-Instruct
bun as extract input/examples/document/1-document.pdf --aws-textract detect-text
bun as extract input/examples/document/1-document.pdf --gcloud-docai ocr
bun as extract input/examples/document/1-document.pdf --deapi-ocr Nanonets_Ocr_S_F16
bun as extract input/examples/document/1-document.png --deapi-ocr Nanonets_Ocr_S_F16
bun as extract input/examples/document/1-document.pdf --deepinfra-ocr allenai/olmOCR-2-7B-1025 --price
bun as extract input/examples/document/1-document.pdf --kimi-ocr kimi-k2.6 --price
bun as extract input/examples/document/1-document.pdf --deapi-ocr Nanonets_Ocr_S_F16 --price

# Fan out across every OCR provider in price mode
bun as extract input/examples/document/1-document.pdf --all-ocr --price

# EPUB inspect modes
bun as extract input/examples/document/1-epub.epub --epub-bun --out json
bun as extract input/examples/document/1-epub.epub --epub-calibre --out json
```

## OCR Flags

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
| `--kimi-ocr <model>` | Use Kimi OCR through the OpenAI-compatible chat API; omit the value to use `kimi-k2.6` |
| `--openai-ocr <model>` | Use OpenAI OCR; omit the value to use the cheapest supported model |
| `--anthropic-ocr <model>` | Use Anthropic OCR; omit the value to use the cheapest supported model |
| `--gemini-ocr <model>` | Use Gemini OCR; omit the value to use the cheapest supported model |
| `--deepinfra-ocr <model>` | Use DeepInfra OCR through the OpenAI-compatible chat API; omit the value to use `allenai/olmOCR-2-7B-1025` |
| `--aws-textract <model>` | Use AWS Textract; `detect-text` for text-only ($1.50/1K pages) or `analyze-document` for tables/forms/layout ($15/1K pages) |
| `--gcloud-docai <model>` | Use Google Cloud Document AI; `ocr` for Enterprise Document OCR or `layout-parser` for Gemini-powered Layout Parser |
| `--deapi-ocr <model>` | Use deAPI OCR; omit the value to use `Nanonets_Ocr_S_F16` |
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
| `--epub-bun` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | Inspect EPUB structure with Calibre |
| `--price` | Show the aggregated OCR estimate and exit |

## OCR Pricing And Manifests

DeepInfra OCR uses token pricing estimates and recorded usage when available.

| DeepInfra OCR model | Input | Output | Initial speed estimate |
|---------------------|-------|--------|------------------------|
| `allenai/olmOCR-2-7B-1025` | $0.09 / 1M tokens | $0.19 / 1M tokens | 6,000 ms/page |
| `PaddlePaddle/PaddleOCR-VL-0.9B` | $0.14 / 1M tokens | $0.80 / 1M tokens | 4,000 ms/page |
| `Qwen/Qwen3-VL-235B-A22B-Instruct` | $0.20 / 1M tokens | $0.88 / 1M tokens | 20,000 ms/page |
| `Qwen/Qwen3-VL-30B-A3B-Instruct` | $0.15 / 1M tokens | $0.60 / 1M tokens | 10,000 ms/page |

- DeepInfra OCR price mode uses a heuristic of 4,000 input tokens plus 1,000 output tokens per page. Actual runs write `promptTokens` and `completionTokens` into `run.json` when DeepInfra returns usage.
- Cached-token pricing is not used for OCR estimates because AutoShow sends direct or rendered page images and those image requests are not cache-stable.
- DeepInfra implementation details are based on DeepInfra's [Vision & OCR](https://docs.deepinfra.com/chat/vision), [OpenAI-compatible Chat Completions](https://docs.deepinfra.com/api-reference/chat-completions/openai-chat-completions), and [OCR catalog](https://deepinfra.com/models/ocr) docs.

Kimi OCR uses token pricing estimates and recorded usage when available.

| Kimi OCR model | Input | Output | Price-mode page heuristic | Initial speed estimate |
|----------------|-------|--------|---------------------------|------------------------|
| `kimi-k2.6` | $0.95 / 1M tokens | $4.00 / 1M tokens | 4,000 input + 1,000 output tokens, about $0.0078/page or $7.80/1K pages | 6,000 ms/page |

- Kimi OCR price mode uses cache-miss K2.6 input/output pricing from `project/links/kimi-general-ocr-text-links.md`. Cached input pricing is not used because OCR image requests are not cache-stable.
- Actual Kimi OCR runs write `promptTokens` and `completionTokens` into `run.json` when the API returns usage.

deAPI OCR uses provider quotes when possible.

- For local image preflight, `--price` calls the deAPI OCR price endpoint and records an exact estimate when `DEAPI_API_KEY` is available. For local PDFs, price mode renders pages to temporary PNGs and sums deAPI page quotes when possible.
- If exact deAPI OCR pricing is unavailable, AutoShow reports a non-zero heuristic from deAPI's published OCR output-character rate.
- During execution, deAPI OCR quotes each direct image or rendered PDF page before submission when the provider price endpoint is available. The summed quote is written to `run.json` as `providerCostCents` with `providerCostSource: "provider_quote"`.
- If quote lookup fails, deAPI OCR still runs and records a registry fallback cost.

## OCR Notes

- Standalone `extract` document runs write the root extraction artifact (`extraction.txt` or `result.json`) plus `run.json`.
- EPUB export and PDF chapter autodetection write additive `chapters/` or `chunks/` side artifacts inside the same output directory.
- Supported document formats include PDF, EPUB, MOBI, AZW3, FB2, LIT, DOCX, PPTX, XLSX, ODT, ODS, ODP, RTF, CSV, and CBZ.
- Supported image formats include PNG, JPG, JPEG, TIF, TIFF, WebP, BMP, and GIF.
- Mistral OCR accepts PDF and standard images (`PNG`, `JPG`, `TIF`); GLM OCR accepts PDF plus `PNG` and `JPG`; Kimi OCR accepts direct `PNG`, `JPG/JPEG`, `WEBP`, and `GIF` images and rendered PDF/EPUB-derived PDF pages as `PNG`; OpenAI OCR accepts PDF plus `PNG`, `JPG`, `WEBP`, and `GIF` directly; Anthropic OCR accepts standard unencrypted PDFs plus `PNG`, `JPG`, `WEBP`, and `GIF` directly; Gemini OCR accepts PDF plus `PNG`, `JPG`, `WEBP`, and `BMP` directly; DeepInfra OCR accepts direct `PNG`, `JPG/JPEG`, and `WEBP` images and rendered PDF/EPUB-derived PDF pages as `PNG`; deAPI OCR accepts rendered PDF pages plus `PNG`, `JPG`, `JPEG`, `GIF`, `BMP`, and `WEBP` images directly.
- OpenAI OCR normalizes `BMP` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- Anthropic OCR normalizes `BMP` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- Anthropic OCR currently enforces the bundled Claude docs caps from `project/links/claude-all-links.md`: direct images up to 5 MB each, PDF chunk uploads through the Files API, and only standard unencrypted PDFs.
- Anthropic OCR splits PDFs into internal 10-page Files API uploads, sums token usage across chunks, and best-effort deletes uploaded files after each chunk run.
- Gemini OCR normalizes `GIF` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- Kimi OCR normalizes `BMP` and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error. Kimi direct or rendered image uploads are capped at 100 MB.
- DeepInfra OCR normalizes `GIF`, `BMP`, and `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error. DeepInfra uploads are capped at 20 MB per direct or rendered image and omit OpenAI's `detail` parameter.
- deAPI OCR normalizes `TIF/TIFF` inputs to `PNG` before upload when ImageMagick is available; otherwise those formats are rejected with a usage error.
- GLM OCR currently enforces the bundled docs caps from `project/links/glm-all-links.md`: images up to 10 MB, PDFs up to 50 MB, and PDFs up to 100 pages.
- OpenAI OCR currently enforces the bundled PDF size cap from `project/links/openai-all-links.md`: PDFs up to 50 MB.
- Gemini OCR currently enforces the bundled docs caps from `project/links/gemini-all-links.md`: inline PDFs up to 50 MB, inline non-PDF inputs up to 100 MB, Files API uploads up to 2 GB per file, and PDFs up to 1000 pages.
- No numeric Mistral OCR file-size/page-count caps were found in `project/links/all-all-links.md`, so this CLI does not enforce any new numeric limits for that provider from that source.
- Office inputs try native extraction first and only fall back to OCR when the extracted text quality is poor.
- Config defaults can persist chapter export settings under `defaults.extract.chapters`, `defaults.extract.length`, and `defaults.extract.pdfChapterMode`.
- Backfill existing OCR outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
- AWS Textract supports PDF, PNG, JPG, and TIFF natively. BMP, WebP, and GIF inputs are normalized to PNG via ImageMagick when available.
- AWS Textract uses the AWS CLI for authentication (`aws configure` or `AWS_PROFILE`/`AWS_REGION`). No separate API key is needed - it reuses the same AWS credentials as AWS STT.
- AWS Textract offers two models: `detect-text` for text-only extraction at $1.50 per 1,000 pages, and `analyze-document` for tables/forms/layout extraction at $15 per 1,000 pages.
- Single-page images use the sync Textract API directly. PDFs and multi-page TIFF files use the async API via S3 staging, which requires an S3 bucket (pass `--aws-bucket`, save one with `bun as config`, or run `bun as setup --aws --aws-create-bucket` to create one and print the value).
- AWS Textract async supports files up to 500 MB and up to 3,000 pages per document.
- Google Cloud Document AI uses the OCR processor and GCS staging bucket from environment variables or explicitly saved config. `bun as setup --gcloud --gcloud-project PROJECT_ID` can create or discover those resources and print the values, but it does not update `config/autoshow.json`; `layout-parser` remains an explicit processor setup step unless you save `gcloudDocaiLayoutProcessorId` or set `AUTOSHOW_GCLOUD_DOCAI_LAYOUT_PROCESSOR_ID`.
- Tesseract tuning flags such as `--dpi`, `--psm`, `--oem`, `--rotate`, `--page-separator`, and `--preserve-spaces` work on the `extract` document/OCR route and on [`write`](../step-3-write/write-text.md).
- Non-Tesseract engines may ignore Tesseract-specific tuning flags and report a warning when they do.
