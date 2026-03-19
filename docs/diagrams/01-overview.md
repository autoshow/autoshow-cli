# High-Level System Overview

Architecture overview showing the four main layers: CLI, Target routing, Processing pipeline, and Output.

## Outline

- [Layers](#layers)

```
bun as <command> <input> [flags]
            |
            v
    ┌───────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │   CLI Layer   │────>│ Target Layer │────>│  Processing  │────>│    Output     │
    │  (Clerc CLI)  │     │ (Routing)    │     │  Pipeline    │     │  (Files)      │
    └───────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

## Layers

1. **CLI Layer** (`src/cli/create-cli.ts`, `src/cli/flags.ts`)
   - Parses `Bun.argv` via the Clerc framework
   - Defines 12 named commands plus the root shorthand (`bun as <input>` => `write <input>`): `download`, `transcribe`, `write`, `extract`, `tts`, `image`, `music`, `video`, `setup`, `sample`, `models`, `config`
   - Validates flag combinations and argument ordering

2. **Target Layer** (`src/cli/commands/process-steps/step-1-download/targets/`)
   - Classifies input as directory, URL list, YouTube collection, or single item
   - Routes to batch or single-item processing
   - Detects input kind: streaming URL, direct media URL, direct document URL, local media, local document

3. **Processing Pipeline** (`src/cli/commands/process-steps/`)
   - Step 1: Download/detect (audio via yt-dlp/ffmpeg, documents via mutool)
   - Step 2: Transcribe (Whisper/Groq/Reverb/ElevenLabs/OpenAI/Mistral/AssemblyAI STT) or Extract (MuPDF + Tesseract/OCRmyPDF/PaddleOCR/Mistral OCR)
   - Step 3: LLM summary (llama.cpp, OpenAI, Groq, Anthropic, Gemini, MiniMax)
   - Step 4: TTS synthesis — optional (Kitten, ElevenLabs, MiniMax, Groq, OpenAI, Gemini)
   - Step 5: Image generation — optional (Gemini, OpenAI DALL-E, MiniMax)
   - Step 6: Video generation — optional (Sora, Gemini Veo, MiniMax)
   - Step 7: Music generation — optional (ElevenLabs, MiniMax)

4. **Output** (`output/`)
   - Timestamped directories with audio, transcripts, extractions, prompts, summaries, metadata, and generated media files
