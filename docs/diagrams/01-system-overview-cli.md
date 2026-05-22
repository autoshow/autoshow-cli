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

`extract` displays route-aware public aliases such as `--whisper`, `--openai`, `--grok`, `--aws`, and `--gcloud` based on the routed input. Larger command surfaces (`write`, `resume`, and `config`) use suffixed flags such as `--whisper-stt`, `--openai-ocr`, `--aws-textract`, and `--gcloud-docai` to avoid collisions between STT, OCR, LLM, and post-generation providers.

```
src/cli/flags/

┌─────────────────────────────────────────────────────────────┐
│  transcriptionFlags (part of mediaFlags)                   │
│                                                            │
│  Local:                                                    │
│  ├── --whisper-stt MODEL tiny|base|small|medium|large-v3-turbo│
│  ├── --reverb-stt        Use Reverb ASR                    │
│                                                            │
│  Cloud (LLM provider STT):                                 │
│  ├── --openai-stt / --gemini-stt / --groq-stt             │
│  ├── --grok-stt / --mistral-stt / --glm-stt               │
│  ├── --together-stt / --deepinfra-stt                      │
│                                                            │
│  Cloud (dedicated STT services):                           │
│  ├── --deepgram-stt / --assemblyai-stt / --gladia-stt     │
│  ├── --elevenlabs-stt / --soniox-stt / --speechmatics-stt │
│  ├── --rev-stt / --happyscribe-stt / --supadata-stt       │
│  ├── --scrapecreators-stt                                  │
│  ├── --gcloud-stt / --aws-stt                              │
│                                                            │
│  Controls:                                                 │
│  ├── --all-stt           Enable every STT provider/model   │
│  ├── --speaker-count N   Diarization speaker hint          │
│  └── --split             Split audio into 30-min segments  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  llmProviderFlags (part of mediaFlags)                     │
│  ├── --llama MODEL       llama.cpp model ID                │
│  ├── --openai MODEL      gpt-5.5|gpt-5.4|gpt-5.4-pro|gpt-5.4-mini|gpt-5.4-nano│
│  ├── --groq MODEL        openai/gpt-oss-20b|openai/gpt-oss-120b│
│  ├── --anthropic MODEL   claude-opus-4-7|claude-sonnet-4-6|  │
│  │                       claude-haiku-4-5                    │
│  ├── --gemini MODEL      gemini-3.1-pro-preview|gemini-3.1-flash-lite-preview│
│  ├── --minimax MODEL     MiniMax-M2.7|MiniMax-M2.7-highspeed│
│  ├── --grok MODEL        grok-4.3|grok-4.20-reasoning|grok-4.20-non-reasoning│
│  ├── --glm MODEL         glm-5.1                          │
│  ├── --kimi MODEL        kimi-k2.6                         │
│  └── --all-llm           Enable every LLM provider/model   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  extractFlags                                              │
│                                                            │
│  Output:                                                   │
│  ├── --out FORMAT        text|json|tsv|hocr                │
│  ├── --password VALUE    Encrypted PDF password            │
│                                                            │
│  Local OCR engines on `extract`:                           │
│  ├── --tesseract         Tesseract OCR (default engine)    │
│  ├── --ocrmypdf          OCRmyPDF engine (PDF only)        │
│  ├── --paddle            PaddleOCR engine                  │
│  ├── --lang LANGS        Tesseract language(s) (default: eng)│
│                                                            │
│  Hosted OCR provider aliases on `extract`:                 │
│  ├── --openai / --grok / --anthropic                       │
│  ├── --gemini / --mistral / --glm / --kimi                 │
│  ├── --deepinfra / --unstructured                          │
│  ├── --aws / --gcloud                                      │
│                                                            │
│  URL article backends:                                     │
│  ├── --url-backend NAME  defuddle|firecrawl|glm-reader|spider|zyte │
│  ├── --all-url          run all URL article backends       │
│  ├── --url-provider-concurrency N  hosted URL concurrency  │
│                                                            │
│  Controls:                                                 │
│  ├── --all-ocr           Enable every OCR engine/provider  │
│  └── --primary-ocr NAME  top-level artifact provider       │
│                                                            │
│  advancedExtractFlags                                      │
│  ├── --dpi NUMBER        Render DPI (default: 300)         │
│  ├── --psm NUMBER        Page segmentation mode (default: 3)│
│  ├── --oem NUMBER        OCR engine mode (default: 1)      │
│  ├── --page-separator    Custom page separator             │
│  ├── --preserve-spaces   Preserve interword spacing        │
│  ├── --rotate DEGREES    Rotate before OCR                 │
│  ├── --chapters          Export EPUB/PDF chapter files     │
│  ├── --length N          Split long EPUB/PDF exports       │
│  ├── --pdf-chapter-mode  local|auto|llm                    │
│  ├── --epub-bun          EPUB ZIP/XML inspect mode         │
│  └── --epub-calibre      EPUB inspect compatibility alias  │
└─────────────────────────────────────────────────────────────┘

Command-to-flag mapping:
  metadata    → --save + --password + --url-backend + batchFlags
  download    → downloadFlags + --url-backend
  extract     → mediaFlags + extractFlags + advancedExtractFlags + batchFlags + priceFlag
  resume      → resumeFlags (STT/OCR/TTS/image/video/music provider selection for partial reruns)
  write       → mediaFlags + extractFlags + advancedExtractFlags + batchFlags
                  + ttsFlags + imageGenFlags + musicGenFlags + videoGenFlags + promptFlag
  tts         → ttsFlags
  image       → imageGenFlags
  music       → musicGenFlags
  video       → videoGenFlags
  comic       → comicFlags
  config      → configCommandFlags (persist mapped defaults; ignore runtime-only flags)

Shortcut flags (available on commands that include the relevant provider flags):
  --all-stt, --all-ocr, --all-llm, --all-tts, --all-image, --all-video, --all-music
```
