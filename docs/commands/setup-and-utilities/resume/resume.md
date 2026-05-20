# resume

Backfill missing provider outputs in an existing run, child batch, or parent `extract` batch directory.

## Outline

- [Usage](#usage)
- [Target Resolution](#target-resolution)
- [Provider Selection](#provider-selection)
- [Examples](#examples)
- [Flags](#flags)
  - [Shared](#shared)
  - [STT](#stt)
  - [OCR](#ocr)
  - [TTS](#tts)
  - [Image](#image)
  - [Video](#video)
  - [Music](#music)
- [Notes](#notes)

## Usage

```bash
bun as resume <output-dir> [flags]
```

`resume` does not accept a new source input. It only works against an existing output directory.

`<output-dir>` is required and can point at either:

- a single run directory containing `run.json`
- a batch directory containing `batch.json`
- an `extract` parent batch directory containing `extract-batch.json`

## Target Resolution

- `resume` supports `extract`, TTS, image, video, and music `run.json` / `batch.json` targets plus parent `extract-batch.json` targets.
- A single-run target must contain `run.json`.
- A batch target must contain `batch.json`.
- An extract parent batch must contain `extract-batch.json`.
- Generation steps (TTS, image, video, music) require `run.json` to contain `requestedProviders` and `input` fields (written automatically by recent versions of the generation commands).

## Provider Selection

- With no provider flags, `resume` uses the original requested providers stored in the manifest and reruns only the missing ones.
- Explicit provider flags are additive: a selected provider/model runs when it was previously missing or failed, or when it was not already requested by the stored run.
- Selected provider/models that already succeeded are skipped, not rerun.
- Stored provider order is preserved in `requestedProviders`; newly selected provider/models are appended in the order selected.
- `extract` media-route runs accept STT provider/runtime flags.
- `extract` document-route runs accept OCR provider/runtime flags.
- TTS, image, video, and music runs accept the same resumable provider/model and control flags as their standalone commands, excluding generation output path and price flags. Omitting explicit provider flags still uses the original requested providers stored in the manifest.
- Image runs accept image provider/option flags.
- Video runs accept video provider/option flags.
- Music runs accept music provider/option flags.
- `extract` parent batches forward explicit STT flags only to routed `media/` child batches and explicit OCR flags only to routed `document/` child batches.
- Public provider aliases are target-aware. For example, `--gcloud chirp3-hd` on a TTS run maps to `--gcloud-tts chirp3-hd`, while `--openai gpt-image-2` on an image run maps to `--openai-image gpt-image-2`. Aliases that do not apply to the resolved target fail with a usage error.

## Examples

```bash
# Resume a single run directory in place
bun as resume ./output/2026-04-22_12-00-00-000_item

# Resume a batch directory in place
bun as resume ./output/2026-04-22_12-00-00-000_batch

# Resume an extract parent batch in place
bun as resume ./output/2026-04-22_12-00-00-000_batch

# Retry missing GLM OCR outputs, or append GLM OCR to that target
bun as resume ./output/2026-04-22_12-00-00-000_batch --glm-ocr glm-ocr

# Retry missing Kimi OCR outputs, or append Kimi OCR to that target
bun as resume ./output/2026-04-22_12-00-00-000_batch --kimi-ocr kimi-k2.6

# Retry missing Deepgram outputs from an extract media batch, or append Deepgram
bun as resume ./output/2026-04-22_12-00-00-000_batch --deepgram-stt nova-3

# Retry missing DeepInfra Whisper outputs, or append DeepInfra
bun as resume ./output/2026-04-22_12-00-00-000_batch --deepinfra-stt

# Retry missing deAPI outputs, or append deAPI
bun as resume ./output/2026-04-22_12-00-00-000_batch --deapi-stt WhisperLargeV3

# Retry missing Happy Scribe outputs, or append Happy Scribe
bun as resume ./output/2026-04-22_12-00-00-000_batch --happyscribe-stt auto --happyscribe-organization-id org_123

# Retry missing ElevenLabs TTS outputs, or append ElevenLabs TTS
bun as resume ./output/2026-04-22_12-00-00-000_run --elevenlabs-tts eleven_v3
bun as resume ./output/2026-04-22_12-00-00-000_run --elevenlabs-tts eleven_v3 --elevenlabs-tts-pvc-voice pvc_voice_123

# Retry missing OpenAI custom voice TTS outputs, or append OpenAI TTS
bun as resume ./output/2026-04-22_12-00-00-000_run --openai-tts gpt-4o-mini-tts --openai-tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123

# Retry missing Hume TTS outputs, or append Hume TTS
bun as resume ./output/2026-04-22_12-00-00-000_run --hume-tts octave-2 --hume-tts-voice "Male English Actor"

# Retry missing Cartesia TTS outputs, or append Cartesia TTS
bun as resume ./output/2026-04-22_12-00-00-000_run --cartesia-tts sonic-3.5 --cartesia-tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02

# Retry missing Gemini image outputs, or append Gemini image
bun as resume ./output/2026-04-22_12-00-00-000_run --gemini-image imagen-4.0-fast-generate-001

# Retry missing deAPI image outputs, or append deAPI image
bun as resume ./output/2026-04-22_12-00-00-000_run --deapi-image Flux1schnell

# Retry missing Reve image outputs, or append Reve image
bun as resume ./output/2026-04-22_12-00-00-000_run --reve-image latest

# Retry missing Runway video outputs, or append Runway video
bun as resume ./output/2026-04-22_12-00-00-000_run --runway-video gen4.5

# Retry missing MiniMax music outputs, or append MiniMax music
bun as resume ./output/2026-04-22_12-00-00-000_run --minimax-music music-2.6

# Retry missing Gemini Lyria music outputs, or append Gemini music
bun as resume ./output/2026-04-22_12-00-00-000_run --gemini-music lyria-3-clip-preview
```

## Flags

### Shared

| Flag | Description |
|------|-------------|
| `--prompt <name...>` | Named prompt presets discovered recursively under `src/prompts/entries/` |
| `--prompt-md` | Save a second prompt file with markdown examples alongside the JSON prompt when a resumed path rebuilds prompt output |
| `--batch-concurrency <n>` | Number of batch items to process concurrently |

### STT

| Flag | Description |
|------|-------------|
| `--all-stt` | Select every supported STT provider/model |
| `--whisper-stt <model>` | Select one or more local Whisper models |
| `--reverb-stt` | Use Reverb instead of Whisper |
| `--youtube-captions` | Prefer English YouTube captions before STT when available |
| `--gcloud-stt <model>` | Select one or more Google Cloud STT models |
| `--aws-stt <model>` | Select one or more AWS Transcribe models |
| `--aws-region <region>` | Override the AWS region used for AWS Transcribe and Textract staging |
| `--aws-bucket <bucket>` | S3 bucket used for temporary AWS Transcribe and Textract staging objects |
| `--elevenlabs-stt <model>` | Select one or more ElevenLabs STT models |
| `--deepgram-stt <model>` | Select one or more Deepgram STT models |
| `--soniox-stt <model>` | Select one or more Soniox STT models |
| `--speechmatics-stt <model>` | Select one or more Speechmatics STT models |
| `--rev-stt <model>` | Select one or more Rev STT models |
| `--groq-stt <model>` | Select one or more Groq STT models |
| `--grok-stt <model>` | Select one or more xAI Grok STT models |
| `--deepinfra-stt <model>` | Select one or more DeepInfra Whisper models |
| `--openai-stt <model>` | Select one or more OpenAI STT models |
| `--gemini-stt <model>` | Select one or more Gemini STT models |
| `--glm-stt <model>` | Select one or more GLM STT models |
| `--together-stt <model>` | Select one or more Together Whisper STT models |
| `--deapi-stt <model>` | Select one or more deAPI STT models |
| `--happyscribe-stt <model>` | Select one or more Happy Scribe STT models |
| `--happyscribe-organization-id <id>` | Happy Scribe organization/workspace ID override |
| `--supadata-stt auto` | Select Supadata STT auto mode |
| `--supadata-lang <code>` | Supadata preferred transcript language |
| `--scrapecreators-stt youtube-transcript` | Select ScrapeCreators YouTube transcript retrieval |
| `--scrapecreators-lang <code>` | ScrapeCreators transcript language; defaults to `en` |
| `--mistral-stt <model>` | Select one or more Mistral STT models |
| `--assemblyai-stt <model>` | Select one or more AssemblyAI STT models |
| `--gladia-stt <model>` | Select one or more Gladia STT models |
| `--speaker-count <n>` | Diarization speaker-count hint for supported services |
| `--split` | Split audio into 30-minute segments before transcription |
| `--stt-provider-concurrency <n>` | Max cloud providers running in parallel for one item |
| `--stt-local-concurrency <n>` | Max local providers running in parallel for one item |
| `--stt-segment-concurrency <n>` | Max split segments in flight per provider |
| `--stt-preflight-concurrency <n>` | Max duration probes running in parallel during preflight |
| `--refresh-cache` | Rebuild STT cache entries touched by this run |
| `--no-cache` | Bypass the media cache for this run |

### OCR

| Flag | Description |
|------|-------------|
| `--all-ocr` | Select every supported OCR engine/provider model |
| `--lang <codes>` | Tesseract language codes such as `eng` or `eng+fra` |
| `--out <format>` | Output format: `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--tesseract-ocr` | Use Tesseract explicitly |
| `--ocrmypdf` | Use OCRmyPDF |
| `--paddle-ocr` | Use PaddleOCR |
| `--mistral-ocr <model>` | Use Mistral OCR; omit the value to use the cheapest supported model |
| `--glm-ocr <model>` | Use GLM OCR; omit the value to use the cheapest supported model |
| `--kimi-ocr <model>` | Use Kimi OCR; omit the value to use `kimi-k2.6` |
| `--openai-ocr <model>` | Use OpenAI OCR; omit the value to use the cheapest supported model |
| `--anthropic-ocr <model>` | Use Anthropic OCR; omit the value to use the cheapest supported model |
| `--gemini-ocr <model>` | Use Gemini OCR; omit the value to use the cheapest supported model |
| `--deepinfra-ocr <model>` | Use DeepInfra OCR; omit the value to use the cheapest supported model |
| `--aws-textract <model>` | Use AWS Textract; omit the value to use the cheapest supported model |
| `--gcloud-docai <model>` | Use Google Cloud Document AI; omit the value to use the cheapest supported model |
| `--dpi <n>` | Render DPI for OCR pages |
| `--psm <n>` | Tesseract page segmentation mode |
| `--oem <n>` | Tesseract OCR engine mode |
| `--page-separator <text>` | Custom page separator string |
| `--preserve-spaces` | Enable Tesseract `preserve_interword_spaces=1` |
| `--rotate <degrees>` | Rotate pages before OCR |
| `--chapters` | Write EPUB/PDF chapter files when the resumed path rebuilds extraction artifacts |
| `--length <thousands>` | Hard export limit in thousands of characters for EPUB/PDF chunking |
| `--pdf-chapter-mode <mode>` | PDF chapter detection mode: `local`, `auto`, or `llm` |
| `--epub-bun` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | Compatibility alias for the Bun EPUB parser |
| `--ocr-provider-concurrency <n>` | Max hosted OCR providers/models running in parallel for one item |
| `--ocr-local-concurrency <n>` | Max local OCR providers running in parallel for one item |

### TTS

Resume supports the full resumable TTS provider/model surface, including Grok, Speechify, Google Cloud, deAPI, voice flags, request-control flags, and `--all-tts`. `--all-tts` is additive during resume: completed stored providers are skipped and newly selected runnable providers are appended.

| Flag | Description |
|------|-------------|
| `--all-tts` | Select the default all-provider TTS target set |
| `--kitten-tts <model>` | Select one or more Kitten TTS models |
| `--elevenlabs-tts <model>` | Select one or more ElevenLabs TTS models |
| `--minimax-tts <model>` | Select one or more MiniMax TTS models |
| `--groq-tts <model>` | Select one or more Groq TTS models |
| `--grok-tts <model>` | Select one or more xAI Grok TTS models |
| `--mistral-tts <model>` | Select one or more Mistral Voxtral TTS models |
| `--openai-tts <model>` | Select one or more OpenAI TTS models |
| `--gemini-tts <model>` | Select one or more Gemini TTS models |
| `--deepgram-tts <model>` | Select one or more Deepgram TTS models |
| `--speechify-tts <model>` | Select one or more Speechify TTS models |
| `--hume-tts <model>` | Select one or more Hume TTS models |
| `--cartesia-tts <model>` | Select one or more Cartesia TTS models |
| `--gcloud-tts <model>` | Select one or more Google Cloud TTS models |
| `--deapi-tts <model>` | Select one or more deAPI TTS models |
| `--tts-provider-concurrency <n>` | Max hosted TTS providers/models running in parallel for one item |
| `--tts-local-concurrency <n>` | Max local TTS providers running in parallel for one item |
| `--kitten-voice <speaker>` | Kitten TTS speaker override |
| `--elevenlabs-voice <id>` | ElevenLabs voice ID override |
| `--elevenlabs-tts-pvc-voice <id>` | Trained ElevenLabs PVC voice ID for resumed synthesis |
| `--elevenlabs-tts-output-format <format>` | ElevenLabs output format |
| `--elevenlabs-tts-language-code <code>` | ElevenLabs language code override |
| `--elevenlabs-tts-stability <0-1>` | ElevenLabs stability |
| `--elevenlabs-tts-similarity-boost <0-1>` | ElevenLabs similarity boost |
| `--elevenlabs-tts-style <0-1>` | ElevenLabs style |
| `--elevenlabs-tts-use-speaker-boost` | Enable ElevenLabs speaker boost |
| `--elevenlabs-tts-speed <n>` | ElevenLabs voice speed |
| `--elevenlabs-tts-seed <n>` | ElevenLabs deterministic seed |
| `--elevenlabs-tts-text-normalization <mode>` | ElevenLabs text normalization mode |
| `--elevenlabs-tts-pronunciation-dictionary-locator <id>` | ElevenLabs pronunciation dictionary locator |
| `--elevenlabs-tts-optimize-streaming-latency <n>` | ElevenLabs streaming latency optimization |
| `--elevenlabs-tts-pvc-*` | ElevenLabs PVC setup flags for sample input, verification, and wait behavior |
| `--elevenlabs-tts-ref-audio <path>` | ElevenLabs IVC reference audio path |
| `--elevenlabs-tts-voice-name <name>` | Created ElevenLabs clone label |
| `--elevenlabs-tts-clone-remove-background-noise` | Enable ElevenLabs IVC background noise removal |
| `--minimax-tts-voice <id>` | MiniMax TTS voice ID override |
| `--minimax-tts-language-boost <mode>` | MiniMax language boost |
| `--minimax-tts-speed <n>` | MiniMax speech speed |
| `--minimax-tts-volume <n>` | MiniMax volume |
| `--minimax-tts-pitch <n>` | MiniMax pitch adjustment |
| `--minimax-tts-emotion <emotion>` | MiniMax emotion |
| `--minimax-tts-english-normalization` | Enable MiniMax English normalization |
| `--minimax-tts-pronunciation <rule>` | MiniMax pronunciation rule |
| `--openai-voice <id>` | OpenAI TTS voice ID override |
| `--openai-tts-instructions <text>` | OpenAI TTS voice/style instructions |
| `--openai-tts-speed <n>` | OpenAI TTS speed |
| `--openai-tts-ref-audio <path>` | OpenAI custom voice sample audio path |
| `--openai-tts-consent-id <id>` | Existing OpenAI consent recording ID |
| `--openai-tts-consent-audio <path>` | OpenAI consent recording audio path to upload |
| `--openai-tts-consent-language <tag>` | Consent recording language tag; default `en-US` |
| `--openai-tts-consent-name <name>` | Consent recording label |
| `--openai-tts-voice-name <name>` | Created OpenAI custom voice label |
| `--gemini-voice <name>` | Gemini TTS voice name override |
| `--deepgram-voice <id>` | Deepgram TTS voice override |
| `--deepgram-tts-encoding <encoding>` | Deepgram output encoding |
| `--deepgram-tts-container <container>` | Deepgram output container |
| `--deepgram-tts-bit-rate <bps>` | Deepgram bit rate |
| `--deepgram-tts-sample-rate <hz>` | Deepgram sample rate |
| `--deepgram-tts-speed <n>` | Deepgram voice speed |
| `--speechify-voice <id>` | Speechify voice ID override |
| `--speechify-tts-audio-format <format>` | Speechify audio format |
| `--speechify-tts-language <tag>` | Speechify language hint |
| `--speechify-tts-ref-audio <path>` | Speechify custom voice reference audio |
| `--speechify-tts-voice-*` | Speechify custom voice label, locale, and gender flags |
| `--speechify-tts-consent-*` | Speechify custom voice consent flags |
| `--hume-tts-voice <name-or-id>` | Hume voice name or ID override |
| `--hume-tts-voice-provider <provider>` | Hume named voice provider, `HUME_AI` or `CUSTOM_VOICE` |
| `--cartesia-tts-voice <id>` | Cartesia voice ID override |
| `--cartesia-tts-language <code>` | Cartesia language code override |
| `--gcloud-tts-voice <name>` | Google Cloud TTS voice name |
| `--gcloud-tts-language <tag>` | Google Cloud TTS language tag |
| `--gcloud-tts-ref-audio <path>` | Google Cloud instant custom voice reference audio |
| `--gcloud-tts-consent-audio <path>` | Google Cloud instant custom voice consent audio |
| `--gcloud-tts-consent-language <tag>` | Google Cloud instant custom voice consent language |
| `--gcloud-tts-voice-cloning-key <key>` | Google Cloud instant custom voice cloning key |
| `--gcloud-tts-voice-cloning-key-out <path>` | Write generated Google Cloud voice cloning key |
| `--deapi-tts-voice <id>` | deAPI voice override |
| `--deapi-tts-ref-audio <path>` | deAPI voice clone reference audio |
| `--deapi-tts-ref-text <text>` | deAPI reference audio transcript |
| `--deapi-tts-language <language>` | deAPI language override |
| `--deapi-tts-speed <n>` | deAPI speech speed |
| `--deapi-tts-format <format>` | deAPI output format |
| `--deapi-tts-sample-rate <hz>` | deAPI output sample rate |
| `--deapi-tts-instruction <text>` | deAPI voice-design instruction |
| `--groq-voice <id>` | Groq TTS voice ID override |
| `--grok-tts-voice <id>` | Grok TTS voice override |
| `--grok-tts-language <code>` | Grok TTS language code |
| `--grok-tts-text-normalization` | Enable Grok TTS text normalization |
| `--mistral-tts-voice <id>` | Mistral saved/custom voice ID |
| `--mistral-tts-ref-audio <path>` | Mistral one-off voice clone reference audio path |
| `--mistral-tts-voice-name <name>` | Mistral saved voice name |
| `--tts-dialogue-format <mode>` | Dialogue input format |
| `--tts-speaker-ref-audio <speaker=path>` | Speaker reference audio mapping |
| `--gemini-speaker-1-name <name>` | Gemini multispeaker speaker 1 name |
| `--gemini-speaker-1-voice <voice>` | Gemini multispeaker speaker 1 voice |
| `--gemini-speaker-2-name <name>` | Gemini multispeaker speaker 2 name |
| `--gemini-speaker-2-voice <voice>` | Gemini multispeaker speaker 2 voice |

### Image

| Flag | Description |
|------|-------------|
| `--all-image` | Select every supported image provider/model |
| `--gemini-image <model>` | Select one or more Gemini image models |
| `--openai-image <model>` | Select one or more OpenAI image models |
| `--minimax-image <model>` | Select one or more MiniMax image models |
| `--grok-image <model>` | Select one or more Grok image models |
| `--runway-image <model>` | Select one or more Runway image models |
| `--bfl-image <model>` | Select one or more BFL image models |
| `--deapi-image <model>` | Select one or more deAPI image models |
| `--reve-image <model>` | Select one or more Reve image models |
| `--image-aspect-ratio <ratio>` | Image aspect ratio |
| `--image-size <size>` | Image size/resolution |
| `--image-quality <quality>` | Image quality (OpenAI) |
| `--image-format <format>` | Image output format (OpenAI/BFL/Reve) |
| `--image-background <bg>` | Image background (OpenAI) |
| `--image-count <n>` | Number of images to generate in one supported provider request |
| `--image-input <path-or-url>` | Reference/source image for image edits or provider references |
| `--image-mask <path>` | Mask image for OpenAI image edits |
| `--image-response-mode <image\|text-image>` | Native Gemini response mode |
| `--gemini-person-generation <mode>` | Gemini Imagen person generation mode |
| `--gemini-search-grounding` | Enable Gemini native image search grounding |
| `--image-compression <0-100>` | OpenAI JPEG/WebP output compression |
| `--image-provider-concurrency <n>` | Max hosted image providers/models running in parallel for one item |
| `--image-local-concurrency <n>` | Max local image providers running in parallel for one item |

### Video

| Flag | Description |
|------|-------------|
| `--all-video` | Select every supported video provider/model |
| `--gemini-video <model>` | Select one or more Gemini video models |
| `--minimax-video <model>` | Select one or more MiniMax video models |
| `--glm-video <model>` | Select one or more GLM video models |
| `--grok-video <model>` | Select one or more Grok video models |
| `--runway-video <model>` | Select one or more Runway video models |
| `--deapi-video <model>` | Select one or more deAPI video models |
| `--video-duration <seconds>` | Video duration in seconds |
| `--video-mode <mode>` | Video generation mode |
| `--video-size <size>` | Video size |
| `--video-aspect-ratio <ratio>` | Video aspect ratio |
| `--video-resolution <res>` | Video resolution (Gemini) |
| `--video-input-image <path-or-url>` | Input image for image-to-video and interpolation |
| `--video-last-frame <path-or-url>` | Last-frame image for interpolation |
| `--video-reference-image <path-or-url>` | Reference image for reference-to-video |
| `--video-input-video <path-or-url>` | Input video for extension or editing |
| `--grok-video-storage-filename <name>` | Grok video storage filename |
| `--grok-video-storage-expires-after <seconds>` | Grok video storage expiration |
| `--video-provider-concurrency <n>` | Max hosted video providers/models running in parallel for one item |
| `--video-local-concurrency <n>` | Max local video providers running in parallel for one item |

### Music

| Flag | Description |
|------|-------------|
| `--all-music` | Select every supported hosted music provider/model |
| `--elevenlabs-music <model>` | Select one or more ElevenLabs music models |
| `--minimax-music <model>` | Select one or more MiniMax music models |
| `--deapi-music <model>` | Select one or more deAPI music models |
| `--gemini-music <model>` | Select one or more Gemini Lyria music models |
| `--music-duration <seconds>` | Music duration in seconds |
| `--music-lyrics-file <path>` | Lyrics file path for MiniMax, deAPI, and Gemini |
| `--music-instrumental` | Force instrumental generation where supported |
| `--music-provider-concurrency <n>` | Max hosted music providers/models running in parallel for one item |
| `--music-local-concurrency <n>` | Max local music providers running in parallel for one item |

## Notes

- `resume` updates the existing output directory in place.
- Extract media and document child batch resumes rewrite the existing `batch.json` with updated per-item status.
- Extract parent batch resumes update `extract-batch.json` at the parent and the routed child `media/batch.json` and `document/batch.json` manifests underneath it.
- Generation step resumes (TTS, image, video, music) rewrite `run.json` with merged metadata from existing and newly produced provider outputs.
- Generation step resumes require `run.json` to contain `requestedProviders` and `input` fields. Manifests created before resume support was added cannot be resumed.
- Async STT providers with checkpointed remote jobs, including deAPI and Happy Scribe, reuse saved provider state when possible instead of recreating the remote request.
- `resume` does not define `--price`.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.
