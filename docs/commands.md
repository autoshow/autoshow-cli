# Commands

## Outline

- [Quick Start](#quick-start)
- [Command Map](#command-map)
- [Selection Guide](#selection-guide)
- [Pricing Preflight](#pricing-preflight)

## Quick Start

AutoShow currently exposes 16 named commands, plus built-in `help` and `version`.

```bash
# install/setup local runtimes and tools
bun as setup

# read-only dependency insight report through a system Socket CLI
bun as sock

# extract only (no LLM summary)
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3

# extract with Groq STT
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq=whisper-large-v3

# extract with xAI Grok STT
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text

# extract with DeepInfra Whisper STT
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3-turbo


# extract with Happy Scribe STT
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto

# extract with Deepgram STT
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3

# extract with AssemblyAI STT
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai=universal-3-pro

# full pipeline (download/transcribe + LLM write)
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5

# full pipeline with xAI Grok 4.3
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm grok=grok-4.3

# full pipeline with Z.AI GLM 5.1
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm glm=glm-5.1

# full pipeline with Kimi K2.6
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm kimi=kimi-k2.6

# metadata with save
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --save

# metadata as Markdown frontmatter YAML
bun as metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# document OCR/extraction only
bun as extract input/examples/document/1-document.pdf

# document OCR with DeepInfra
bun as extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct

# document OCR with Kimi
bun as extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6

# document OCR with Grok
bun as extract input/examples/document/1-document.pdf --provider grok=grok-4.3

# URL article extraction with every backend
bun as extract https://example.com/article --all-providers

# X Space metadata extraction (auto-detected, requires X_BEARER_TOKEN)
bun as extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# X post referencing a Space (looks up the post, extracts Space metadata)
bun as extract "https://x.com/user/status/1234567890"

# text-to-speech from local markdown/txt
bun as tts input/examples/tts/1-tts.md --provider kitten=kitten-tts-mini

# text-to-speech with Gemini
bun as tts input/examples/tts/1-tts.md --provider gemini=gemini-3.1-flash-tts-preview

# text-to-speech with OpenAI custom voice creation
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123

# text-to-speech with ElevenLabs Instant Voice Cloning
bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# text-to-speech with xAI Grok
bun as tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve

# text-to-speech with Groq English Orpheus
bun as tts input/examples/tts/1-tts.md --provider groq=canopylabs/orpheus-v1-english --tts-voice troy

# text-to-speech with Mistral Voxtral reference audio
bun as tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# text-to-speech with MiniMax hosted voices
bun as tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator

# text-to-speech with Hume Octave 2
bun as tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"

# text-to-speech with Cartesia Sonic
bun as tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02


# image generation, then edit/reference the generated image; run this block in order
bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-1.5 --size 1024x1024 --format png --output-dir output/mug-base
bun as image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-1.5 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit

# image reference with native Gemini
bun as image "restyle the generated mug as a 1960s travel poster" --provider gemini=gemini-3.1-flash-image-preview --input output/mug-base/generated-image.png --output-dir output/mug-gemini

# image references with BFL and Reve
bun as image "place the same mug on a rustic breakfast table" --provider bfl=flux-2-pro --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl
bun as image "place the same mug in a minimalist editorial product scene" --provider reve=latest --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-reve

# video from the generated image, then extend/edit the generated video; run this block after output/mug-base exists
bun as video "animate the red enamel mug on a slow turntable with glossy highlights" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/mug-base/generated-image.png --output-dir output/mug-video-base
bun as video "continue the turntable move as the mug rotates toward a warm kitchen window" --provider gemini=veo-3.1-fast-generate-preview --mode extend --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-extend
bun as video "make the lighting moonlit blue while keeping the mug motion intact" --provider grok=grok-imagine-video --mode edit --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-edit


# image generation with BFL
bun as image "a sunset over mountains" --provider bfl=flux-2-pro --size 1024x1024

# image generation with Reve
bun as image "a sunset over mountains" --provider reve=latest --aspect-ratio 16:9 --format webp

# local lyric-video render from repo audio
# bundled lyrics fixtures: input/examples/lyrics/01-example-song.mp3,
# input/examples/lyrics/01-cover.jpeg, and input/examples/lyrics/01-example-song.txt
bun as music --audio input/examples/lyrics/01-example-song.mp3

# lyric draft generation from project text
bun as write ./output/demo/text --prompt rockSong

# music generation
bun as music "an ambient piano instrumental with soft strings" --provider minimax=music-2.6 --instrumental
bun as music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-clip-preview

# video generation
bun as video "a cinematic mountain sunrise" --provider gemini=veo-3.1-lite-generate-preview

# video generation with multiple providers
bun as video "a timelapse storm over downtown chicago" --provider gemini=veo-3.1-lite-generate-preview --provider runway=gen4.5
```

## Command Map

- `metadata`: [metadata](./commands/setup-and-utilities/metadata/metadata.md)
- `setup` / model pre-downloads: [setup](./commands/process-steps/step-0-setup/setup.md)
- `cache`: [cache](./commands/setup-and-utilities/cache/cache.md)
- `sock`: [sock](./commands/setup-and-utilities/sock/sock.md)
- `download`: [download](./commands/process-steps/step-1-download/download-file.md)
- `extract`: [extract](./commands/process-steps/step-2-extract/01-extract.md) — routes media to STT, documents/images to OCR, article HTML to URL extraction, and X/Twitter Space or post links to the X API.
- `resume`: [resume](./commands/setup-and-utilities/resume/resume.md)
- `write`: [command](./commands/process-steps/step-3-write/write-text.md) | [setup](./commands/process-steps/step-3-write/write-text.md#setup)
- `tts`: [command](./commands/process-steps/step-4-tts/text-to-speech.md) | [setup](./commands/process-steps/step-4-tts/text-to-speech.md#setup)
- `image`: [command](./commands/process-steps/step-5-image/text-to-image.md) | [setup](./commands/process-steps/step-5-image/text-to-image.md#setup)
- `video`: [video](./commands/process-steps/step-6-video/text-to-video-services.md)
- `music`: [music](./commands/process-steps/step-7-music/text-to-music-services.md)
- `comic`: [comic](./commands/process-steps/step-8-comic/comic.md)
- `config`: [config](./commands/setup-and-utilities/config/config.md)
- `links`: [links](./commands/setup-and-utilities/links/links.md)
- `benchmark`: [benchmark](./commands/setup-and-utilities/benchmark/benchmark.md)

## Selection Guide

- Use `metadata` for quick metadata inspection without downloading.
- Use `sock` for a read-only dependency inventory plus Socket package score, scan, and upgrade/security guidance reports.
- Use `download` for downloading media/documents and collecting metadata.
- Use `extract` when you only need step-2 extraction or transcription without LLM writing, or to collect X Space metadata.
- Use `resume` to backfill missing media transcription or document OCR providers in an existing output directory, including `extract` parent batches.
- Use `write` for full summary pipeline with optional TTS/image/video generation, and for lyric draft generation from `./output/<name>/text`.
- Use `music --audio` or `music --batch` for lyric-video rendering from repo audio under `input/`.
- Use standalone `tts`, `image`, `music`, and `video` commands for direct generation workflows.
- Use `comic` for staged or complete episode-script to comic workflows: scene drafting, character sketch references, panel prompt bundles, review sketches, final panel images, and grouped page images.

## Pricing Preflight

Most hosted or mixed-provider runtime commands support `--price` to print estimated cost and exit. The human `Cost Estimate` table is intentionally compact and always uses `step`, `provider`, `model`, and `cost` columns; the `--json` dry-run result keeps the structured pricing basis fields such as token counts, page counts, character counts, and registry rates. `music --audio` and `music --batch` are local lyric-video modes and reject `--price`:

```bash
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider elevenlabs=scribe_v2 --price
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3-turbo --price
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto --price
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3 --price
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq=whisper-large-v3 --price
bun as extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text --price
bun as extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct --price
bun as extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6 --price
bun as extract https://example.com/article --all-providers --price
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5 --price
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm glm=glm-5.1 --price
bun as write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm kimi=kimi-k2.6 --price
bun as write ./output/demo/text --price
bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --price
bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3 --price
bun as tts input/examples/tts/1-tts.md --provider groq=canopylabs/orpheus-v1-english --price
bun as tts input/examples/tts/1-tts.md --provider grok=grok-tts --price
bun as tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --price
bun as tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --price
bun as tts input/examples/tts/1-tts.md --provider hume=octave-2 --price
bun as tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5 --price
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --price
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --tts-instructions "Warm documentary narration" --tts-speed 1.1 --price
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123 --price
bun as image "a sunset" --provider openai=gpt-image-2 --size 1024x1024 --quality low --price
bun as image "a sunset" --provider bfl=flux-2-pro --price
bun as image "a sunset" --provider reve=latest --price
bun as music "an ambient piano instrumental" --provider minimax=music-2.6 --instrumental --price
bun as music "an ambient piano instrumental" --provider minimax=music-2.6-free --instrumental --price
bun as music "an ambient piano instrumental" --provider gemini=lyria-3-pro-preview --duration 120 --price
bun as video "a sunset timelapse" --provider gemini=veo-3.1-lite-generate-preview --price
bun as video "a sunset timelapse" --provider minimax=MiniMax-Hailuo-2.3 --price
bun as video "a sunset timelapse" --provider glm=cogvideox-3 --price
bun as video "a sunset timelapse" --provider grok=grok-imagine-video --price
bun as video "a sunset timelapse" --provider runway=gen4.5 --duration 5 --price
bun as video "a sunset timelapse" --all-providers --price
bun as comic generate-images 02-01 --target images --panels 1-16 --price
bun as comic draft-scenes input/episode-scripts/02-script/01-co-work-smarter.md --price
bun as comic generate-images input/episode-scripts/02-script/01-co-work-smarter.md --target images --price
bun as comic character-sketch --image input/characters/01-peaches.webp --price
```

Pricing preflight uses the same model registry and pricing helpers as post-run cost accounting. Token-priced hosted OCR and write estimates use provider/model input and output rates plus command-specific input heuristics; URL article estimates use the selected backend, or every backend when route-aware `--all-providers` is set. MiniMax music estimates include the zero-cost `music-2.6-free` track estimate and any generated-lyrics add-on. Happy Scribe preflight is side-effect free and uses the published AI rate; Supadata STT estimates use the Basic/Pro auto-recharge credit reference rate, with plan-pricing variance possible.
