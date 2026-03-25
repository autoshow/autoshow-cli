# System Overview & CLI Surface

Architecture overview showing the high-level layers plus the CLI entry point, command routing, and flag system.

## Outline

- [System Layers](#system-layers)
- [CLI Entry Point & Command Routing](#cli-entry-point--command-routing)
- [Flag System](#flag-system)

## System Layers

```
bun as <command> <input> [flags]
            |
            v
    ┌───────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │   CLI Layer   │────>│ Target Layer │────>│  Processing  │────>│    Output     │
    │  (Clerc CLI)  │     │ (Routing)    │     │  Pipeline    │     │  (Files)      │
    └───────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **CLI Layer** (`src/cli/create-cli.ts`, `src/cli/flags/`)
   - Parses `Bun.argv` via the Clerc framework
   - Defines 12 named commands plus the root shorthand (`bun as <input>` => `write <input>`): `download`, `stt`, `write`, `ocr`, `tts`, `image`, `music`, `video`, `setup`, `sample`, `models`, `config`
   - Validates flag combinations and argument ordering

2. **Target Layer** (`src/cli/commands/process-steps/step-1-download/targets/`)
   - Classifies input as directory, URL list, YouTube collection, or single item
   - Routes to batch or single-item processing
   - Detects input kind: streaming URL, direct media URL, direct document URL, local media, local document

3. **Processing Pipeline** (`src/cli/commands/process-steps/`)
   - Step 1: Download/detect (audio via yt-dlp/ffmpeg, documents via mutool)
   - Step 2: Transcribe (Whisper/Groq/Reverb/ElevenLabs/OpenAI/Mistral/AssemblyAI STT) or Extract (MuPDF + Tesseract/OCRmyPDF/PaddleOCR/Mistral OCR)
   - Step 3: LLM summary (llama.cpp, OpenAI, Groq, Anthropic, Gemini, MiniMax)
   - Step 4: TTS synthesis - optional (Kitten, ElevenLabs, MiniMax, Groq, OpenAI, Gemini)
   - Step 5: Image generation - optional (Gemini, OpenAI DALL-E, MiniMax)
   - Step 6: Video generation - optional (Sora, Gemini Veo, MiniMax)
   - Step 7: Music generation - optional (ElevenLabs, MiniMax)

4. **Output** (`output/`)
   - Timestamped directories with audio, transcripts, extractions, prompts, summaries, metadata, and generated media files

## CLI Entry Point & Command Routing

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
│  - Maps aliases: transcribe → stt, extract → ocr, voice → tts, dl → download, ... │
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
│  │  (root) / write  │  │   stt            │  │    ocr           │            │
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
src/cli/flags/

┌─────────────────────────────────────────────────────────────┐
│  transcriptionFlags (part of mediaFlags)                   │
│  ├── --whisper MODEL     tiny|base|small|medium|large-v3|...│
│  ├── --reverb            Use Reverb ASR                    │
│  ├── --reverb-verbatimicity  0.0-1.0                       │
│  ├── --elevenlabs-stt MODEL  ElevenLabs Scribe STT         │
│  ├── --groq-stt MODEL    Groq Whisper STT (API)            │
│  ├── --openai-stt MODEL  OpenAI STT (supports diarization) │
│  ├── --mistral-stt MODEL Mistral STT (supports diarization)│
│  ├── --assemblyai-stt MODEL AssemblyAI STT (diarization)   │
│  ├── --speaker-count N   Diarization speaker hint          │
│  └── --split             Split audio into 10-min segments  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  llmProviderFlags (part of mediaFlags)                     │
│  ├── --llama MODEL       llama.cpp model ID                │
│  ├── --openai MODEL      gpt-5.2|gpt-5.2-pro|gpt-5.1       │
│  ├── --groq MODEL        openai/gpt-oss-20b|openai/gpt-oss-120b│
│  ├── --anthropic MODEL   claude-opus-4-6|claude-sonnet-4-6 │
│  ├── --gemini MODEL      gemini-3-flash-preview|gemini-3-pro-preview│
│  └── --minimax MODEL     MiniMax-M2.5|MiniMax-M2.5-highspeed│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  extractFlags                                              │
│  ├── --lang LANGS        Tesseract language(s) (default: eng)│
│  ├── --out FORMAT        text|json|tsv|hocr                │
│  ├── --password VALUE    Encrypted PDF password            │
│  ├── --ocrmypdf          Use OCRmyPDF engine (PDF only)    │
│  ├── --paddle-ocr        Use PaddleOCR engine              │
│  └── --mistral-ocr MODEL Mistral OCR (API)                 │
│                                                            │
│  advancedExtractFlags                                      │
│  ├── --dpi NUMBER        Render DPI (default: 300)         │
│  ├── --psm NUMBER        Page segmentation mode (default: 3)│
│  ├── --oem NUMBER        OCR engine mode (default: 1)      │
│  ├── --page-separator    Custom page separator             │
│  ├── --preserve-spaces   Preserve interword spacing        │
│  └── --rotate DEGREES    Rotate before OCR                 │
└─────────────────────────────────────────────────────────────┘

Command-to-flag mapping:
  stt         → transcriptionFlags + promptFlag + batchFlags + priceFlag
  write       → mediaFlags + extractFlags + advancedExtractFlags + batchFlags
                  + ttsFlags + imageGenFlags + musicGenFlags + videoGenFlags + promptFlag
  ocr         → extractFlags
  tts         → ttsFlags
  image       → imageGenFlags
  music       → musicGenFlags
  video       → videoGenFlags
  config      → all flags (for persisting defaults)
```
