# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

AutoShow CLI is a TypeScript-based Node.js application that automates the processing of audio and video content from various sources (YouTube videos/playlists, podcast RSS feeds, local media files). It provides a comprehensive pipeline for transcription, AI-powered content generation, text-to-speech, and AI image generation.

## Common Development Commands

### Setup and Installation
```bash
# Initial setup - installs dependencies, creates .env, and builds whisper.cpp binaries
npm run setup

# Type check without compilation
npm run check

# Install dependencies only
npm install
```

### Core AutoShow Commands
```bash
# Process single YouTube video
npm run as -- text --video "https://www.youtube.com/watch?v=VIDEO_ID"

# Process with specific transcription and LLM models
npm run as -- text --video "URL" --whisper large-v3-turbo --chatgpt gpt-4o-mini

# Process local audio/video file
npm run as -- text --file "./input/audio.mp3"

# Process podcast RSS feed
npm run as -- text --rss "https://example.com/feed"

# Text-to-speech generation
npm run as -- tts file input/sample.md --coqui

# AI image generation
npm run as -- image generate --prompt "description" --service dalle
```

### Shorthand Commands
```bash
# Video processing shortcuts
npm run v -- "VIDEO_URL"                    # Basic video processing
npm run v3 -- "VIDEO_URL"                   # With large-v3-turbo model

# File processing shortcuts  
npm run f -- "FILE_PATH"                    # Basic file processing
npm run f3 -- "FILE_PATH"                   # With large-v3-turbo model

# RSS processing shortcuts
npm run r -- "RSS_URL"                      # Basic RSS processing
npm run r3 -- "RSS_URL"                     # With large-v3-turbo model

# Playlist processing shortcuts
npm run p -- "PLAYLIST_URL"                 # Basic playlist processing
npm run p3 -- "PLAYLIST_URL"                # With large-v3-turbo model

# URLs file processing shortcuts
npm run u -- "URLS_FILE_PATH"               # Basic URLs file processing
npm run u3 -- "URLS_FILE_PATH"              # With large-v3-turbo model

# Channel processing shortcuts
npm run c -- "CHANNEL_URL"                  # Basic channel processing
npm run c3 -- "CHANNEL_URL"                 # With large-v3-turbo model
```

### Development and Testing
```bash
# Run TypeScript files directly
npm run tsx:base -- src/commander.ts

# Test suites
npm run test:local      # Local file tests
npm run test:services   # CLI tests with 3rd party services
npm run test:prompts    # All prompt variations
npm run test:models     # All model combinations
npm run test:cli        # All CLI tests

# Generate repository snapshot
npm run repo
```

### TTS and Image Commands
```bash
# Text-to-speech shortcuts
npm run tts                                 # TTS command (equivalent to npm run as -- tts)

# Image generation shortcuts
npm run image                               # Image command (equivalent to npm run as -- image)
```

## Architecture Overview

### Command Structure
The CLI follows a modular command structure with three main commands:

1. **text** - Core content processing (transcription + LLM processing)
2. **tts** - Text-to-speech generation with multiple engines
3. **image** - AI image generation with multiple services

### Processing Pipeline
The text processing follows a 5-step pipeline:

1. **01-generate-markdown.ts** - Extract metadata and generate front matter
2. **02-download-audio.ts** - Download and convert audio using yt-dlp/ffmpeg  
3. **03-run-transcription.ts** - Transcribe audio using selected service
4. **04-select-prompt.ts** - Apply content generation prompts
5. **05-run-llm.ts** - Process with selected language model

### Key Service Integrations

**Transcription Services:**
- Whisper.cpp (local, including CoreML acceleration)
- Deepgram
- AssemblyAI  
- Groq Whisper

**Language Models:**
- OpenAI ChatGPT
- Anthropic Claude
- Google Gemini

**TTS Engines:**
- Coqui TTS (local Python-based)
- ElevenLabs (API)
- AWS Polly (API)
- Kitten TTS (lightweight CPU-only)

**Image Generation:**
- DALL-E (OpenAI)
- Black Forest Labs (Flux models)
- AWS Nova Canvas

### Directory Structure
```
src/
├── commander.ts           # Main CLI entry point
├── types.ts              # TypeScript interfaces
├── logging.ts            # Centralized logging utilities
├── node-utils.ts         # Node.js utility functions
├── text/                 # Text processing command
│   ├── create-text-command.ts
│   ├── process-commands/ # Input handlers (video, rss, file, etc.)
│   ├── process-steps/    # 5-step processing pipeline
│   ├── transcription/    # Transcription service integrations
│   ├── llms/            # Language model integrations
│   └── utils/           # Text processing utilities
├── tts/                  # Text-to-speech command
│   ├── create-tts-command.ts
│   ├── tts-services/    # TTS engine implementations
│   └── tts-utils/       # TTS utility functions
└── image/                # Image generation command
    ├── create-image-command.ts
    └── image-services/   # Image service implementations
```

### Environment Configuration
Copy `.env.example` to `.env` and configure API keys for desired services:
- OpenAI, Anthropic, Google (for LLMs)
- Deepgram, AssemblyAI (for transcription)
- ElevenLabs, AWS credentials (for TTS)
- Various voice/speaker IDs for TTS personalization

### Output Structure
- `content/` - Generated markdown files with transcripts and AI content
- `bin/` - Compiled whisper.cpp binaries
- `models/` - Downloaded transcription/TTS models
- `output/` - Generated audio files and images

### Testing Strategy
- Unit tests for individual CLI commands and options
- Integration tests covering all supported transcription and LLM services
- End-to-end tests for complete processing workflows
- Prompt validation tests ensuring all content generation formats work

### Platform Requirements
- **Primary Support:** macOS (setup script handles Homebrew dependencies)
- **Dependencies:** cmake, ffmpeg, graphicsmagick, espeak-ng, pkg-config
- **Runtime:** Node.js with TypeScript, Python environments for TTS models
