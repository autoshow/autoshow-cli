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
    │ (native CLI)  │     │ (Routing)    │     │  Pipeline    │     │  (Files)      │
    └───────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **CLI Layer** (`src/cli/create-cli.ts`, `src/cli/flags/`)
   - Parses `Bun.argv` with the native dispatcher/parser and help renderer
   - Defines named commands: `metadata`, `download`, `extract`, `resume`, `write`, `tts`, `image`, `video`, `music`, `comic`, `config`, `cache`, `setup`, `sock`, `links`, `benchmark`
   - Validates flag combinations and argument ordering

2. **Target Layer** (`src/cli/commands/process-steps/step-1-download/targets/`)
   - Classifies input as directory, URL list, YouTube collection, or single item
   - Routes to batch or single-item processing
   - Detects input kind: streaming URL, direct media URL, direct document URL, local media, local document

3. **Processing Pipeline** (`src/cli/commands/process-steps/`)
   - Step 1: Download/detect (audio via yt-dlp/ffmpeg, documents via mutool)
   - Step 2: STT, OCR, URL article extraction, or X/Twitter Space metadata
   - Step 3: LLM summary (llama.cpp, OpenAI, Groq, Anthropic, Gemini, MiniMax, Grok, GLM, Kimi)
   - Steps 4-7: Optional TTS, image, video, and music generation

4. **Output** (`output/`)
   - Timestamped directories with audio, transcripts, extractions, prompts, summaries, metadata, and generated media files

## CLI Entry Point & Command Routing

```
src/cli/create-cli.ts
         |
         |  Bun.argv
         v
┌──────────────────────────────────────────────────────────────────────────────┐
│  createCli()  (native dispatcher)                                            │
│  - Registers global flags, native help/version, and command definitions       │
│  - PRE interceptor rejects unknown flags, except manual `links` selectors    │
│  - PRE interceptor configures logging and records startedAtMs                │
└──────────────────────────────────────────────────────────────────────────────┘
         |
         v
┌──────────────────────────────────────────────────────────────────────────────┐
│  command handlers                                                            │
│                                                                              │
│  Global Flags: --help/-h, --version/-v, --config-path, --allow-over-budget  │
│                --verbose, --quiet/-q, --json                                │
│                                                                              │
│  Dispatch: command-first invocations call each define-*-command handler      │
│            and process commands enter handleProcessTarget()                  │
│                                                                              │
│  Interceptors:                                                               │
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
│  │    metadata      │  │      write       │  │   extract        │            │
│  │                  │  │                  │  │                  │            │
│  │ Metadata only    │  │ Download +       │  │ Media STT or     │            │
│  │ (no download)    │  │ Transcribe +     │  │ document OCR     │            │
│  │                  │  │ LLM Summary      │  │ route            │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │     download     │  │      tts         │  │     image        │            │
│  │                  │  │                  │  │                  │            │
│  │ Download inputs  │  │ Generate speech  │  │ Generate image   │            │
│  │ only (no LLM)    │  │ from .md/.txt    │  │ from prompt text │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │     music        │  │     video        │  │     setup        │            │
│  │                  │  │                  │  │                  │            │
│  │ Generate music   │  │ Generate video   │  │ Install all      │            │
│  │ or lyric videos  │  │ from prompt text │  │ dependencies     │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │     resume       │  │     comic        │  │    benchmark     │            │
│  │                  │  │                  │  │                  │            │
│  │ Resume partial   │  │ Generate comic   │  │ Run provider     │            │
│  │ pipeline runs    │  │ from prompt text │  │ benchmarks       │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │     config       │  │      cache       │  │      links       │            │
│  │                  │  │                  │  │                  │            │
│  │ Read/write       │  │ Prune or clear   │  │ Fetch provider   │            │
│  │ autoshow.json    │  │ STT media cache  │  │ reference docs   │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                              │
│  ┌──────────────────┐                                                        │
│  │      sock        │                                                        │
│  │                  │                                                        │
│  │ Read-only Socket │                                                        │
│  │ dependency report│                                                        │
│  └──────────────────┘                                                        │
│                                                                              │
│  Most process commands → handleProcessTarget(command, target, flags)         │
│  `music --audio` / `music --batch` route to the local lyric-video runner     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Flag System

Runtime provider selection uses generic selectors. Standalone `extract`, `tts`, `image`, `video`, `music`, and target-aware `resume` use `--provider provider[=model]` plus `--all-providers`. Pipeline and config surfaces use step selectors such as `--stt provider[=model]`, `--ocr provider[=model]`, `--llm provider[=model]`, `--tts provider[=model]`, `--image provider[=model]`, `--video provider[=model]`, `--music provider[=model]`, and `--all-providers <step>`.

```
src/cli/flags/

┌─────────────────────────────────────────────────────────────┐
│  step-2 STT selection                                      │
│                                                            │
│  extract/resume:                                           │
│  ├── --provider whisper=MODEL                              │
│  ├── --provider reverb                                     │
│  └── --all-providers                                       │
│                                                            │
│  write/config:                                             │
│  ├── --stt whisper=MODEL                                   │
│  ├── --stt deepgram=nova-3                                 │
│  └── --all-providers stt                                   │
│                                                            │
│  Controls:                                                 │
│  ├── --speaker-count N   Diarization speaker hint          │
│  └── --split             Split audio into 30-min segments  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  step-3 LLM selection                                      │
│  ├── --llm llama=MODEL                                     │
│  ├── --llm openai=gpt-5.5                                  │
│  ├── --llm groq=openai/gpt-oss-20b                         │
│  ├── --llm anthropic=claude-sonnet-4-6                     │
│  ├── --llm gemini=gemini-3.1-flash-lite-preview            │
│  ├── --llm minimax=MiniMax-M2.7                            │
│  ├── --llm grok=grok-4.3                                   │
│  ├── --llm glm=glm-5.1                                     │
│  ├── --llm kimi=kimi-k2.6                                  │
│  └── --all-providers llm                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  extractFlags                                              │
│                                                            │
│  Output:                                                   │
│  ├── --format FORMAT     text|json|tsv|hocr                │
│  ├── --password VALUE    Encrypted PDF password            │
│                                                            │
│  OCR selectors:                                            │
│  ├── extract/resume: --provider provider[=model]           │
│  ├── write/config:    --ocr provider[=model]               │
│  └── all providers:   --all-providers / --all-providers ocr│
│                                                            │
│  Provider names:                                           │
│  ├── tesseract, ocrmypdf, paddle-ocr, mistral, glm, kimi   │
│  └── openai, grok, anthropic, gemini, deepinfra, unstructured│
│                                                            │
│  URL article backends:                                     │
│  ├── --url-provider NAME defuddle|firecrawl|glm-reader|spider|supadata|zyte │
│  └── --all-providers     route-aware all URL backends      │
│                                                            │
│  advancedExtractFlags                                      │
│  ├── --ocr-dpi NUMBER    Render DPI (default: 300)         │
│  ├── --chapters          Export EPUB/PDF chapter files     │
│  ├── --length N          Split long EPUB/PDF exports       │
│  ├── --pdf-chapter-mode  local|auto|llm                    │
│  └── --epub-bun          EPUB ZIP/XML inspect mode         │
└─────────────────────────────────────────────────────────────┘

Command-to-flag mapping:
  metadata    → --save + --password + --url-provider + batchFlags
  download    → downloadFlags + --url-provider
  extract     → mediaFlags + extractFlags + advancedExtractFlags + batchFlags + priceFlag
  resume      → resumeFlags (target-aware --provider and --all-providers for partial reruns)
  write       → mediaFlags + extractFlags + advancedExtractFlags + batchFlags
                  + ttsFlags + imageGenFlags + musicGenFlags + videoGenFlags + promptFlag
  tts         → ttsFlags
  image       → imageGenFlags
  music       → musicGenFlags
  video       → videoGenFlags
  comic       → comicFlags
  config      → configCommandFlags (persist mapped defaults; ignore runtime-only flags)

All-provider flags:
  standalone/resume: --all-providers
  write/config:      --all-providers stt|ocr|url|llm|tts|image|video|music
```
