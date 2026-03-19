# CLI Entry Point & Command Routing

Diagram of Clerc CLI setup, command routing, interceptors, and the flag system.

## Outline

- [Flag System](#flag-system)

```
src/cli/create-cli.ts
         |
         |  Bun.argv
         v
┌──────────────────────────────────────────────────────────────────────────────┐
│  expandBareModelFlags()                                                      │
│  - Fills default model when bare flag used (--openai → --openai gpt-5.2)    │
│  expandPromptArgs()                                                          │
│  - Allows multiple --prompt values (--prompt chapters summary)               │
│  normalizeCommandAliases()                                                   │
│  - Maps aliases: llm → write, transcript → transcribe, dl → download, ...   │
│  normalizeCommandHelpShortcut()                                              │
│  - Maps "write --help" → "help write"                                        │
└──────────────────────────────────────────────────────────────────────────────┘
         |
         v
┌──────────────────────────────────────────────────────────────────────────────┐
│  createCli()  (Clerc)                                                        │
│                                                                              │
│  Global Flags: --help/-h, --version/-v, --config-path, --allow-over-budget  │
│                                                                              │
│  Interceptors:                                                               │
│    PRE  → store startedAtMs = Date.now()                                     │
│    POST → log elapsed time                                                   │
│                                                                              │
│  Error Handler: cliErrorHandler()                                            │
│    - CLIUsageError → exit 2                                                  │
│    - Other errors  → exit 1                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
         |
         v
┌──────────────────────────────────────────────────────────────────────────────┐
│  COMMANDS  (src/cli/create-cli.ts + per-step define-*-command.ts files)      │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │  (root) / write  │  │   transcribe     │  │    extract       │            │
│  │                  │  │                  │  │                  │            │
│  │ Download +       │  │ Download +       │  │ Detect +         │            │
│  │ Transcribe +     │  │ Transcribe only  │  │ Extract only     │            │
│  │ LLM Summary      │  │ (skipLLM=true)   │  │ (documents)      │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │     download     │  │      tts         │  │     image        │            │
│  │                  │  │                  │  │                  │            │
│  │ Download audio   │  │ Generate speech  │  │ Generate image   │            │
│  │ only (no LLM)    │  │ from .md/.txt    │  │ from .md/.txt    │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │     music        │  │     video        │  │     setup        │            │
│  │                  │  │                  │  │                  │            │
│  │ Generate music   │  │ Generate video   │  │ Install all      │            │
│  │ from .md/.txt    │  │ from .md/.txt    │  │ dependencies     │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                                  │
│  │     models       │  │     config       │                                  │
│  │                  │  │                  │                                  │
│  │ Download llama   │  │ Read/write       │                                  │
│  │ model by ID      │  │ autoshow.json    │                                  │
│  └──────────────────┘  └──────────────────┘                                  │
│                                                                              │
│  All process commands → handleProcessTarget(command, target, flags)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Flag System

```
src/cli/flags.ts

┌─────────────────────────────────────────────────────────────┐
│  transcriptionFlags (part of mediaFlags)                     │
│  ├── --whisper MODEL     tiny|base|small|medium|large-v3|...│
│  ├── --reverb            Use Reverb ASR                      │
│  ├── --reverb-verbatimicity  0.0-1.0                        │
│  ├── --elevenlabs-stt MODEL  ElevenLabs Scribe STT           │
│  ├── --groq-stt MODEL    Groq Whisper STT (API)             │
│  ├── --openai-stt MODEL  OpenAI STT (supports diarization)  │
│  ├── --mistral-stt MODEL Mistral STT (supports diarization) │
│  ├── --assemblyai-stt MODEL AssemblyAI STT (diarization)    │
│  ├── --speaker-count N   Diarization speaker hint           │
│  └── --split             Split audio into 10-min segments    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  llmProviderFlags (part of mediaFlags)                       │
│  ├── --llama MODEL       llama.cpp model ID                  │
│  ├── --openai MODEL      gpt-5.2|gpt-5.2-pro|gpt-5.1       │
│  ├── --groq MODEL        openai/gpt-oss-20b|openai/gpt-oss-120b│
│  ├── --anthropic MODEL   claude-opus-4-6|claude-sonnet-4-6  │
│  ├── --gemini MODEL      gemini-3-flash-preview|gemini-3-pro-preview│
│  └── --minimax MODEL     MiniMax-M2.5|MiniMax-M2.5-highspeed│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  extractFlags                                                │
│  ├── --lang LANGS        Tesseract language(s) (default: eng)│
│  ├── --out FORMAT        text|json|tsv|hocr                  │
│  ├── --password VALUE    Encrypted PDF password              │
│  ├── --ocrmypdf          Use OCRmyPDF engine (PDF only)      │
│  ├── --paddle-ocr        Use PaddleOCR engine                │
│  └── --mistral-ocr MODEL Mistral OCR (API)                   │
│                                                              │
│  advancedExtractFlags                                        │
│  ├── --dpi NUMBER        Render DPI (default: 300)           │
│  ├── --psm NUMBER        Page segmentation mode (default: 3) │
│  ├── --oem NUMBER        OCR engine mode (default: 1)        │
│  ├── --page-separator    Custom page separator               │
│  ├── --preserve-spaces   Preserve interword spacing          │
│  └── --rotate DEGREES    Rotate before OCR                   │
└─────────────────────────────────────────────────────────────┘

Command-to-flag mapping:
  transcribe  → transcriptionFlags + promptFlag + batchFlags + priceFlag
  write       → mediaFlags + extractFlags + advancedExtractFlags + batchFlags
                  + ttsFlags + imageGenFlags + musicGenFlags + videoGenFlags + promptFlag
  extract     → extractFlags
  tts         → ttsFlags
  image       → imageGenFlags
  music       → musicGenFlags
  video       → videoGenFlags
  config      → all flags (for persisting defaults)
```
