# Document Processing Pipeline

Step-by-step diagram of document detection, text extraction, and optional LLM summarization.

```
src/process-steps/process-document.ts

┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 1: Download / Detect Document                      │
│          src/process-steps/step-1-download/document/dl-document.ts           │
│                                                                              │
│  For URL documents:                                                          │
│  └── fetch() → save to temp file → cleanup after processing                 │
│                                                                              │
│  detectDocumentFormat()                                                       │
│  ├── .pdf  → 'pdf'                                                           │
│  ├── .epub → 'epub'                                                          │
│  ├── .png / .jpg / .jpeg / .tif / .tiff → 'image'                           │
│  ├── .docx → 'docx'                                                          │
│  ├── .pptx → 'pptx'                                                          │
│  ├── .xlsx → 'xlsx'                                                          │
│  ├── .odt / .ods / .odp → 'odf'                                             │
│  └── unrecognized → null (error)                                             │
│                                                                              │
│  Read metadata via mutool (PDF):                                             │
│  └── mutool info → pageCount, title, author                                  │
│                                                                              │
│  Create output dir: output/YYYY-MM-DD_HH-MM-SS_<title>/                     │
│                                                                              │
│  Output: DocumentMetadata { title, author, pageCount, format, fileSize }     │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                                    v
┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 2: Extract Text                                    │
│               src/process-steps/step-2/document/run-extract.ts            │
│                                                                              │
│                       ┌──────────────────┐                                   │
│                       │  Document Type?  │                                   │
│                       └──┬────────┬───┬──┘                                   │
│                          |        |   |                                      │
│                    PDF/EPUB     Image  docx/pptx/xlsx/odf                    │
│                       |           |        |                                 │
│                       v           v        v                                 │
│  ┌──────────────────────┐  ┌──────────┐  ┌─────────────────────────┐        │
│  │  Engine Selection    │  │ Direct   │  │  ZIP+XML extraction     │        │
│  │                      │  │ OCR via  │  │  (no external deps)     │        │
│  │  --ocrmypdf →        │  │ Tesseract│  │                         │        │
│  │    OCRmyPDF (PDF)    │  │          │  │  docx → word/document   │        │
│  │  --paddle-ocr →      │  │ --dpi    │  │  pptx → ppt/slides/*   │        │
│  │    PaddleOCR         │  │ --lang   │  │  xlsx → sharedStrings   │        │
│  │  default →           │  │ --psm    │  │  odf  → content.xml     │        │
│  │    MuPDF + Tesseract │  │ --oem    │  └────────────┬────────────┘        │
│  │                      │  │ --rotate │               |                     │
│  │  Stage A: MuPDF      │  └────┬─────┘               |                     │
│  │  mutool draw -F text │       |                      |                     │
│  │  per-page text       │       |                      |                     │
│  └──────────┬───────────┘       |                      |                     │
│             |                   |                      |                     │
│     For each page:              |                      |                     │
│     text found?                 |                      |                     │
│     ┌──┴──┐                     |                      |                     │
│    yes    no                    |                      |                     │
│     |      |                   |                      |                     │
│     |      v                   |                      |                     │
│     |  ┌──────────────┐        |                      |                     │
│     |  │ Stage B: OCR │        |                      |                     │
│     |  │ Tesseract    │        |                      |                     │
│     |  │ 1. Render    │        |                      |                     │
│     |  │    page→PNG  │        |                      |                     │
│     |  │ 2. OCR text  │        |                      |                     │
│     |  └──────┬───────┘        |                      |                     │
│     |         |                |                      |                     │
│     v         v                v                      v                     │
│  ┌──────────────────────────────────────────────────────────────┐            │
│  │  ExtractionResult                                            │            │
│  │  ├── text: combined full text                                │            │
│  │  ├── pages[]: { pageNumber, method:'text'|'ocr'|'skipped',   │            │
│  │  │             text, confidence? }                           │            │
│  │  ├── totalPages, ocrPages, textPages                         │            │
│  │  └── extractionMethod: 'mutool+tesseract' | 'ocrmypdf' |     │            │
│  │       'paddle-ocr' | 'mutool+paddle-ocr' | 'docx' | ...     │            │
│  └──────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  Output (always written):                                                    │
│  ├── extraction.txt  → full text                                             │
│  ├── extraction.json → structured per-page results (default --out json)      │
│  ├── extraction.tsv  → (if --out tsv)                                        │
│  └── extraction.hocr → (if --out hocr)                                      │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                        ┌───────────┴───────────┐
                        |                       |
                  extract cmd               write cmd
                        |                       |
                        v                       v
                ┌───────────────┐  ┌────────────────────────────────────┐
                │ Write files:  │  │  Build prompt + LLM Summary        │
                │               │  │                                    │
                │ extraction.txt│  │  buildDocumentPrompt()             │
                │ extraction.   │  │  ├── Extracted text                │
                │   json        │  │  └── Document metadata             │
                │ metadata.json │  │                                    │
                │ (step1+step2) │  │  Output: prompt.md                 │
                │               │  │                                    │
                │ +tsv/hocr if  │  │  LLM call → text.md               │
                │  requested    │  │  metadata.json (step1+step2+step3) │
                │               │  │                                    │
                │ DONE          │  │  DONE                              │
                └───────────────┘  └────────────────────────────────────┘
```
