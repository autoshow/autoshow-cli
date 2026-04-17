# Commands

## Outline

- [Quick Start](#quick-start)
- [Command Map](#command-map)
- [Selection Guide](#selection-guide)
- [Pricing Preflight](#pricing-preflight)

## Quick Start

AutoShow currently exposes 16 named commands plus the root shorthand. `bun as <input>` is equivalent to `bun as metadata <input>`.

```bash
# install/setup local runtimes and tools
bun as setup

# stt only (no LLM summary)
bun as stt input/examples/audio/1-audio.mp3

# stt with Groq STT
bun as stt input/examples/audio/1-audio.mp3 --groq-stt whisper-large-v3

# stt with Deepgram STT
bun as stt input/examples/audio/1-audio.mp3 --deepgram-stt nova-3

# stt with OpenAI STT
bun as stt input/examples/audio/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize

# consensus report for an existing STT or OCR output directory
bun as report output/2026-04-15_episode

# full pipeline (download/transcribe + LLM write)
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4

# root shorthand for metadata (default command)
bun as "https://www.youtube.com/watch?v=u1-WHqATSQU"

# metadata with save
bun as --save "https://www.youtube.com/watch?v=u1-WHqATSQU"

# metadata as Markdown frontmatter YAML
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# document OCR/extraction only
bun as ocr input/examples/document/1-document.pdf

# text-to-speech from local markdown/txt
bun as tts input/examples/document/1-tts.md --kitten-tts kitten-tts-mini

# text-to-speech with Gemini
bun as tts input/examples/document/1-tts.md --gemini-tts gemini-2.5-flash-preview-tts

# image generation
bun as image "a sunset over mountains" --gemini-image imagen-4.0-fast-generate-001

# music generation
bun as music "an ambient piano instrumental with soft strings" --minimax-music music-2.5

# video generation
bun as video "a cinematic mountain sunrise" --gemini-video veo-3.1-fast-generate-preview

# video generation with both providers
bun as video "a cinematic mountain sunrise" --gemini-video veo-3.1-fast-generate-preview --minimax-video MiniMax-Hailuo-2.3
```

## Command Map

- `(root)` shorthand: `bun as <input>` = `bun as metadata <input>`
- `metadata`: [metadata](./commands/setup-and-utilities/metadata/metadata.md)
- `setup` / model pre-downloads: [setup](./commands/process-steps/step-0-setup/setup.md)
- `sample`: [sample](./commands/setup-and-utilities/sample/sample.md)
- `models`: download a Whisper or llama.cpp model without running inference (`bun as models <model>`)
- `cache`: manage the persistent STT media cache (`bun as cache prune` / `bun as cache clear`)
- `download`: [download](./commands/process-steps/step-1-download/download-file.md)
- `ocr`: [command](./commands/process-steps/step-2-ocr/ocr-document.md) | [setup](./commands/process-steps/step-2-ocr/ocr-document.md#setup)
- `stt`: [command](./commands/process-steps/step-2-stt/stt-audio.md) | [setup](./commands/process-steps/step-2-stt/stt-audio.md#setup)
- `report`: [report](./commands/setup-and-utilities/report/report.md)
- `write`: [command](./commands/process-steps/step-3-write/write-text.md) | [setup](./commands/process-steps/step-3-write/write-text.md#setup)
- `tts`: [command](./commands/process-steps/step-4-tts/text-to-speech.md) | [setup](./commands/process-steps/step-4-tts/text-to-speech.md#setup)
- `image`: [command](./commands/process-steps/step-5-image/text-to-image.md) | [setup](./commands/process-steps/step-5-image/text-to-image.md#setup)
- `video`: [video](./commands/process-steps/step-6-video/text-to-video-services.md)
- `music`: [music](./commands/process-steps/step-7-music/text-to-music-services.md)
- `config`: [config](./commands/setup-and-utilities/config/config.md)
- `links`: [links](./commands/setup-and-utilities/links/links.md)

## Selection Guide

- Use `metadata` (or just `bun as <input>`) for quick metadata inspection without downloading.
- Use `download` for downloading media/documents and collecting metadata.
- Use `ocr` for documents/images when you only need OCR/text extraction.
- Use `stt` for audio/video when you only need transcript + prompt output.
- Use `report` when you already have STT or OCR run artifacts under `providers/` and want consensus outputs plus review files.
- Use `write` for full summary pipeline with optional TTS/image/video generation.
- Use standalone `tts`, `image`, `music`, and `video` commands for direct generation workflows.

## Pricing Preflight

Most runtime commands support `--price` to print estimated cost and exit:

```bash
bun as stt input/examples/audio/1-audio.mp3 --elevenlabs-stt scribe_v2 --price
bun as stt input/examples/audio/1-audio.mp3 --deepgram-stt nova-3 --price
bun as stt input/examples/audio/1-audio.mp3 --groq-stt whisper-large-v3 --price
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --price
bun as tts input/examples/document/1-tts.md --elevenlabs-tts eleven_v3 --price
bun as tts input/examples/document/1-tts.md --groq-tts canopylabs/orpheus-v1-english --price
bun as tts input/examples/document/1-tts.md --openai-tts gpt-4o-mini-tts --price
bun as image "a sunset" --openai-image gpt-image-1 --price
bun as music "an ambient piano instrumental" --minimax-music music-2.5 --price
bun as video "a sunset timelapse" --gemini-video veo-3.1-fast-generate-preview --price
bun as video "a sunset timelapse" --minimax-video MiniMax-Hailuo-2.3 --price
bun as video "a sunset timelapse" --gemini-video veo-3.1-fast-generate-preview --minimax-video MiniMax-Hailuo-2.3 --price
```
