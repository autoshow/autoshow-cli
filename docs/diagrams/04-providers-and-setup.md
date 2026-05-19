# Providers, Models & Setup

Provider selection and setup reference covering model routing, installation flow, and command dependencies.

## Outline

- [LLM Provider Selection](#llm-provider-selection)
- [Setup Pipeline](#setup-pipeline)
- [Setup Dependencies by Command](#setup-dependencies-by-command)

## LLM Provider Selection

```
src/cli/commands/process-steps/step-3-write/run-llm.ts

collectTargets() checks all flags - multiple providers can run sequentially. Hosted Kimi (`--kimi`) participates in the same provider fan-out as GLM, Grok, MiniMax, Groq, OpenAI, Anthropic, and Gemini.

  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐
  │ --gemini │  │--anthropic│  │ --openai │  │  --groq  │  │--minimax │  │  --grok  │  │ --glm  │  │  --llama │
  │ flag set?│  │ flag set? │  │ flag set?│  │ flag set?│  │ flag set?│  │ flag set?│  │flag set?│  │ flag set?│
  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  └────┬─────┘
      yes             yes           yes            yes            yes            yes          yes          yes
       |               |             |              |              |              |            |            |
       v               v             v              v              v              v            v            v
  ┌────────┐    ┌──────────┐   ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐   ┌──────┐   ┌─────────────┐
  │ Gemini │    │Anthropic │   │ OpenAI │    │  Groq  │    │MiniMax │    │  Grok  │   │ GLM  │   │  llama.cpp  │
  │  (API) │    │  (API)   │   │  (API) │    │  (API) │    │  (API) │    │  (API) │   │(API) │   │  (local)    │
  └───┬────┘    └────┬─────┘   └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘   └──┬───┘   └──────┬──────┘
      └───────────────┴────────────┴─────────────┴─────────────┴─────────────┴───────────┴────────────────┘
                                   |
                                   v
  ┌──────────────────────────────────────────────────────────────┐
  │  Model Options                                               │
  │                                                              │
  │  Gemini:                                                     │
  │  ├── gemini-3.1-pro-preview                                  │
  │  └── gemini-3.1-flash-lite-preview                           │
  │  Requires: GEMINI_API_KEY                                    │
  │                                                              │
  │  Anthropic:                                                  │
  │  ├── claude-opus-4-7                                         │
  │  ├── claude-sonnet-4-6                                       │
  │  ├── claude-haiku-4-5                                        │
  │  └── claude-opus-4-6                                         │
  │  Requires: ANTHROPIC_API_KEY                                 │
  │                                                              │
  │  OpenAI:                                                     │
  │  ├── gpt-5.4                                                 │
  │  ├── gpt-5.4-pro                                             │
  │  ├── gpt-5.4-mini                                            │
  │  └── gpt-5.4-nano                                            │
  │  Requires: OPENAI_API_KEY                                    │
  │  Uses: /v1/responses (Responses API)                         │
  │                                                              │
  │  Groq (--groq flag, direct Groq LLM):                        │
  │  ├── openai/gpt-oss-20b                                      │
  │  └── openai/gpt-oss-120b                                     │
  │  Requires: GROQ_API_KEY                                      │
  │                                                              │
  │  MiniMax:                                                    │
  │  ├── MiniMax-M2.5                                            │
  │  └── MiniMax-M2.5-highspeed                                  │
  │  Requires: MINIMAX_API_KEY                                   │
  │                                                              │
  │  Grok (--grok flag, xAI Grok LLM):                           │
  │  ├── grok-4.20-reasoning                                     │
  │  └── grok-4.20-non-reasoning                                 │
  │  Requires: XAI_API_KEY                                       │
  │                                                              │
  │  GLM (--glm flag, Z.AI GLM LLM):                              │
  │  └── glm-5.1                                                  │
  │  Requires: GLM_API_KEY                                        │
  │  Pricing: $1.40/M input, $4.40/M output; 18000 ms/1K tokens   │
  │                                                              │
  │  Kimi (--kimi flag, Moonshot Kimi LLM):                       │
  │  └── kimi-k2.6                                                │
  │  Requires: KIMI_API_KEY                                       │
  │  Pricing: $0.95/M input, $4.00/M output; 18000 ms/1K tokens  │
  │                                                              │
  │  llama.cpp (local inference):                                │
  │  ├── ggml-org/gemma-3-270m-it-GGUF                           │
  │  └── ggml-org/Qwen3-0.6B-GGUF                                │
  │  Auto-downloads from HuggingFace on first use                │
  │  Starts llama-server on localhost:8080                       │
  │  Override: LLAMA_MODEL_PATH env var                          │
  └──────────────────────────────────────────────────────────────┘
           |
           v
  ┌──────────────────────────────────────────────────────────────┐
  │  Output (per provider run)                                  │
  │  ├── text.json (single provider) or text-<model>.json       │
  │  └── Step3Metadata { llmService, llmModel, processingTime,  │
  │       inputTokenCount, outputTokenCount }                   │
  └──────────────────────────────────────────────────────────────┘
```

## Setup Pipeline

```
bun as setup → src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts
→ runCompleteSetup()

  ┌─────────────────────────────────────────────────────────────────────┐
  │ Ensure runtime directories                                           │
  │ runtime/bin, runtime/build/whisper.cpp, runtime/models, Reverb envs  │
  └───────────────────────────────────────┬─────────────────────────────┘
                                          |
                                          v
  Local foundations
    setupYtDependencies()      → FFmpeg/ffprobe + yt-dlp
    setupWhisper()             → whisper.cpp binary
    runLlamaSetup()            → llama.cpp binary
    downloadWhisperModel()     → default tiny model
    ensureLlamaModelDownloaded(default)
    setupReverb()              → Reverb ASR Python env + models
    setupCalibreDocumentTools()
    setupTesseractOcr()
    setupKittenTts() + default Kitten model

  Hosted STT readiness
    ElevenLabs, Deepgram, Soniox, Speechmatics, Rev, Grok, Mistral,
    OpenAI, Gemini, GLM, Together, AssemblyAI, Gladia,
    Supadata, AWS

  Hosted OCR/article readiness
    OCR: Mistral, GLM, Kimi, OpenAI, Anthropic, Gemini, DeepInfra
    URL article: Firecrawl, GLM Reader, Spider, Zyte

  Hosted TTS readiness
    ElevenLabs, Groq, Grok, Mistral, OpenAI, Gemini, Deepgram, Runway,
    Speechify, Hume, Cartesia, Google Cloud, deAPI
    MiniMax TTS uses MINIMAX_API_KEY but has no dedicated TTS setup hook

  Hosted image/video/music readiness
    Image: Gemini, OpenAI, MiniMax, Grok, Runway, BFL, deAPI
    MiniMax image uses MINIMAX_API_KEY but has no dedicated setup hook
    Video in full setup: deAPI, MiniMax
    Video in `setup --step video`: Gemini, MiniMax, GLM, Grok, Runway, deAPI
    Music: Gemini, ElevenLabs, MiniMax, deAPI

  Validate
    whisper-cli --help
    llama-server --version
```

## Setup Dependencies by Command

| Command | Required Dependencies |
|---------|----------------------|
| `extract` media route | FFmpeg, yt-dlp, Whisper.cpp (or selected STT provider readiness: Google Cloud, AWS, DeepInfra, deAPI, ElevenLabs, Deepgram, Soniox, Speechmatics, Rev, Groq, Grok, Mistral, AssemblyAI, Gladia, Happy Scribe, Supadata, OpenAI, Gemini, GLM, or Together) |
| `extract --reverb` | FFmpeg, yt-dlp, Reverb ASR (Python venv + models) |
| `extract` document/OCR route | MuPDF (mutool), Tesseract OCR (or `--ocrmypdf`/`--paddle`/hosted OCR provider readiness) |
| `extract --anthropic` | `ANTHROPIC_API_KEY` |
| `extract --gemini` | `GEMINI_API_KEY` |
| `extract --kimi` | `KIMI_API_KEY` |
| `extract --deepinfra` | `DEEPINFRA_API_KEY` |
| `extract --aws` | AWS CLI auth, region, and S3 staging bucket for async jobs |
| `extract --gcloud` | Google Cloud CLI auth, Document AI processor settings, and GCS staging bucket |
| `extract --url-backend firecrawl` | `FIRECRAWL_API_KEY`, unless `FIRECRAWL_API_URL` points at a compatible self-hosted or mock endpoint |
| `extract --url-backend glm-reader` | `GLM_API_KEY` |
| `extract --url-backend spider` | `SPIDER_API_KEY`, unless `SPIDER_API_URL` points at a compatible mock endpoint |
| `extract --url-backend zyte` | `ZYTE_API_KEY`, unless `ZYTE_API_URL` points at a compatible mock endpoint |
| `extract --all-url` | Local Defuddle plus hosted URL backend readiness for Firecrawl, GLM Reader, Spider, and Zyte |
| `write` (media) | All of the `extract` media route + llama.cpp (or LLM API key) |
| `write --grok` | `XAI_API_KEY` |
| `write --glm` | `GLM_API_KEY` |
| `write --kimi` | `KIMI_API_KEY` |
| `write` (document) | All of the `extract` document/OCR route + llama.cpp (or LLM API key) |
| `tts --kitten` | Kitten TTS Python venv + models |
| `tts --elevenlabs` | `ELEVENLABS_API_KEY`; IVC/PVC setup flags also need local sample or verification audio |
| `tts --minimax` | `MINIMAX_API_KEY` |
| `tts --groq` | `GROQ_API_KEY` |
| `tts --grok` | `XAI_API_KEY` |
| `tts --mistral` | `MISTRAL_API_KEY`; reference audio is optional per run |
| `tts --openai` | `OPENAI_API_KEY`; custom voice creation also needs `--openai-tts-ref-audio` plus `--openai-tts-consent-id` or `--openai-tts-consent-audio` |
| `tts --gemini` | `GEMINI_API_KEY` |
| `tts --deepgram` | `DEEPGRAM_API_KEY` |
| `tts --speechify` | `SPEECHIFY_API_KEY` |
| `tts --hume` | `HUME_API_KEY` |
| `tts --cartesia` | `CARTESIA_API_KEY` |
| `tts --gcloud` | Google Cloud CLI auth or credentials plus Text-to-Speech API readiness |
| `tts --deapi` | `DEAPI_API_KEY` |
| `image --gemini` | `GEMINI_API_KEY` |
| `image --openai` | `OPENAI_API_KEY` |
| `image --minimax` | `MINIMAX_API_KEY` |
| `image --grok` | `XAI_API_KEY` |
| `image --runway` | `RUNWAYML_API_SECRET` |
| `image --bfl` | `BFL_API_KEY` |
| `image --deapi` | `DEAPI_API_KEY` |
| `video --gemini` | `GEMINI_API_KEY` |
| `video --minimax` | `MINIMAX_API_KEY` |
| `video --glm` | `GLM_API_KEY` |
| `video --grok` | `XAI_API_KEY` |
| `video --runway` | `RUNWAYML_API_SECRET` |
| `video --deapi` | `DEAPI_API_KEY` |
| `music --elevenlabs` | `ELEVENLABS_API_KEY` |
| `music --minimax` | `MINIMAX_API_KEY` |
| `music --deapi` | `DEAPI_API_KEY` |
| `music --gemini` | `GEMINI_API_KEY` |
| `music --audio` / `music --batch` | `ffmpeg`, `ffprobe`, `whisper-cli`, and a local Whisper model (`large-v3-turbo` via `setup --step music`) |
