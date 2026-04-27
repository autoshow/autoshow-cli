# Processing Pipelines

Step-by-step diagrams for both media and document inputs, from initial intake through optional downstream generation.

The `metadata` command (default) runs only the metadata extraction portion of Step 1 without downloading. The `download` command runs the full Step 1. The `extract` command runs Steps 1-2 and routes media to STT, documents/articles/images to OCR, or X/Twitter Space links to the X API for metadata extraction. The `write` command runs the full pipeline.

## Outline

- [Media Processing Pipeline](#media-processing-pipeline)
- [Document Processing Pipeline](#document-processing-pipeline)
- [Music Lyric-Video Pipeline](#music-lyric-video-pipeline)

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
│  ├── url_streaming → yt-dlp --format bestaudio/best                          │
│  ├── url_direct_media → fetch() → save to disk                               │
│  └── local file → use as-is                                                  │
│                                                                              │
│  Normalize once to compressed audio-only media:                              │
│  ├── keep mp3 / m4a / ogg / flac when already audio-only                     │
│  ├── extract AAC/ALAC/MP3/Opus/Vorbis streams without re-encoding            │
│  └── fall back to FLAC for PCM or unsupported codecs                         │
│                                                                              │
│  Output: audio.(mp3|m4a|ogg|flac) + Step1Metadata                            │
└──────────────────────────────────────────────────────────────────────────────┘
                                    |
                                    v
┌──────────────────────────────────────────────────────────────────────────────┐
│                      STEP 2: STT                                             │
│       src/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt.ts   │
│                                                                              │
│  Hosted STT first stages one shared source_media.(m4a|mp3):                  │
│  ├── keep only the primary audio stream                                     │
│  ├── strip cover art, chapters, metadata, and extra streams                │
│  └── default to mono AAC-LC .m4a at a 96 kbps ceiling                      │
│                                                                              │
│  resolveSttEngine() - picks exactly one engine:                              │
│                                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐│
│  │ --reverb   │ │--elevenlabs│ │--groq-stt  │ │--deepgram- │ │--mistral-  │ │--assemblyai- ││
│  │ Reverb ASR │ │-stt        │ │ Groq       │ │stt         │ │stt         │ │stt           ││
│  │ (local)    │ │ ElevenLabs │ │ Whisper    │ │ Deepgram   │ │ Mistral    │ │ AssemblyAI   ││
│  │ diarization│ │ Scribe(API)│ │ (API)      │ │ STT (API)  │ │ STT (API)  │ │ STT (API)    ││
│  │ --reverb-  │ │ w/speaker- │ │            │ │ diarization│ │ diarization│ │ diarization  ││
│  │ verbatimic.│ │ count hint │ │            │ │ enabled    │ │            │ │ w/speaker-   ││
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
                │ run.json      │  │  buildPrompt()                     │
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
                                   │  Output: text.json + Step3Metadata │
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
                                        │   video, --minimax-video,    │
                                        │   --glm-video, --grok-video, │
                                        │   --runway-video...)         │
                                        │  Step 7: Music (--elevenlabs-│
                                        │   music, --minimax-music)    │
                                        └──────────────────────────────┘
                                                    |
                                                    v
                                          ┌──────────────────┐
                                          │  run.json        │
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
src/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr.ts

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
│    src/cli/commands/process-steps/step-2-extract/step-2-ocr/run-ocr.ts      │
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
│  │  default →           │  │ --psm   │  │                         │        │
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
│  │       'paddle-ocr' | 'mutool+paddle-ocr' | 'docx' | ...        │            │
│  └──────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  Output (based on --out):                                                    │
│  ├── extraction.txt  → full text (default --out text)                        │
│  ├── result.json     → structured per-page results (if --out json)           │
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
                │ result.json   │  │  ├── Extracted text                │
                │ run.json      │  │  └── Document metadata             │
                │ (step1+step2) │  │  Output: prompt.md                 │
                │               │  │                                    │
                │ +tsv/hocr if  │  │  LLM call → text.json              │
                │  requested    │  │  run.json (step1+step2+step3)      │
                │               │  │                                    │
                │ DONE          │  │  DONE                              │
                └───────────────┘  └────────────────────────────────────┘
```

## Music Lyric-Video Pipeline

```
src/cli/commands/process-steps/step-7-music/lyrics-video/

┌──────────────────────────────────────────────────────────────────────────────┐
│                      MUSIC LYRIC-VIDEO MODE                                  │
│                                                                              │
│  Input validation                                                            │
│  ├── single run: --audio must be inside ./input                              │
│  ├── rerender: --captions must be inside ./output                            │
│  └── batch: recursively scan ./input for .wav/.mp3/.m4a/.flac/.ogg/.aac     │
│                                                                              │
│  Caption source                                                              │
│  ├── --captions → parse VTT/SRT directly                                     │
│  └── no --captions → ensure whisper:<model> → runWhisperTranscribe()         │
│                     → build short lyric cues from word timings               │
│                                                                              │
│  Render prep                                                                 │
│  ├── write <stem>.vtt                                                        │
│  ├── write <stem>.srt                                                        │
│  ├── build ASS subtitle file                                                 │
│  └── detect background image beside the audio                                │
│                                                                              │
│  Render                                                                      │
│  ├── image match → dimmed cover-art background                               │
│  ├── no image  → spectrogram background                                      │
│  ├── ffmpeg ass filter when available                                        │
│  └── fallback image-overlay cards when ass is unavailable                    │
│                                                                              │
│  Output                                                                      │
│  ├── output/<timestamp>_music-lyrics-<stem>/<stem>.mp4                       │
│  ├── output/<timestamp>_music-lyrics-<stem>/<stem>.vtt                       │
│  ├── output/<timestamp>_music-lyrics-<stem>/<stem>.srt                       │
│  └── run.json / batch.json with kind "music" and mode "lyric-video"         │
└──────────────────────────────────────────────────────────────────────────────┘
```
