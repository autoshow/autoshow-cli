# Commands

## Outline

- [Quick Start](#quick-start)
- [Command Map](#command-map)
- [Selection Guide](#selection-guide)
- [Pricing Preflight](#pricing-preflight)

## Quick Start

AutoShow currently exposes 14 named commands, plus built-in `help` and `version`.

```bash
# install/setup local runtimes and tools
bun as setup

# extract only (no LLM summary)
bun as extract input/examples/audio/1-audio.mp3

# extract with Groq STT
bun as extract input/examples/audio/1-audio.mp3 --groq-stt whisper-large-v3

# extract with xAI Grok STT
bun as extract input/examples/audio/1-audio.mp3 --grok-stt speech-to-text

# extract with DeepInfra Whisper STT
bun as extract input/examples/audio/1-audio.mp3 --deepinfra-stt openai/whisper-large-v3-turbo

# extract with deAPI STT
bun as extract input/examples/audio/1-audio.mp3 --deapi-stt WhisperLargeV3

# extract with Happy Scribe STT
bun as extract input/examples/audio/1-audio.mp3 --happyscribe-stt auto

# extract with Deepgram STT
bun as extract input/examples/audio/1-audio.mp3 --deepgram-stt nova-3

# extract with AssemblyAI STT
bun as extract input/examples/audio/1-audio.mp3 --assemblyai-stt universal-3-pro

# full pipeline (download/transcribe + LLM write)
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4

# full pipeline with Z.AI GLM 5.1
bun as write input/examples/audio/1-audio.mp3 --glm glm-5.1

# full pipeline with Kimi K2.6
bun as write input/examples/audio/1-audio.mp3 --kimi kimi-k2.6

# metadata with save
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --save

# metadata as Markdown frontmatter YAML
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# document OCR/extraction only
bun as extract input/examples/document/1-document.pdf

# document OCR with DeepInfra
bun as extract input/examples/document/1-document.pdf --deepinfra-ocr Qwen/Qwen3-VL-30B-A3B-Instruct

# document OCR with Kimi
bun as extract input/examples/document/1-document.pdf --kimi-ocr kimi-k2.6

# X Space metadata extraction (auto-detected, requires X_BEARER_TOKEN)
bun as extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# X post referencing a Space (looks up the post, extracts Space metadata)
bun as extract "https://x.com/user/status/1234567890"

# text-to-speech from local markdown/txt
bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-mini

# text-to-speech with Gemini
bun as tts input/examples/tts/1-tts.md --gemini-tts gemini-3.1-flash-tts-preview

# text-to-speech with OpenAI custom voice creation
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --openai-tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123

# text-to-speech with ElevenLabs Instant Voice Cloning
bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_flash_v2_5 --elevenlabs-tts-ref-audio input/examples/audio/anthony-voice.mp3

# text-to-speech with a trained ElevenLabs Professional Voice Clone
bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_flash_v2_5 --elevenlabs-tts-pvc-voice pvc_voice_123

# text-to-speech with xAI Grok
bun as tts input/examples/tts/1-tts.md --grok-tts grok-tts --grok-tts-voice eve

# text-to-speech with Mistral Voxtral reference audio
bun as tts input/examples/tts/1-tts.md --mistral-tts voxtral-mini-tts-2603 --mistral-tts-ref-audio input/examples/audio/anthony-voice.mp3

# text-to-speech with MiniMax rapid voice cloning
bun as tts input/examples/tts/1-tts.md --minimax-tts speech-2.8-turbo --minimax-tts-ref-audio input/examples/audio/anthony-voice.mp3

# text-to-speech with Runway-hosted Eleven multilingual v2
bun as tts input/examples/tts/1-tts.md --runway-tts eleven_multilingual_v2 --runway-tts-voice Leslie

# text-to-speech with deAPI Qwen3 voice cloning
bun as tts input/examples/tts/1-tts.md --deapi-tts Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/0-audio-short.mp3

# image generation
bun as image "a sunset over mountains" --gemini-image imagen-4.0-fast-generate-001

# image generation with OpenAI GPT Image 2 low quality
bun as image "a product sketch of a travel mug" --openai-image gpt-image-2 --image-size 1024x1024 --image-quality low

# image generation with deAPI
bun as image "a sunset over mountains" --deapi-image Flux1schnell --image-size 768x768

# image generation with BFL
bun as image "a sunset over mountains" --bfl-image flux-2-pro-preview --image-size 1024x1024

# local lyric-video render from repo audio
# bundled lyrics fixtures: input/examples/lyrics/01-example-song.mp3,
# input/examples/lyrics/01-cover.jpeg, and input/examples/lyrics/01-example-song.txt
bun as music --audio input/examples/lyrics/01-example-song.mp3

# lyric draft generation from project text
bun as write ./output/demo/text --prompt rockSong

# music generation
bun as music "an ambient piano instrumental with soft strings" --minimax-music music-2.5
bun as music "bright 90s pop rock with a huge chorus" --gemini-music lyria-3-clip-preview

# video generation
bun as video "a cinematic mountain sunrise" --gemini-video veo-3.1-lite-generate-preview

# video generation with multiple providers
bun as video "a cinematic mountain sunrise" --gemini-video veo-3.1-lite-generate-preview --minimax-video MiniMax-Hailuo-2.3 --runway-video gen4.5 --deapi-video Ltxv_13B_0_9_8_Distilled_FP8
```

## Command Map

- `metadata`: [metadata](./commands/setup-and-utilities/metadata/metadata.md)
- `setup` / model pre-downloads / sample fixtures: [setup](./commands/process-steps/step-0-setup/setup.md)
- `sample fixtures`: [setup --sample](./commands/setup-and-utilities/sample/sample.md)
- `cache`: [cache](./commands/setup-and-utilities/cache/cache.md)
- `download`: [download](./commands/process-steps/step-1-download/download-file.md)
- `extract`: [extract](./commands/process-steps/step-2-extract/01-extract.md) — routes media to STT, documents/images to OCR, article HTML to article extraction, and X/Twitter Space or post links to the X API.
- `resume`: [resume](./commands/setup-and-utilities/resume/resume.md)
- `write`: [command](./commands/process-steps/step-3-write/write-text.md) | [setup](./commands/process-steps/step-3-write/write-text.md#setup)
- `tts`: [command](./commands/process-steps/step-4-tts/text-to-speech.md) | [setup](./commands/process-steps/step-4-tts/text-to-speech.md#setup)
- `image`: [command](./commands/process-steps/step-5-image/text-to-image.md) | [setup](./commands/process-steps/step-5-image/text-to-image.md#setup)
- `video`: [video](./commands/process-steps/step-6-video/text-to-video-services.md)
- `music`: [music](./commands/process-steps/step-7-music/text-to-music-services.md)
- `config`: [config](./commands/setup-and-utilities/config/config.md)
- `links`: [links](./commands/setup-and-utilities/links/links.md)
- `benchmark`: [benchmark](./commands/setup-and-utilities/benchmark/benchmark.md)

## Selection Guide

- Use `metadata` for quick metadata inspection without downloading.
- Use `download` for downloading media/documents and collecting metadata.
- Use `extract` when you only need step-2 extraction or transcription without LLM writing, or to collect X Space metadata.
- Use `resume` to backfill missing media transcription or document OCR providers in an existing output directory, including `extract` parent batches.
- Use `write` for full summary pipeline with optional TTS/image/video generation, and for lyric draft generation from `./output/<name>/text`.
- Use `music --audio` or `music --batch` for lyric-video rendering from repo audio under `input/`.
- Use standalone `tts`, `image`, `music`, and `video` commands for direct generation workflows.

## Pricing Preflight

Most hosted or mixed-provider runtime commands support `--price` to print estimated cost and exit. `music --audio` and `music --batch` are local lyric-video modes and reject `--price`:

```bash
bun as extract input/examples/audio/1-audio.mp3 --elevenlabs-stt scribe_v2 --price
bun as extract input/examples/audio/1-audio.mp3 --deepinfra-stt openai/whisper-large-v3-turbo --price
bun as extract https://www.youtube.com/watch?v=dQw4w9WgXcQ --deapi-stt WhisperLargeV3 --price
bun as extract input/examples/audio/1-audio.mp3 --happyscribe-stt auto --price
bun as extract input/examples/audio/1-audio.mp3 --deepgram-stt nova-3 --price
bun as extract input/examples/audio/1-audio.mp3 --groq-stt whisper-large-v3 --price
bun as extract input/examples/audio/1-audio.mp3 --grok-stt speech-to-text --price
bun as extract input/examples/document/1-document.pdf --deepinfra-ocr Qwen/Qwen3-VL-30B-A3B-Instruct --price
bun as extract input/examples/document/1-document.pdf --kimi-ocr kimi-k2.6 --price
bun as write input/examples/audio/1-audio.mp3 --openai gpt-5.4 --price
bun as write input/examples/audio/1-audio.mp3 --glm glm-5.1 --price
bun as write input/examples/audio/1-audio.mp3 --kimi kimi-k2.6 --price
bun as write ./output/demo/text --price
bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_v3 --price
bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_flash_v2_5 --elevenlabs-tts-ref-audio input/examples/audio/anthony-voice.mp3 --price
bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_flash_v2_5 --elevenlabs-tts-pvc-sample input/examples/audio/anthony-voice.mp3 --price
bun as tts input/examples/tts/1-tts.md --groq-tts canopylabs/orpheus-v1-english --price
bun as tts input/examples/tts/1-tts.md --grok-tts grok-tts --price
bun as tts input/examples/tts/1-tts.md --mistral-tts voxtral-mini-tts-2603 --price
bun as tts input/examples/tts/1-tts.md --minimax-tts speech-2.8-turbo --minimax-tts-ref-audio input/examples/audio/anthony-voice.mp3 --price
bun as tts input/examples/tts/1-tts.md --deapi-tts Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/0-audio-short.mp3 --price
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --price
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --openai-tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123 --price
bun as tts input/examples/tts/1-tts.md --runway-tts eleven_multilingual_v2 --price
bun as image "a sunset" --openai-image gpt-image-2 --image-size 1024x1024 --image-quality low --price
bun as image "a sunset" --bfl-image flux-2-klein-4b --price
bun as image "a sunset" --deapi-image Flux1schnell --price
bun as music "an ambient piano instrumental" --minimax-music music-2.5 --price
bun as music "an ambient piano instrumental" --gemini-music lyria-3-pro-preview --music-duration 120 --price
bun as video "a sunset timelapse" --gemini-video veo-3.1-lite-generate-preview --price
bun as video "a sunset timelapse" --minimax-video MiniMax-Hailuo-2.3 --price
bun as video "a sunset timelapse" --glm-video cogvideox-3 --price
bun as video "a sunset timelapse" --grok-video grok-imagine-video --price
bun as video "a sunset timelapse" --runway-video gen4.5 --video-duration 5 --price
bun as video "a sunset timelapse" --deapi-video Ltxv_13B_0_9_8_Distilled_FP8 --video-duration 2 --price
bun as video "a sunset timelapse" --all-video --price
```

For token-priced hosted OCR providers, price preflight uses registry token rates with model-specific input/output token heuristics from recent OCR benchmark usage and adds page processing-time estimates. Kimi's estimate uses cache-miss K2.6 pricing, about `$0.0059/page`. For `extract --deapi-stt` and `tts --deapi-tts`, price preflight uses deAPI's live quote endpoint when available and falls back to registry pricing when an exact quote is unavailable. For `extract --happyscribe-stt`, price preflight is side-effect free, uses the published `$0.20/min` AI rate, and adds a note when execution still needs an explicit organization override.
