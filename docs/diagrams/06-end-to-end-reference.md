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

### Provider API Keys

| Area | Variables |
|------|-----------|
| Step 2 STT | `GROQ_API_KEY`, `XAI_API_KEY`, `DEEPINFRA_API_KEY`, `TOGETHER_API_KEY`, `HAPPYSCRIBE_API_KEY`, `SUPADATA_API_KEY`, `SCRAPECREATORS_API_KEY`, `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY`, `SONIOX_API_KEY`, `SPEECHMATICS_API_KEY`, `REVAI_ACCESS_TOKEN`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GLM_API_KEY`, `MISTRAL_API_KEY`, `ASSEMBLYAI_API_KEY`, `GLADIA_API_KEY` |
| Step 2 OCR | `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GLM_API_KEY`, `KIMI_API_KEY`, `DEEPINFRA_API_KEY`, `UNSTRUCTURED_API_KEY` |
| Step 2 URL and X | `FIRECRAWL_API_KEY`, `GLM_API_KEY`, `SPIDER_API_KEY`, `ZYTE_API_KEY`, `X_BEARER_TOKEN` |
| Step 3 LLM | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `MINIMAX_API_KEY`, `XAI_API_KEY`, `GLM_API_KEY`, `KIMI_API_KEY` |
| Step 4 TTS | `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY`, `GROQ_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `SPEECHIFY_API_KEY`, `HUME_API_KEY`, `CARTESIA_API_KEY` |
| Step 5 image | `GEMINI_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `BFL_API_KEY`, `REVE_API_KEY` |
| Step 6 video | `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `GLM_API_KEY`, `XAI_API_KEY`, `RUNWAYML_API_SECRET` |
| Step 7 music | `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY`, `GEMINI_API_KEY` |

AWS Transcribe and Textract use AWS CLI credentials plus `AWS_REGION` or `AWS_DEFAULT_REGION`. Google Cloud STT, Document AI, and TTS use gcloud CLI auth plus an active billed project.

### Base URL Overrides

| Area | Variables |
|------|-----------|
| OpenAI-compatible and LLM APIs | `OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, `GROQ_BASE_URL`, `MISTRAL_BASE_URL`, `XAI_BASE_URL`, `GLM_BASE_URL`, `ZAI_BASE_URL`, `KIMI_BASE_URL`, `MINIMAX_BASE_URL` |
| STT providers | `DEEPINFRA_BASE_URL`, `TOGETHER_BASE_URL`, `HAPPYSCRIBE_BASE_URL`, `SUPADATA_BASE_URL`, `SCRAPECREATORS_BASE_URL`, `ELEVENLABS_BASE_URL`, `DEEPGRAM_BASE_URL`, `SONIOX_BASE_URL`, `SPEECHMATICS_BASE_URL`, `REVAI_BASE_URL`, `ASSEMBLYAI_BASE_URL`, `GLADIA_BASE_URL` |
| OCR and URL providers | `UNSTRUCTURED_API_URL`, `FIRECRAWL_API_URL`, `SPIDER_API_URL`, `ZYTE_API_URL` |
| TTS, image, and music providers | `GCLOUD_TTS_BASE_URL`, `SPEECHIFY_BASE_URL`, `HUME_BASE_URL`, `CARTESIA_BASE_URL`, `BFL_BASE_URL`, `REVE_BASE_URL`, `ELEVENLABS_BASE_URL`, `MINIMAX_BASE_URL` |

Runway video generation currently uses the fixed Runway API base URL and `RUNWAYML_API_SECRET`.

### Provider Defaults

| Area | Variables |
|------|-----------|
| Local and model downloads | `HUGGINGFACE_TOKEN`, `LLAMA_MODEL_PATH`, `LLAMA_MODEL_REPO` |
| AWS and Google Cloud helpers | `AUTOSHOW_AWS_BIN`, `AUTOSHOW_GCLOUD_BIN`, `AUTOSHOW_GCLOUD_PROJECT`, `AUTOSHOW_GCLOUD_DOCAI_LOCATION`, `AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID`, `AUTOSHOW_GCLOUD_BUCKET` |
| TTS voices and output controls | `ELEVENLABS_VOICE_ID`, `OPENAI_TTS_VOICE`, `GEMINI_TTS_VOICE`, `GROQ_TTS_VOICE`, `XAI_TTS_VOICE`, `MISTRAL_TTS_VOICE`, `MISTRAL_TTS_REF_AUDIO`, `DEEPGRAM_TTS_VOICE`, `SPEECHIFY_TTS_VOICE`, `HUME_TTS_VOICE`, `HUME_TTS_VOICE_PROVIDER`, `CARTESIA_TTS_VOICE`, `CARTESIA_VERSION`, `GCLOUD_TTS_LANGUAGE`, `GCLOUD_TTS_VOICE` |
| URL backend defaults | `AUTOSHOW_URL_BACKEND`, `AUTOSHOW_DEFUDDLE_BIN` |
| Logging | `AUTOSHOW_LOG_FORMAT`, `AUTOSHOW_LOG_LEVEL`, `NO_COLOR`, `FORCE_COLOR` |
| Timeouts | `AUTOSHOW_MEDIA_GENERATION_TIMEOUT_MS`, `AUTOSHOW_LLM_REQUEST_TIMEOUT_MS`, `AUTOSHOW_OCR_REQUEST_TIMEOUT_MS`, `AUTOSHOW_UNSTRUCTURED_OCR_POLL_DEADLINE_MS`, `AUTOSHOW_UNSTRUCTURED_OCR_STALL_DEADLINE_MS`, `AUTOSHOW_UNSTRUCTURED_OCR_EMPTY_WORKFLOW_DEADLINE_MS` |
| llama.cpp | `LLAMA_SERVER_START_TIMEOUT_MS` |
| yt-dlp | `YTDLP_COOKIES_FROM_BROWSER`, `YTDLP_COOKIES`, `YTDLP_EXTRACTOR_ARGS` |
