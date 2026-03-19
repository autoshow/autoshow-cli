# AutoShow CLI Architecture Diagrams

Comprehensive architecture diagrams covering the entire data flow and all processing branches.

## Outline

- [Diagrams](#diagrams)

## Diagrams

1. [High-Level System Overview](diagrams/01-overview.md) - The 4 main layers and how they connect
2. [CLI Entry Point & Commands](diagrams/02-cli-entry.md) - Clerc CLI setup, commands, interceptors, flag system
3. [Target Classification & Routing](diagrams/03-target-routing.md) - Input routing, single target classification, command/input matrix
4. [Media Processing Pipeline](diagrams/04-media-pipeline.md) - Download audio, transcribe (Whisper/Groq/Reverb/ElevenLabs/OpenAI), LLM summary, optional TTS/image/video/music
5. [Document Processing Pipeline](diagrams/05-document-pipeline.md) - Detect format, extract text (MuPDF + Tesseract/OCRmyPDF/PaddleOCR), LLM summary
6. [LLM Provider Selection](diagrams/06-llm-providers.md) - llama.cpp, OpenAI, Groq, Anthropic, Gemini, MiniMax routing with all model options
7. [Batch Processing](diagrams/07-batch-processing.md) - Directory, URL list, and YouTube collection batch flows
8. [Setup Pipeline](diagrams/08-setup-pipeline.md) - All 8 setup steps and dependency requirements per command
9. [Output Directory Structure](diagrams/09-output-structure.md) - File outputs per command and runtime directory layout
10. [Type System](diagrams/10-types.md) - All types organized by pipeline step (Valibot schemas)
11. [End-to-End Data Flow](diagrams/11-end-to-end.md) - Complete trace of a real command and environment variables
