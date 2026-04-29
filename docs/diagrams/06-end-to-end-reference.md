# End-to-End Execution Reference

Complete trace of a real CLI command from input to output, plus environment variable reference.

## Outline

- [Example: `bun as write "https://youtube.com/watch?v=abc123" --whisper small --llama`](#example-bun-as-write-httpsyoutubecomwatchvabc123---whisper-small---llama)
- [Environment Variables](#environment-variables)

## Example: `bun as write "https://youtube.com/watch?v=abc123" --whisper small --llama`

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│   USER: bun as write "https://youtube.com/watch?v=abc123" --whisper small --llama   │
│                                                                                     │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                            |
    ┌───────────────────────────────────────┘
    |
    v
  create-cli.ts
    |  normalizeAndGuardArgv()
    |  parse → writeCommand
    v
  commands.ts
    |  handleProcessTarget('write', target, flags)
    |  buildOptsFromFlags(skipLLM=false, flags)
    |  classifyTopLevelTarget(target) → { kind: 'single' }
    |  tryHandleYoutubeCollectionTarget() → false (single video)
    v
  single-target.ts
    |  isLikelyUrl() → true
    |  classifyUrlInput() → 'url_streaming'
    |  command='write' → processMediaSingle()
    v
  single-target.ts → processMediaSingle()
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
│  API Keys                                                                    │
│  ├── OPENAI_API_KEY                  Required for --openai, --openai-tts,    │
│  │                                   --openai-image models                   │
│  ├── GROQ_API_KEY                    Required for --groq, --groq-stt,        │
│  │                                   --groq-tts models                       │
│  ├── ANTHROPIC_API_KEY               Required for --anthropic,               │
│  │                                   --anthropic-ocr models                  │
│  ├── GEMINI_API_KEY                  Required for --gemini, --gemini-ocr,    │
│  │                                   --gemini-tts, --gemini-image,           │
│  │                                   --gemini-video, --gemini-music models  │
│  ├── DEEPINFRA_API_KEY               Required for --deepinfra-stt and        │
│  │                                   --deepinfra-ocr models                  │
│  ├── MINIMAX_API_KEY                 Required for --minimax, --minimax-tts,  │
│  │                                   --minimax-image, --minimax-video,       │
│  │                                   --minimax-music models                  │
│  ├── ELEVENLABS_API_KEY              Required for --elevenlabs-stt,          │
│  │                                   --elevenlabs-tts, --elevenlabs-music    │
│  ├── GLM_API_KEY                     Required for --glm, --glm-ocr,          │
│  │                                   --glm-stt, --glm-image, --glm-video     │
│  │                                   models                                  │
│  ├── KIMI_API_KEY                    Required for --kimi and --kimi-ocr      │
│  │                                   models                                  │
│  ├── XAI_API_KEY                     Required for --grok, --grok-image,      │
│  │                                   --grok-video models                     │
│  ├── RUNWAYML_API_SECRET             Required for --runway-tts,              │
│  │                                   --runway-image, --runway-video models   │
│  ├── BFL_API_KEY                     Required for --bfl-image models         │
│  └── HF_TOKEN                        HuggingFace private model access         │
│                                                                              │
│  llama.cpp Overrides                                                         │
│  ├── LLAMA_MODEL_PATH                Skip auto-download, use local path      │
│  ├── LLAMA_MODEL_REPO                Override HuggingFace repo               │
│  └── LLAMA_SERVER_START_TIMEOUT_MS   Server startup timeout (default: 30m)   │
│                                                                              │
│  yt-dlp Configuration                                                        │
│  ├── YTDLP_ACCEPT_LANGUAGE           Custom Accept-Language header           │
│  ├── YTDLP_USER_AGENT                Custom user agent string                │
│  ├── YTDLP_COOKIES_FROM_BROWSER      Import browser cookies for yt-dlp       │
│  ├── YTDLP_COOKIES                   Path to exported yt-dlp cookies.txt     │
│  ├── YTDLP_EXTRACTOR_ARGS            Raw yt-dlp extractor args override      │
│  └── YTDLP_NO_CHECK_CERTS            Disable TLS certificate verification    │
└──────────────────────────────────────────────────────────────────────────────┘
```
