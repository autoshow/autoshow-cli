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

  ┌───────────────────────────────────────────────────────────────────┐
  │  Ensure runtime directories:                                      │
  │  runtime/bin/    runtime/build/whisper.cpp/    runtime/models/     │
  │  runtime/bin/reverb/    runtime/models/reverb/                     │
  └───────────────────────────────────────┬───────────────────────────┘
                                          |
                                          v
  Step 1  ─── setupYtDependencies() ───── FFmpeg + yt-dlp
                                          |
  Step 2  ─── setupWhisper() ──────────── Build whisper.cpp binary
                                          |
  Step 3  ─── runLlamaSetup() ─────────── Build llama.cpp binary
                                          |
  Step 4  ─── downloadWhisperModel() ──── Download tiny.bin model
                                          |
  Step 5  ─── checkLlamaInstalled() ───── Verify llama.cpp ready
                                          │  (model auto-downloads on first use)
                                          |
  Step 6  ─── setupReverb() ───────────── Python venv + Reverb ASR models
                                          |
  Step 7  ─── setupElevenLabsStt() ────── Check ElevenLabs STT (API key only)
                                          |
  Step 8  ─── setupDeepgramStt() ──────── Check Deepgram STT (API key only)
                                          |
  Step 9  ─── setupSonioxStt() ────────── Check Soniox STT (API key only)
                                          |
  Step 10 ─── setupSpeechmaticsStt() ──── Check Speechmatics STT (API key only)
                                          |
  Step 11 ─── setupRevStt() ───────────── Check Rev STT (API key only)
                                          |
  Step 12 ─── setupGrokStt() ──────────── Check Grok STT (API key only)
                                          |
  Step 12 ─── setupMistralStt() ───────── Check Mistral STT (API key only)
              setupMistralOcr() ───────── Check Mistral OCR (API key only)
              setupGlmOcr() ───────────── Check GLM OCR (API key only)
              setupKimiOcr() ───────────── Check Kimi write/OCR (API key only)
              setupOpenAIOcr() ────────── Check OpenAI OCR (API key only)
              setupAnthropicOcr() ─────── Check Anthropic OCR (API key only)
              setupGeminiOcr() ────────── Check Gemini OCR (API key only)
                                          |
  Step 13 ─── setupAssemblyAiStt() ────── Check AssemblyAI STT (API key only)
                                          |
  Step 14 ─── setupGladiaStt() ────────── Check Gladia STT (API key only)
                                          |
  Step 15 ─── setupDocumentTools() ────── MuPDF (mutool) for PDFs
                                          |
  Step 16 ─── setupExtractionOcr() ────── Tesseract OCR
                                          |
  Step 17 ─── setupKittenTts() ────────── Kitten TTS Python venv + models
              downloadKittenTtsModel() ── Download default Kitten model
                                          |
  Step 14 ─── setupElevenLabsTts() ────── Check ElevenLabs TTS (API key only)
                                          |
  Step 15 ─── setupGroqTts() ──────────── Check Groq TTS (API key only)
                                          |
  Step 16 ─── setupGrokTts() ──────────── Check Grok TTS (API key only)
                                          |
  Step 16 ─── setupOpenAITts() ────────── Check OpenAI TTS (API key only)
                                          |
  Step 17 ─── setupGeminiTts() ────────── Check Gemini TTS (API key only)
                                          |
  Step 17 ─── setupDeapiTts() ─────────── Check deAPI TTS (API key only)
                                          |
  Step 18 ─── setupGeminiImageGen() ───── Check Gemini image gen (API key only)
                                          |
  Step 19 ─── setupOpenAIImageGen() ───── Check OpenAI image gen (API key only)
                                          |
  Step 20 ─── setupGeminiMusicGen() ───── Check Gemini music gen (API key only)
                                          |
  Step 21 ─── setupElevenLabsMusicGen() ─ Check ElevenLabs music gen (API key only)
                                          |
  Step 22 ─── setupMinimaxMusicGen() ──── Check MiniMax music gen (API key only)
                                          |
  Validate ── validateBinaries() ──────── Test whisper-cli + llama-server
```

## Setup Dependencies by Command

| Command | Required Dependencies |
|---------|----------------------|
| `extract` media route | FFmpeg, yt-dlp, Whisper.cpp (or `--groq-stt`/`--grok-stt`/`--elevenlabs-stt`/`--deepgram-stt`/`--soniox-stt`/`--speechmatics-stt`/`--rev-stt`/`--mistral-stt`/`--assemblyai-stt`/`--gladia-stt` API key) |
| `extract --reverb` | FFmpeg, yt-dlp, Reverb ASR (Python venv + models) |
| `extract` document/OCR route | MuPDF (mutool), Tesseract OCR (or `--ocrmypdf`/`--paddle-ocr`/`--mistral-ocr`/`--glm-ocr`/`--kimi-ocr`/`--openai-ocr`/`--anthropic-ocr`/`--gemini-ocr`/`--deepinfra-ocr` API key) |
| `extract --anthropic-ocr` | `ANTHROPIC_API_KEY` |
| `extract --gemini-ocr` | `GEMINI_API_KEY` |
| `extract --kimi-ocr` | `KIMI_API_KEY` |
| `extract --deepinfra-ocr` | `DEEPINFRA_API_KEY` |
| `write` (media) | All of the `extract` media route + llama.cpp (or LLM API key) |
| `write --grok` | `XAI_API_KEY` |
| `write --glm` | `GLM_API_KEY` |
| `write --kimi` | `KIMI_API_KEY` |
| `write` (document) | All of the `extract` document/OCR route + llama.cpp (or LLM API key) |
| `tts --kitten-tts` | Kitten TTS Python venv + models |
| `tts --elevenlabs-tts` | `ELEVENLABS_API_KEY` |
| `tts --minimax-tts` | `MINIMAX_API_KEY`; `--minimax-tts-ref-audio` also needs local `mp3`, `m4a`, or `wav` clone source audio |
| `tts --groq-tts` | `GROQ_API_KEY` |
| `tts --grok-tts` | `XAI_API_KEY` |
| `tts --openai-tts` | `OPENAI_API_KEY`; custom voice creation also needs `--openai-tts-ref-audio` plus `--openai-tts-consent-id` or `--openai-tts-consent-audio` |
| `tts --gemini-tts` | `GEMINI_API_KEY` |
| `tts --runway-tts` | `RUNWAYML_API_SECRET` |
| `tts --deapi-tts` | `DEAPI_API_KEY` |
| `image --gemini-image` | `GEMINI_API_KEY` |
| `image --openai-image` | `OPENAI_API_KEY` |
| `image --minimax-image` | `MINIMAX_API_KEY` |
| `image --bfl-image` | `BFL_API_KEY` |
| `video --gemini-video` | `GEMINI_API_KEY` |
| `video --minimax-video` | `MINIMAX_API_KEY` |
| `video --glm-video` | `GLM_API_KEY` |
| `video --grok-video` | `XAI_API_KEY` |
| `video --runway-video` | `RUNWAYML_API_SECRET` |
| `music --elevenlabs-music` | `ELEVENLABS_API_KEY` |
| `music --minimax-music` | `MINIMAX_API_KEY` |
| `music --deapi-music` | `DEAPI_API_KEY` |
| `music --gemini-music` | `GEMINI_API_KEY` |
| `music --audio` / `music --batch` | `ffmpeg`, `ffprobe`, `whisper-cli`, and a local Whisper model (`large-v3-turbo` via `setup --step music`) |
