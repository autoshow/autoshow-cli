# Providers, Models & Setup

Provider selection and setup reference covering model routing, installation flow, and command dependencies.

## Outline

- [LLM Provider Selection](#llm-provider-selection)
- [Setup Pipeline](#setup-pipeline)
- [Setup Dependencies by Command](#setup-dependencies-by-command)

## LLM Provider Selection

```
src/cli/commands/process-steps/step-3-write/run-llm.ts

collectTargets() checks repeatable `--llm provider[=model]` selectors - multiple providers can run sequentially. Hosted Kimi participates in the same provider fan-out as GLM, Grok, MiniMax, Groq, OpenAI, Anthropic, and Gemini.

  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐  ┌──────────┐
  │  gemini  │  │ anthropic │  │  openai  │  │   groq   │  │ minimax  │  │   grok   │  │  glm   │  │  kimi  │  │  llama   │
  │selected? │  │ selected? │  │selected? │  │selected? │  │selected? │  │selected? │  │selected│  │selected│  │selected? │
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
  │  └── claude-haiku-4-5                                        │
  │  Requires: ANTHROPIC_API_KEY                                 │
  │                                                              │
  │  OpenAI:                                                     │
  │  ├── gpt-5.5                                                 │
  │  ├── gpt-5.4                                                 │
  │  ├── gpt-5.4-pro                                             │
  │  ├── gpt-5.4-mini                                            │
  │  └── gpt-5.4-nano                                            │
  │  Requires: OPENAI_API_KEY                                    │
  │  Uses: /v1/responses (Responses API)                         │
  │                                                              │
  │  Groq (direct Groq LLM):                                      │
  │  ├── openai/gpt-oss-20b                                      │
  │  └── openai/gpt-oss-120b                                     │
  │  Requires: GROQ_API_KEY                                      │
  │                                                              │
  │  MiniMax:                                                    │
  │  ├── MiniMax-M2.7                                            │
  │  └── MiniMax-M2.7-highspeed                                  │
  │  Requires: MINIMAX_API_KEY                                   │
  │                                                              │
  │  Grok (xAI Grok LLM):                                        │
  │  ├── grok-4.3                                                │
  │  ├── grok-4.20-reasoning                                     │
  │  └── grok-4.20-non-reasoning                                 │
  │  Requires: XAI_API_KEY                                       │
  │                                                              │
  │  GLM (Z.AI GLM LLM):                                          │
  │  └── glm-5.1                                                  │
  │  Requires: GLM_API_KEY                                        │
  │  Pricing: $1.40/M input, $4.40/M output; 18000 ms/1K tokens   │
  │                                                              │
  │  Kimi (Moonshot Kimi LLM):                                    │
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
    Groq, Grok, DeepInfra, Together, ElevenLabs, Deepgram, Soniox,
    Speechmatics, Rev, Mistral, OpenAI, Gemini, GLM,
    AssemblyAI, Gladia, Happy Scribe, Supadata, ScrapeCreators

  Step 2 — Hosted OCR readiness
    Mistral, GLM, Kimi, OpenAI, Grok, Anthropic, Gemini, DeepInfra,
    Unstructured

  Step 2 — URL article backend readiness
    Firecrawl, GLM Reader, Spider, Zyte

  Step 4 — Hosted TTS readiness
    ElevenLabs, Groq, Grok, OpenAI, Gemini, Deepgram,
    MiniMax, Mistral, Speechify, Hume, Cartesia, Google Cloud

  Step 5 — Hosted image generation readiness
    Gemini, OpenAI, Grok, BFL, and Reve

  Step 6 — Hosted video generation readiness
    Gemini, MiniMax, GLM, Grok, Runway

  Step 7 — Hosted music generation readiness
    ElevenLabs, MiniMax, Gemini; local lyric-video prerequisites

  Validate
    whisper-cli --help
    llama-server --version
```

## Setup Dependencies by Command

### Step 2 — STT (extract/write media route)

| Command | Required Dependencies |
|---------|----------------------|
| `extract` media route | FFmpeg, yt-dlp, Whisper.cpp (or selected hosted STT provider) |
| `extract`/`resume --provider reverb`; `write`/`config --stt reverb` | FFmpeg, yt-dlp, Reverb ASR (Python venv + models) |

### Step 2 — OCR (extract/write document route)

| Command | Required Dependencies |
|---------|----------------------|
| `extract` document/OCR route | MuPDF (mutool), Tesseract OCR (or `--provider ocrmypdf`, `--provider paddle-ocr`, or hosted OCR provider) |
| `extract`/`resume --provider anthropic`; `write`/`config --ocr anthropic` | `ANTHROPIC_API_KEY` |
| `extract`/`resume --provider gemini`; `write`/`config --ocr gemini` | `GEMINI_API_KEY` |
| `extract`/`resume --provider openai`; `write`/`config --ocr openai` | `OPENAI_API_KEY` |
| `extract`/`resume --provider grok`; `write`/`config --ocr grok` | `XAI_API_KEY` |
| `extract`/`resume --provider mistral`; `write`/`config --ocr mistral` | `MISTRAL_API_KEY` |
| `extract`/`resume --provider kimi`; `write`/`config --ocr kimi` | `KIMI_API_KEY` |
| `extract`/`resume --provider glm`; `write`/`config --ocr glm` | `GLM_API_KEY` |
| `extract`/`resume --provider deepinfra`; `write`/`config --ocr deepinfra` | `DEEPINFRA_API_KEY` |
| `extract`/`resume --provider unstructured`; `write`/`config --ocr unstructured` | `UNSTRUCTURED_API_KEY` |

### Step 2 — URL article backends

| Command | Required Dependencies |
|---------|----------------------|
| `extract --url-provider firecrawl` | `FIRECRAWL_API_KEY`, unless `FIRECRAWL_API_URL` points at a self-hosted endpoint |
| `extract --url-provider glm-reader` | `GLM_API_KEY` |
| `extract --url-provider spider` | `SPIDER_API_KEY`, unless `SPIDER_API_URL` points at a mock endpoint |
| `extract --url-provider supadata` | `SUPADATA_API_KEY` |
| `extract --url-provider zyte` | `ZYTE_API_KEY`, unless `ZYTE_API_URL` points at a mock endpoint |
| `extract --all-providers` on an article route | Local Defuddle plus all hosted URL backend keys |

### Step 3 — LLM (write command)

| Command | Required Dependencies |
|---------|----------------------|
| `write` (media) | All of the `extract` media route + llama.cpp (or LLM API key) |
| `write` (document) | All of the `extract` document/OCR route + llama.cpp (or LLM API key) |
| `write`/`config --llm openai` | `OPENAI_API_KEY` |
| `write`/`config --llm anthropic` | `ANTHROPIC_API_KEY` |
| `write`/`config --llm gemini` | `GEMINI_API_KEY` |
| `write`/`config --llm groq` | `GROQ_API_KEY` |
| `write`/`config --llm minimax` | `MINIMAX_API_KEY` |
| `write`/`config --llm grok` | `XAI_API_KEY` |
| `write`/`config --llm glm` | `GLM_API_KEY` |
| `write`/`config --llm kimi` | `KIMI_API_KEY` |

### Step 4 — TTS

| Command | Required Dependencies |
|---------|----------------------|
| `tts --provider kitten`; `write`/`config --tts kitten` | Kitten TTS Python venv + models |
| `tts --provider elevenlabs`; `write`/`config --tts elevenlabs` | `ELEVENLABS_API_KEY`; IVC setup flags also need local sample audio |
| `tts --provider minimax`; `write`/`config --tts minimax` | `MINIMAX_API_KEY` |
| `tts --provider groq`; `write`/`config --tts groq` | `GROQ_API_KEY` |
| `tts --provider grok`; `write`/`config --tts grok` | `XAI_API_KEY` |
| `tts --provider mistral`; `write`/`config --tts mistral` | `MISTRAL_API_KEY`; each synthesis run needs a saved/custom voice ID or reference audio |
| `tts --provider openai`; `write`/`config --tts openai` | `OPENAI_API_KEY`; custom voice creation also needs `--tts-ref-audio` plus `--openai-tts-consent-id` or `--tts-consent-audio` |
| `tts --provider gemini`; `write`/`config --tts gemini` | `GEMINI_API_KEY` |
| `tts --provider deepgram`; `write`/`config --tts deepgram` | `DEEPGRAM_API_KEY` |
| `tts --provider speechify`; `write`/`config --tts speechify` | `SPEECHIFY_API_KEY` |
| `tts --provider hume`; `write`/`config --tts hume` | `HUME_API_KEY` |
| `tts --provider cartesia`; `write`/`config --tts cartesia` | `CARTESIA_API_KEY` |

### Step 5 — Image generation

| Command | Required Dependencies |
|---------|----------------------|
| `image --provider gemini`; `write`/`config --image gemini` | `GEMINI_API_KEY` |
| `image --provider openai`; `write`/`config --image openai` | `OPENAI_API_KEY` |
| `image --provider grok`; `write`/`config --image grok` | `XAI_API_KEY` |
| `image --provider bfl`; `write`/`config --image bfl` | `BFL_API_KEY` |
| `image --provider reve`; `write`/`config --image reve` | `REVE_API_KEY` |

### Step 6 — Video generation

| Command | Required Dependencies |
|---------|----------------------|
| `video --provider gemini`; `write`/`config --video gemini` | `GEMINI_API_KEY` |
| `video --provider minimax`; `write`/`config --video minimax` | `MINIMAX_API_KEY` |
| `video --provider glm`; `write`/`config --video glm` | `GLM_API_KEY` |
| `video --provider grok`; `write`/`config --video grok` | `XAI_API_KEY` |
| `video --provider runway`; `write`/`config --video runway` | `RUNWAYML_API_SECRET` |

### Step 7 — Music generation

| Command | Required Dependencies |
|---------|----------------------|
| `music --provider elevenlabs`; `write`/`config --music elevenlabs` | `ELEVENLABS_API_KEY` |
| `music --provider minimax`; `write`/`config --music minimax` | `MINIMAX_API_KEY` |
| `music --provider gemini`; `write`/`config --music gemini` | `GEMINI_API_KEY` |
| `music --audio` / `music --batch` | `ffmpeg`, `ffprobe`, `whisper-cli`, and a local Whisper model (`large-v3-turbo` via `setup --step music`) |
