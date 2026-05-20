# End-to-End Execution Reference

Complete trace of a real CLI command from input to output, plus environment variable reference.

## Outline

- [Example: `bun as write "https://youtube.com/watch?v=abc123" --whisper-stt small --llama`](#example-bun-as-write-httpsyoutubecomwatchvabc123---whisper-stt-small---llama)
- [Environment Variables](#environment-variables)

## Example: `bun as write "https://youtube.com/watch?v=abc123" --whisper-stt small --llama`

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│   USER: bun as write "https://youtube.com/watch?v=abc123" --whisper-stt small --llama   │
│                                                                                     │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                            |
    ┌───────────────────────────────────────┘
    |
    v
  create-cli.ts
    |  parse → writeCommand
    v
  define-write-command.ts
    |  handleProcessTarget('write', target, flags)
    v
  targets/handle-process-target.ts
    |  buildOptsFromFlags(skipLLM=false, flags)
    |  classifyTopLevelTarget(target) → { kind: 'single' }
    |  resolveYoutubeCollectionItems(target, 'write') → null (single video)
    v
  targets/single-target.ts
    |  isLikelyUrl() → true
    |  classifyUrlInput() → 'url_streaming'
    |  command='write' → processMediaSingle()
    v
  targets/single-target.ts → processMediaSingle()
    |  extractSourceMetadata({ url }) → VideoMetadata
    |  validateData(ProcessingOptionsSchema, ...)
    v
  process-video.ts → processVideo()
    |
    |  STEP 1: Download
    |  ├── downloadAudio() → yt-dlp/fetch + shared audio normalization
    |  └── Step1Metadata
    |
    |  STEP 2: STT
    |  ├── stt(audioPath, options)
    |  │   └── Whisper.cpp (small model) → transcription.txt
    |  └── { result: TranscriptionResult, metadata: Step2Metadata }
    |
    |  STEP 3: LLM Summary
    |  ├── buildPrompt(metadata, transcription) → prompt.md
    |  ├── runLLM() → llama.cpp (default model) → text.json
    |  └── Step3Metadata
    |
    |  Write run.json { step1, step2, step3 }
    v
  output/2026-02-18_12-00-00_video-title/
    ├── audio.(mp3|m4a|ogg|flac)
    ├── transcription.txt
    ├── prompt.md
    ├── text.json
    └── run.json
```

## Environment Variables

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Step 2 — STT API Keys                                                       │
│  ├── DEEPGRAM_API_KEY                Deepgram STT (also TTS)                 │
│  ├── SONIOX_API_KEY                  Soniox STT                              │
│  ├── SPEECHMATICS_API_KEY            Speechmatics STT                        │
│  ├── ASSEMBLYAI_API_KEY              AssemblyAI STT                          │
│  ├── GLADIA_API_KEY                  Gladia STT                              │
│  ├── TOGETHER_API_KEY                Together STT                            │
│  └── DEEPINFRA_API_KEY               DeepInfra STT (also OCR)               │
│                                                                              │
│  Step 2 — OCR & URL Backend API Keys                                         │
│  ├── UNSTRUCTURED_API_KEY            Unstructured OCR                        │
│  ├── FIRECRAWL_API_KEY               Firecrawl URL backend                   │
│  └── KIMI_API_KEY                    Kimi OCR (also LLM)                     │
│                                                                              │
│  Step 3 — LLM API Keys                                                       │
│  ├── OPENAI_API_KEY                  OpenAI LLM/STT/OCR/TTS/Image            │
│  ├── ANTHROPIC_API_KEY               Anthropic LLM/OCR                       │
│  ├── GEMINI_API_KEY                  Gemini LLM/STT/OCR/TTS/Image/Video/Music│
│  ├── GROQ_API_KEY                    Groq LLM/STT/TTS                        │
│  └── MINIMAX_API_KEY                 MiniMax LLM/TTS/Image/Video/Music       │
│                                                                              │
│  Multi-step Provider API Keys                                                │
│  ├── MISTRAL_API_KEY                 Mistral STT/OCR/TTS                     │
│  ├── GLM_API_KEY                     GLM STT/OCR/LLM/Video                   │
│  ├── XAI_API_KEY                     Grok STT/LLM/TTS/Image/Video            │
│  ├── ELEVENLABS_API_KEY              ElevenLabs STT/TTS/Music                │
│  └── DEAPI_API_KEY                   deAPI STT/TTS/Image/Video/Music         │
│                                                                              │
│  Step 4-7 — Generation-Only API Keys                                         │
│  ├── SPEECHIFY_API_KEY               Speechify TTS                           │
│  ├── HUME_API_KEY                    Hume TTS                                │
│  ├── CARTESIA_API_KEY                Cartesia TTS                            │
│  ├── RUNWAYML_API_SECRET             Runway Image/Video                      │
│  ├── BFL_API_KEY                     BFL Image                               │
│  └── REVE_API_KEY                    Reve Image                              │
│                                                                              │
│  Other                                                                       │
│  └── HF_TOKEN                        HuggingFace private model access        │
│                                                                              │
│  Base URL Overrides — Step 2 (STT/OCR)                                       │
│  ├── DEEPGRAM_BASE_URL, SONIOX_BASE_URL, SPEECHMATICS_BASE_URL               │
│  ├── ASSEMBLYAI_BASE_URL, GLADIA_BASE_URL, TOGETHER_BASE_URL                 │
│  ├── DEEPINFRA_BASE_URL, UNSTRUCTURED_API_URL, FIRECRAWL_API_URL             │
│                                                                              │
│  Base URL Overrides — Step 3 (LLM)                                           │
│  ├── OPENAI_BASE_URL, GROQ_BASE_URL, MISTRAL_BASE_URL                        │
│  ├── XAI_BASE_URL, ZAI_BASE_URL (GLM), MINIMAX_BASE_URL                     │
│                                                                              │
│  Base URL Overrides — Steps 4-7 (TTS/Image/Video/Music)                      │
│  ├── ELEVENLABS_BASE_URL, DEAPI_BASE_URL                                     │
│  ├── SPEECHIFY_BASE_URL, HUME_BASE_URL, CARTESIA_BASE_URL                    │
│  └── RUNWAY_BASE_URL, BFL_BASE_URL, REVE_BASE_URL                            │
│                                                                              │
│  Logging                                                                     │
│  ├── AUTOSHOW_LOG_FORMAT             human|json|both|auto (default: auto)    │
│  └── AUTOSHOW_LOG_LEVEL              debug|info|success|warn|error           │
│                                                                              │
│  Timeout Overrides (milliseconds)                                            │
│  ├── AUTOSHOW_MEDIA_GENERATION_TIMEOUT_MS  Media generation timeout          │
│  ├── AUTOSHOW_LLM_REQUEST_TIMEOUT_MS       LLM request timeout              │
│  ├── AUTOSHOW_OCR_REQUEST_TIMEOUT_MS       OCR request timeout               │
│  └── AUTOSHOW_UNSTRUCTURED_OCR_*           Poll/stall/deadline timeouts      │
│                                                                              │
│  llama.cpp Overrides                                                         │
│  ├── LLAMA_MODEL_PATH                Skip auto-download, use local path      │
│  ├── LLAMA_MODEL_REPO                Override HuggingFace repo               │
│  └── LLAMA_SERVER_START_TIMEOUT_MS   Server startup timeout (default: 30m)   │
│                                                                              │
│  yt-dlp Configuration                                                        │
│  ├── YTDLP_COOKIES_FROM_BROWSER      Import browser cookies for yt-dlp       │
│  ├── YTDLP_COOKIES                   Path to exported yt-dlp cookies.txt     │
│  └── YTDLP_EXTRACTOR_ARGS            Raw yt-dlp extractor args override      │
└──────────────────────────────────────────────────────────────────────────────┘
```
