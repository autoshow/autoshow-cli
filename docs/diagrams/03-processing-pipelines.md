# Processing Pipelines

Step-by-step diagrams for both media and document inputs, from initial intake through optional downstream generation.

The `metadata` command (default) runs only the metadata extraction portion of Step 1 without downloading. The `download` command runs the full Step 1. The `stt`/`ocr` commands run Steps 1-2. The `write` command runs the full pipeline.

## Outline

- [Media Processing Pipeline](#media-processing-pipeline)
- [Document Processing Pipeline](#document-processing-pipeline)

## Media Processing Pipeline

```
src/cli/commands/process-steps/process-video.ts

┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 1: Download Audio                                  │
│           src/cli/commands/process-steps/step-1-download/                    │
│                                                                              │
│  extractSourceMetadata()                                                     │
│  ├── URL → yt-dlp --dump-json → title, duration, author, publishDate, ...   │
│  ├── Local file → ffprobe → duration; filename → title                       │
│  └── Fallback metadata if extraction fails                                   │
│                                                                              │
│  createUniqueDirectoryName(title)                                            │
│  └── output/YYYY-MM-DD_HH-MM-SS_<sanitized-title>/                           │
│                                                                              │
│  downloadAudio()                                                             │
│  ├── url_streaming → yt-dlp -x --audio-format wav                            │
│  ├── url_direct_media → fetch() → save to disk                               │
│  └── local file → use as-is                                                  │
│                                                                              │
│  Convert to WAV: ffmpeg -i <input> -ar 16000 -ac 1 -c:a pcm_s16le audio.wav │
│                                                                              │
│  Output: audio.wav + Step1Metadata                                           │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                                    v
┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 2: STT                                             │
│       src/cli/commands/process-steps/step-2-stt/run-stt.ts           │
│                                                                              │
│  resolveSttEngine() - picks exactly one engine:                              │
│                                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐│
│  │ --reverb   │ │--elevenlabs│ │--groq-stt  │ │--openai-stt│ │--mistral-  │ │--assemblyai- ││
│  │ Reverb ASR │ │-stt        │ │ Groq       │ │ OpenAI STT │ │stt         │ │stt           ││
│  │ (local)    │ │ ElevenLabs │ │ Whisper    │ │ (API)      │ │ Mistral    │ │ AssemblyAI   ││
│  │ diarization│ │ Scribe(API)│ │ (API)      │ │ diarization│ │ STT (API)  │ │ STT (API)    ││
│  │ --reverb-  │ │ w/speaker- │ │            │ │ w/speaker- │ │ diarization│ │ diarization  ││
│  │ verbatimic.│ │ count hint │ │            │ │ count hint │ │            │ │ w/speaker-   ││
│  │            │ │            │ │            │ │            │ │            │ │ count hint   ││
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬───────┘│
│        └───────────────┴──────────────┴──────────────┴──────────────┴────────────────┘       │
│                                    │                                         │
│           (no engine flag) → Whisper.cpp (local binary)                      │
│           --whisper MODEL: tiny|base|small|medium|large-v3-turbo|            │
│                                                                              │
│           --split: split audio into 10-min chunks, transcribe each           │
│                                    │                                         │
│                                    v                                         │
│  ┌──────────────────────────────────────────────┐                            │
│  │  TranscriptionResult                         │                            │
│  │  ├── text: full transcription                │                            │
│  │  └── segments[]: { start, end, text, speaker? }│                         │
│  └──────────────────────────────────────────────┘                            │
│                                                                              │
│  Output: transcription.txt + Step2Metadata                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                        ┌───────────┴───────────┐
                        |                       |
                  skipLLM=true            skipLLM=false
                  (transcribe cmd)         (write cmd)
                        |                       |
                        v                       v
                ┌───────────────┐  ┌────────────────────────────────────┐
                │ Write prompt  │  │  STEP 3: LLM Summary               │
                │ file only     │  │  src/cli/commands/process-steps/   │
                │               │  │  step-3-write/                     │
                │ prompt.md     │  │                                    │
                │ metadata.json │  │  buildPrompt()                     │
                │ (step1+step2) │  │  ├── Video metadata                │
                │               │  │  ├── Transcription segments        │
                │ DONE          │  │  ├── Speaker labels (if diarized)  │
                └───────────────┘  │  └── Formatting instructions       │
                                   │                                    │
                                   │  Output: prompt.md                 │
                                   │                                    │
                                   │  runLLM() → Provider Selection:    │
                                   │  (see 04-providers-and-setup.md)   │
                                   │                                    │
                                   │  Output: text.md + Step3Metadata   │
                                   └────────────────────────────────────┘
                                                    |
                                        ┌───────────┴──────────────────┐
                                        │  Optional steps 4-7          │
                                        │  (triggered by flags on      │
                                        │   write cmd)                 │
                                        │                              │
                                        │  Step 4: TTS (--kitten-tts,  │
                                        │   --elevenlabs-tts,          │
                                        │   --minimax-tts,             │
                                        │   --groq-tts,                │
                                        │   --openai-tts,              │
                                        │   --gemini-tts)              │
                                        │  Step 5: Image (--gemini-    │
                                        │   image, --openai-image, ...)│
                                        │  Step 6: Video (--gemini-    │
                                        │   video, --minimax-video...) │
                                        │  Step 7: Music (--elevenlabs-│
                                        │   music, --minimax-music)    │
                                        └──────────────────────────────┘
                                                    |
                                                    v
                                          ┌──────────────────┐
                                          │  metadata.json   │
                                          │  {step1,step2,   │
                                          │   step3[,step4,  │
                                          │   step5,step6,   │
                                          │   step7]}        │
                                          │                  │
                                          │  DONE            │
                                          └──────────────────┘
```

## Document Processing Pipeline

```
src/cli/commands/process-steps/process-ocr.ts

┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 1: Download / Detect Document                      │
│  src/cli/commands/process-steps/step-1-download/document/dl-document.ts      │
│                                                                              │
│  For URL documents:                                                          │
│  └── fetch() → save to temp file → cleanup after processing                  │
│                                                                              │
│  detectDocumentFormat()                                                      │
│  ├── .pdf  → 'pdf'                                                           │
│  ├── .epub → 'epub'                                                          │
│  ├── .png / .jpg / .jpeg / .tif / .tiff → 'image'                           │
│  ├── .docx → 'docx'                                                          │
│  ├── .pptx → 'pptx'                                                          │
│  ├── .xlsx → 'xlsx'                                                          │
│  ├── .odt / .ods / .odp → 'odf'                                             │
│  └── unrecognized → null (error)                                            │
│                                                                              │
│  Read metadata via mutool (PDF):                                             │
│  └── mutool info → pageCount, title, author                                  │
│                                                                              │
│  Create output dir: output/YYYY-MM-DD_HH-MM-SS_<title>/                      │
│                                                                              │
│  Output: DocumentMetadata { title, author, pageCount, format, fileSize }     │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                                    v
┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 2: Extract Text                                    │
│    src/cli/commands/process-steps/step-2-ocr/run-ocr.ts            │
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
│  │  --paddle-ocr →      │  │ --dpi    │  │  pptx → ppt/slides/*    │        │
│  │    PaddleOCR         │  │ --lang   │  │  xlsx → sharedStrings   │        │
│  │  default →           │  │ --psm    │  │  odf  → content.xml     │        │
│  │    MuPDF + Tesseract │  │ --oem    │  └────────────┬────────────┘        │
│  │                      │  │ --rotate │               |                     │
│  │  Stage A: MuPDF      │  └────┬─────┘               |                     │
│  │  mutool draw -F text │       |                     |                     │
│  │  per-page text       │       |                     |                     │
│  └──────────┬───────────┘       |                     |                     │
│             |                   |                     |                     │
│     For each page:              |                     |                     │
│     text found?                 |                     |                     │
│     ┌──┴──┐                     |                     |                     │
│    yes    no                    |                     |                     │
│     |      |                    |                     |                     │
│     |      v                    |                     |                     │
│     |  ┌──────────────┐         |                     |                     │
│     |  │ Stage B: OCR │         |                     |                     │
│     |  │ Tesseract    │         |                     |                     │
│     |  │ 1. Render    │         |                     |                     │
│     |  │    page→PNG  │         |                     |                     │
│     |  │ 2. OCR text  │         |                     |                     │
│     |  └──────┬───────┘         |                     |                     │
│     |         |                 |                     |                     │
│     v         v                 v                     v                     │
│  ┌──────────────────────────────────────────────────────────────┐            │
│  │  ExtractionResult                                            │            │
│  │  ├── text: combined full text                                │            │
│  │  ├── pages[]: { pageNumber, method:'text'|'ocr'|'skipped',   │            │
│  │  │             text, confidence? }                           │            │
│  │  ├── totalPages, ocrPages, textPages                         │            │
│  │  └── extractionMethod: 'mutool+tesseract' | 'ocrmypdf' |     │            │
│  │       'paddle-ocr' | 'mutool+paddle-ocr' | 'docx' | ...      │            │
│  └──────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  Output (always written):                                                    │
│  ├── extraction.txt  → full text                                             │
│  ├── extraction.json → structured per-page results (default --out json)      │
│  ├── extraction.tsv  → (if --out tsv)                                        │
│  └── extraction.hocr → (if --out hocr)                                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                        ┌───────────┴───────────┐
                        |                       |
                    ocr cmd                write cmd
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
                │ +tsv/hocr if  │  │  LLM call → text.md                │
                │  requested    │  │  metadata.json (step1+step2+step3) │
                │               │  │                                    │
                │ DONE          │  │  DONE                              │
                └───────────────┘  └────────────────────────────────────┘
```
