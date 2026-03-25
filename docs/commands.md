# Commands

## Outline

- [Quick Start](#quick-start)
- [Command Map](#command-map)
- [Selection Guide](#selection-guide)
- [Pricing Preflight](#pricing-preflight)

## Quick Start

AutoShow currently exposes 12 named commands plus the root shorthand. `bun as <input>` is equivalent to `bun as write <input>`.

```bash
# install/setup local runtimes and tools
bun as setup

# stt only (no LLM summary)
bun as stt input/1-audio.mp3

# stt with Groq STT
bun as stt input/1-audio.mp3 --groq-stt whisper-large-v3

# stt with OpenAI STT
bun as stt input/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize

# full pipeline (download/transcribe + LLM write)
bun as write input/1-audio.mp3 --openai gpt-5.2

# root shorthand for write
bun as input/1-audio.mp3 --openai gpt-5.2

# document OCR/extraction only
bun as ocr input/1-document.pdf

# text-to-speech from local markdown/txt
bun as tts input/1-tts.md --kitten-tts kitten-tts-mini

# text-to-speech with Gemini
bun as tts input/1-tts.md --gemini-tts gemini-2.5-flash-preview-tts

# image generation
bun as image "a sunset over mountains" --gemini-image imagen-4.0-fast-generate-001

# music generation
bun as music "an ambient piano instrumental with soft strings" --minimax-music music-2.5

# video generation
bun as video "a cinematic mountain sunrise" --sora-video sora-2
```

## Command Map

- `(root)` shorthand: `bun as <input>` = `bun as write <input>`
- `setup` / model pre-downloads: [setup](./commands/step-0-setup/setup.md)
- `sample`: [sample](./commands/sample/sample.md)
- `models`: download a Whisper or llama.cpp model without running inference (`bun as models <model>`)
- `download`: [download](./commands/step-1-download/download-file.md)
- `ocr` (alias: `extract`): [local](./commands/step-2-extract/extract-document-local.md) | [services](./commands/step-2-extract/extract-document-services.md) | [setup](./commands/step-2-extract/extract-document-local.md#setup)
- `stt` (alias: `transcribe`): [local](./commands/step-2-transcribe/transcribe-audio-local.md) | [services](./commands/step-2-transcribe/transcribe-audio-services.md) | [setup](./commands/step-2-transcribe/transcribe-audio-local.md#setup)
- `write`: [local](./commands/step-3-write/write-text-local.md) | [services](./commands/step-3-write/write-text-services.md) | [setup](./commands/step-3-write/write-text-local.md#setup)
- `tts`: [local](./commands/step-4-tts/text-to-speech-local.md) | [services](./commands/step-4-tts/text-to-speech-services.md) | [setup](./commands/step-4-tts/text-to-speech-local.md#setup)
- `image`: [services](./commands/step-5-image/text-to-image-services.md) | [setup](./commands/step-5-image/text-to-image-setup.md)
- `video`: [video](./commands/step-6-video/text-to-video-services.md)
- `music`: [music](./commands/step-7-music/text-to-music-services.md)
- `config`: [config](./commands/config/config.md)
- `links`: fetch provider documentation

## Selection Guide

- Use `ocr` for documents/images when you only need OCR/text extraction.
- Use `stt` for audio/video when you only need transcript + prompt output.
- Use `write` for full summary pipeline with optional TTS/image/video generation.
- Use standalone `tts`, `image`, `music`, and `video` commands for direct generation workflows.

## Pricing Preflight

Most runtime commands support `--price` (or `--dry-run`) to print estimated cost and exit:

```bash
bun as stt input/1-audio.mp3 --elevenlabs-stt scribe_v2 --price
bun as stt input/1-audio.mp3 --groq-stt whisper-large-v3 --price
bun as write input/1-audio.mp3 --openai gpt-5.2 --price
bun as tts input/1-tts.md --elevenlabs-tts eleven_v3 --price
bun as tts input/1-tts.md --groq-tts canopylabs/orpheus-v1-english --price
bun as tts input/1-tts.md --openai-tts gpt-4o-mini-tts --price
bun as image "a sunset" --openai-image gpt-image-1 --price
bun as music "an ambient piano instrumental" --minimax-music music-2.5 --price
bun as video "a sunset timelapse" --gemini-video veo-3.1-fast-generate-preview --price
```
