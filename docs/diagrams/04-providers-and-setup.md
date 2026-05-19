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

  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐  ┌──────────┐
  │ --gemini │  │--anthropic│  │ --openai │  │  --groq  │  │--minimax │  │  --grok  │  │ --glm  │  │ --kimi │  │  --llama │
  │ flag set?│  │ flag set? │  │ flag set?│  │ flag set?│  │ flag set?│  │ flag set?│  │flag set?│  │flag set?│  │ flag set?│
  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  └───┬────┘  └────┬─────┘
      yes             yes           yes            yes            yes            yes          yes         yes          yes
       |               |             |              |              |              |            |           |            |
       v               v             v              v              v              v            v           v            v
  ┌────────┐    ┌──────────┐   ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐   ┌──────┐   ┌──────┐   ┌─────────────┐
  │ Gemini │    │Anthropic │   │ OpenAI │    │  Groq  │    │MiniMax │    │  Grok  │   │ GLM  │   │ Kimi │   │  llama.cpp  │
  │  (API) │    │  (API)   │   │  (API) │    │  (API) │    │  (API) │    │  (API) │   │(API) │   │(API) │   │  (local)    │
  └───┬────┘    └────┬─────┘   └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘   └──┬───┘   └──┬───┘   └──────┬──────┘
      └───────────────┴────────────┴─────────────┴─────────────┴─────────────┴───────────┴──────────┴────────────────┘
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

  Step 2 — Hosted STT readiness
    ElevenLabs, Deepgram, Soniox, Speechmatics, Rev, Grok, Mistral,
    OpenAI, Gemini, GLM, Together, AssemblyAI, Gladia,
    Supadata, ScrapeCreators, AWS

  Step 2 — Hosted OCR readiness
    Mistral, GLM, Kimi, OpenAI, Anthropic, Gemini, DeepInfra, Unstructured

  Step 2 — URL article backend readiness
    Firecrawl, GLM Reader, Spider, Zyte

  Step 4 — Hosted TTS readiness
    ElevenLabs, Groq, Grok, OpenAI, Gemini, Deepgram,
    Speechify, Hume, Cartesia, Google Cloud, deAPI
    MiniMax TTS uses MINIMAX_API_KEY but has no dedicated TTS setup hook
    Mistral TTS is only in `setup --step tts`, not full setup

  Step 5 — Hosted image generation readiness
    Gemini, OpenAI, MiniMax, Grok, Runway, BFL, deAPI
    MiniMax image uses MINIMAX_API_KEY but has no dedicated setup hook

  Step 6 — Hosted video generation readiness
    Full setup: deAPI, MiniMax
    `setup --step video`: Gemini, MiniMax, GLM, Grok, Runway, deAPI

  Step 7 — Hosted music generation readiness
    Gemini, ElevenLabs, MiniMax, deAPI

  Validate
    whisper-cli --help
    llama-server --version
```

## Setup Dependencies by Command

### Step 2 — STT (extract/write media route)

| Command | Required Dependencies |
|---------|----------------------|
| `extract` media route | FFmpeg, yt-dlp, Whisper.cpp (or selected hosted STT provider) |
| `extract --reverb-stt` | FFmpeg, yt-dlp, Reverb ASR (Python venv + models) |
| Hosted STT providers | API key for the selected provider (e.g. `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `DEEPGRAM_API_KEY`, `ASSEMBLYAI_API_KEY`, `GLADIA_API_KEY`, `SONIOX_API_KEY`, `SPEECHMATICS_API_KEY`, `ELEVENLABS_API_KEY`, `MISTRAL_API_KEY`, `XAI_API_KEY`, `GLM_API_KEY`, `TOGETHER_API_KEY`, `DEEPINFRA_API_KEY`, `DEAPI_API_KEY`) |
| `extract --aws-stt` | AWS CLI auth, region, and S3 staging bucket |
| `extract --gcloud-stt` | Google Cloud CLI auth and STT API readiness |

### Step 2 — OCR (extract/write document route)

| Command | Required Dependencies |
|---------|----------------------|
| `extract` document/OCR route | MuPDF (mutool), Tesseract OCR (or `--ocrmypdf`/`--paddle-ocr`/hosted OCR provider) |
| `extract --anthropic-ocr` | `ANTHROPIC_API_KEY` |
| `extract --gemini-ocr` | `GEMINI_API_KEY` |
| `extract --openai-ocr` | `OPENAI_API_KEY` |
| `extract --mistral-ocr` | `MISTRAL_API_KEY` |
| `extract --kimi-ocr` | `KIMI_API_KEY` |
| `extract --glm-ocr` | `GLM_API_KEY` |
| `extract --deepinfra-ocr` | `DEEPINFRA_API_KEY` |
| `extract --unstructured-ocr` | `UNSTRUCTURED_API_KEY` |
| `extract --aws-textract` | AWS CLI auth, region, and S3 staging bucket for async jobs |
| `extract --gcloud-docai` | Google Cloud CLI auth, Document AI processor settings, and GCS staging bucket |

### Step 2 — URL article backends

| Command | Required Dependencies |
|---------|----------------------|
| `extract --url-backend firecrawl` | `FIRECRAWL_API_KEY`, unless `FIRECRAWL_API_URL` points at a self-hosted endpoint |
| `extract --url-backend glm-reader` | `GLM_API_KEY` |
| `extract --url-backend spider` | `SPIDER_API_KEY`, unless `SPIDER_API_URL` points at a mock endpoint |
| `extract --url-backend zyte` | `ZYTE_API_KEY`, unless `ZYTE_API_URL` points at a mock endpoint |
| `extract --all-url` | Local Defuddle plus all hosted URL backend keys |

### Step 3 — LLM (write command)

| Command | Required Dependencies |
|---------|----------------------|
| `write` (media) | All of the `extract` media route + llama.cpp (or LLM API key) |
| `write` (document) | All of the `extract` document/OCR route + llama.cpp (or LLM API key) |
| `write --openai` | `OPENAI_API_KEY` |
| `write --anthropic` | `ANTHROPIC_API_KEY` |
| `write --gemini` | `GEMINI_API_KEY` |
| `write --groq` | `GROQ_API_KEY` |
| `write --minimax` | `MINIMAX_API_KEY` |
| `write --grok` | `XAI_API_KEY` |
| `write --glm` | `GLM_API_KEY` |
| `write --kimi` | `KIMI_API_KEY` |

### Step 4 — TTS

| Command | Required Dependencies |
|---------|----------------------|
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

### Step 5 — Image generation

| Command | Required Dependencies |
|---------|----------------------|
| `image --gemini` | `GEMINI_API_KEY` |
| `image --openai` | `OPENAI_API_KEY` |
| `image --minimax` | `MINIMAX_API_KEY` |
| `image --grok` | `XAI_API_KEY` |
| `image --runway` | `RUNWAYML_API_SECRET` |
| `image --bfl` | `BFL_API_KEY` |
| `image --deapi` | `DEAPI_API_KEY` |

### Step 6 — Video generation

| Command | Required Dependencies |
|---------|----------------------|
| `video --gemini` | `GEMINI_API_KEY` |
| `video --minimax` | `MINIMAX_API_KEY` |
| `video --glm` | `GLM_API_KEY` |
| `video --grok` | `XAI_API_KEY` |
| `video --runway` | `RUNWAYML_API_SECRET` |
| `video --deapi` | `DEAPI_API_KEY` |

### Step 7 — Music generation

| Command | Required Dependencies |
|---------|----------------------|
| `music --elevenlabs` | `ELEVENLABS_API_KEY` |
| `music --minimax` | `MINIMAX_API_KEY` |
| `music --deapi` | `DEAPI_API_KEY` |
| `music --gemini` | `GEMINI_API_KEY` |
| `music --audio` / `music --batch` | `ffmpeg`, `ffprobe`, `whisper-cli`, and a local Whisper model (`large-v3-turbo` via `setup --step music`) |
