# LLM Provider Selection

Routing diagram for LLM provider selection across llama.cpp, OpenAI, Groq, Anthropic, Gemini, and MiniMax.

```
src/process-steps/step-3-write/run-llm.ts

collectTargets() checks all flags — multiple providers can run sequentially:

  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ --gemini │  │--anthropic│  │ --openai │  │  --groq  │  │--minimax │  │  --llama │
  │ flag set?│  │ flag set? │  │ flag set?│  │ flag set?│  │ flag set?│  │ flag set?│
  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
      yes             yes           yes            yes            yes            yes
       |               |             |              |              |              |
       v               v             v              v              v              v
  ┌────────┐    ┌──────────┐   ┌────────┐    ┌────────┐    ┌────────┐    ┌─────────────┐
  │ Gemini │    │Anthropic │   │ OpenAI │    │  Groq  │    │MiniMax │    │  llama.cpp  │
  │  (API) │    │  (API)   │   │  (API) │    │  (API) │    │  (API) │    │  (local)    │
  └───┬────┘    └────┬─────┘   └───┬────┘    └───┬────┘    └───┬────┘    └──────┬──────┘
      └───────────────┴────────────┴─────────────┴─────────────┴─────────────────┘
                                   |
                                   v
  ┌──────────────────────────────────────────────────────────────┐
  │  Model Options                                               │
  │                                                              │
  │  Gemini:                                                     │
  │  ├── gemini-3-flash-preview                                  │
  │  ├── gemini-3-pro-preview                                    │
  │  Requires: GEMINI_API_KEY                                    │
  │                                                              │
  │  Anthropic:                                                  │
  │  ├── claude-opus-4-6                                         │
  │  └── claude-sonnet-4-6                                       │
  │  Requires: ANTHROPIC_API_KEY                                 │
  │                                                              │
  │  OpenAI:                                                     │
  │  ├── gpt-5.2                                                 │
  │  ├── gpt-5.2-pro                                             │
  │  └── gpt-5.1                                                 │
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
  │  llama.cpp (local inference):                                │
  │  ├── ggml-org/gemma-3-270m-it-GGUF                           │
  │  └── ggml-org/Qwen3-0.6B-GGUF                               │
  │  Auto-downloads from HuggingFace on first use                │
  │  Starts llama-server on localhost:8080                        │
  │  Override: LLAMA_MODEL_PATH env var                           │
  └──────────────────────────────────────────────────────────────┘
           |
           v
  ┌──────────────────────────────────────────────────────────────┐
  │  Output (per provider run)                                   │
  │  ├── text.md  (single provider) or text-<model>.md (multi)   │
  │  └── Step3Metadata { llmService, llmModel, processingTime,   │
  │       inputTokenCount, outputTokenCount }                    │
  └──────────────────────────────────────────────────────────────┘
```
