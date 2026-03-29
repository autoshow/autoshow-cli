# Providers, Models & Setup

Provider selection and setup reference covering model routing, installation flow, and command dependencies.

## Outline

- [LLM Provider Selection](#llm-provider-selection)
- [Setup Pipeline](#setup-pipeline)
- [Setup Dependencies by Command](#setup-dependencies-by-command)

## LLM Provider Selection

```
src/cli/commands/process-steps/step-3-write/run-llm.ts

collectTargets() checks all flags - multiple providers can run sequentially:

  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ --gemini │  │--anthropic│  │ --openai │  │  --groq  │  │--minimax │  │  --grok  │  │  --llama │
  │ flag set?│  │ flag set? │  │ flag set?│  │ flag set?│  │ flag set?│  │ flag set?│  │ flag set?│
  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
      yes             yes           yes            yes            yes            yes            yes
       |               |             |              |              |              |              |
       v               v             v              v              v              v              v
  ┌────────┐    ┌──────────┐   ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌─────────────┐
  │ Gemini │    │Anthropic │   │ OpenAI │    │  Groq  │    │MiniMax │    │  Grok  │    │  llama.cpp  │
  │  (API) │    │  (API)   │   │  (API) │    │  (API) │    │  (API) │    │  (API) │    │  (local)    │
  └───┬────┘    └────┬─────┘   └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └──────┬──────┘
      └───────────────┴────────────┴─────────────┴─────────────┴─────────────┴─────────────────┘
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
  │  ├── claude-opus-4-6                                         │
  │  ├── claude-sonnet-4-6                                       │
  │  └── claude-haiku-4-5                                        │
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
  │  ├── text.md  (single provider) or text-<model>.md (multi)  │
  │  └── Step3Metadata { llmService, llmModel, processingTime,  │
  │       inputTokenCount, outputTokenCount }                   │
  └──────────────────────────────────────────────────────────────┘
```

## Setup Pipeline

```
bun as setup → src/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup.ts
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
  Step 8  ─── setupOpenAIStt() ────────── Check OpenAI STT (API key only)
                                          |
  Step 9  ─── setupMistralStt() ───────── Check Mistral STT (API key only)
              setupMistralOcr() ───────── Check Mistral OCR (API key only)
                                          |
  Step 10 ─── setupAssemblyAiStt() ────── Check AssemblyAI STT (API key only)
                                          |
  Step 11 ─── setupDocumentTools() ────── MuPDF (mutool) for PDFs
                                          |
  Step 12 ─── setupExtractionOcr() ────── Tesseract OCR
                                          |
  Step 13 ─── setupKittenTts() ────────── Kitten TTS Python venv + models
              downloadKittenTtsModel() ── Download default Kitten model
                                          |
  Step 14 ─── setupElevenLabsTts() ────── Check ElevenLabs TTS (API key only)
                                          |
  Step 15 ─── setupGroqTts() ──────────── Check Groq TTS (API key only)
                                          |
  Step 16 ─── setupOpenAITts() ────────── Check OpenAI TTS (API key only)
                                          |
  Step 17 ─── setupGeminiTts() ────────── Check Gemini TTS (API key only)
                                          |
  Step 18 ─── setupGeminiImageGen() ───── Check Gemini image gen (API key only)
                                          |
  Step 19 ─── setupOpenAIImageGen() ───── Check OpenAI image gen (API key only)
                                          |
  Step 20 ─── setupElevenLabsMusicGen() ─ Check ElevenLabs music gen (API key only)
                                          |
  Step 21 ─── setupMinimaxMusicGen() ──── Check MiniMax music gen (API key only)
                                          |
  Validate ── validateBinaries() ──────── Test whisper-cli + llama-server
```

## Setup Dependencies by Command

| Command | Required Dependencies |
|---------|----------------------|
| `transcribe` | FFmpeg, yt-dlp, Whisper.cpp (or `--groq-stt`/`--elevenlabs-stt`/`--openai-stt`/`--mistral-stt`/`--assemblyai-stt` API key) |
| `transcribe --reverb` | FFmpeg, yt-dlp, Reverb ASR (Python venv + models) |
| `extract` | MuPDF (mutool), Tesseract OCR (or `--ocrmypdf`/`--paddle-ocr`) |
| `write` (media) | All of `transcribe` + llama.cpp (or LLM API key) |
| `write --grok` | `XAI_API_KEY` |
| `write` (document) | All of `extract` + llama.cpp (or LLM API key) |
| `tts --kitten-tts` | Kitten TTS Python venv + models |
| `tts --elevenlabs-tts` | `ELEVENLABS_API_KEY` |
| `tts --groq-tts` | `GROQ_API_KEY` |
| `tts --openai-tts` | `OPENAI_API_KEY` |
| `tts --gemini-tts` | `GEMINI_API_KEY` |
| `image --gemini-image` | `GEMINI_API_KEY` |
| `image --openai-image` | `OPENAI_API_KEY` |
| `image --minimax-image` | `MINIMAX_API_KEY` |
| `video --gemini-video` | `GEMINI_API_KEY` |
| `video --minimax-video` | `MINIMAX_API_KEY` |
| `music --elevenlabs-music` | `ELEVENLABS_API_KEY` |
| `music --minimax-music` | `MINIMAX_API_KEY` |
