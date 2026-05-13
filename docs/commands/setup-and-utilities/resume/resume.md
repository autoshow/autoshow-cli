# resume

Backfill missing provider outputs in an existing run, child batch, or parent `extract` batch directory.

## Outline

- [Usage](#usage)
- [Target Discovery](#target-discovery)
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
bun as resume [output-dir] [flags]
```

`resume` does not accept a new source input. It only works against an existing output directory.

`[output-dir]` can point at either:

- a single run directory containing `run.json`
- a batch directory containing `batch.json`
- an `extract` parent batch directory containing `extract-batch.json`

If you omit `[output-dir]`, `resume` scans `./output` newest-first and picks the first resumable target it finds.

## Target Discovery

- `resume` supports `extract`, TTS, image, video, and music `run.json` / `batch.json` targets plus parent `extract-batch.json` targets.
- A single-run target must contain `run.json`.
- A batch target must contain `batch.json`.
- An extract parent batch must contain `extract-batch.json`.
- Auto-discovery only considers targets that still have missing provider work to backfill.
- Generation steps (TTS, image, video, music) require `run.json` to contain `requestedProviders` and `input` fields (written automatically by recent versions of the generation commands).

## Provider Selection

- With no provider flags, `resume` uses the original requested providers stored in the manifest and reruns only the missing ones.
- Explicit provider flags narrow the rerun set, but they must be a subset of the original requested providers for that run or batch.
- `extract` media-route runs accept STT provider/runtime flags.
- `extract` document-route runs accept OCR provider/runtime flags.
- TTS runs accept TTS provider/voice flags.
- Image runs accept image provider/option flags.
- Video runs accept video provider/option flags.
- Music runs accept music provider/option flags.
- `extract` parent batches forward explicit STT flags only to routed `media/` child batches and explicit OCR flags only to routed `document/` child batches.

## Examples

```bash
# Resume the newest incomplete output under ./output
bun as resume

# Resume a single run directory in place
bun as resume ./output/2026-04-22_12-00-00-000_item

# Resume a batch directory in place
bun as resume ./output/2026-04-22_12-00-00-000_batch

# Resume an extract parent batch in place
bun as resume ./output/2026-04-22_12-00-00-000_batch

# Resume only missing GLM OCR outputs in that target
bun as resume ./output/2026-04-22_12-00-00-000_batch --glm-ocr glm-ocr

# Resume only missing Kimi OCR outputs in that target
bun as resume ./output/2026-04-22_12-00-00-000_batch --kimi-ocr kimi-k2.6

# Resume only Deepgram outputs from an extract media batch
bun as resume ./output/2026-04-22_12-00-00-000_batch --deepgram-stt nova-3

# Resume only DeepInfra Whisper outputs from an extract media batch
bun as resume ./output/2026-04-22_12-00-00-000_batch --deepinfra-stt

# Resume only deAPI outputs from an extract media batch
bun as resume ./output/2026-04-22_12-00-00-000_batch --deapi-stt WhisperLargeV3

# Resume only Happy Scribe outputs from an extract media batch
bun as resume ./output/2026-04-22_12-00-00-000_batch --happyscribe-stt auto --happyscribe-organization-id org_123

# Resume missing ElevenLabs TTS outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --elevenlabs-tts eleven_v3
bun as resume ./output/2026-04-22_12-00-00-000_run --elevenlabs-tts eleven_flash_v2_5 --elevenlabs-tts-pvc-voice pvc_voice_123

# Resume missing Runway TTS outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --runway-tts eleven_multilingual_v2

# Resume missing OpenAI custom voice TTS outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --openai-tts gpt-4o-mini-tts --openai-tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123

# Resume missing Gemini image outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --gemini-image imagen-4.0-fast-generate-001

# Resume missing deAPI image outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --deapi-image Flux1schnell

# Resume missing Runway video outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --runway-video gen4.5

# Resume missing MiniMax music outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --minimax-music music-2.5

# Resume missing Gemini Lyria music outputs
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
| `--epub-bun` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | Inspect EPUB structure with Calibre |
| `--ocr-provider-concurrency <n>` | Max hosted OCR providers/models running in parallel for one item |
| `--ocr-local-concurrency <n>` | Max local OCR providers running in parallel for one item |

### TTS

| Flag | Description |
|------|-------------|
| `--kitten-tts <model>` | Select one or more Kitten TTS models |
| `--elevenlabs-tts <model>` | Select one or more ElevenLabs TTS models |
| `--minimax-tts <model>` | Select one or more MiniMax TTS models |
| `--groq-tts <model>` | Select one or more Groq TTS models |
| `--mistral-tts <model>` | Select one or more Mistral Voxtral TTS models |
| `--openai-tts <model>` | Select one or more OpenAI TTS models |
| `--gemini-tts <model>` | Select one or more Gemini TTS models |
| `--deepgram-tts <model>` | Select one or more Deepgram TTS models |
| `--runway-tts <model>` | Select one or more Runway TTS models |
| `--kitten-voice <speaker>` | Kitten TTS speaker override |
| `--elevenlabs-voice <id>` | ElevenLabs voice ID override |
| `--elevenlabs-tts-pvc-voice <id>` | Trained ElevenLabs PVC voice ID for resumed synthesis |
| `--elevenlabs-tts-ref-audio <path>` | ElevenLabs IVC reference audio path |
| `--elevenlabs-tts-voice-name <name>` | Created ElevenLabs clone label |
| `--elevenlabs-tts-clone-remove-background-noise` | Enable ElevenLabs IVC background noise removal |
| `--minimax-tts-voice <id>` | MiniMax TTS voice ID override |
| `--minimax-tts-ref-audio <path>` | MiniMax rapid voice clone source audio path |
| `--minimax-tts-prompt-audio <path>` | Optional MiniMax clone prompt audio path |
| `--minimax-tts-prompt-text <text>` | Transcript for the MiniMax clone prompt audio |
| `--minimax-tts-clone-noise-reduction` | Enable MiniMax clone noise reduction |
| `--minimax-tts-clone-volume-normalization` | Enable MiniMax clone volume normalization |
| `--openai-voice <id>` | OpenAI TTS voice ID override |
| `--openai-tts-ref-audio <path>` | OpenAI custom voice sample audio path |
| `--openai-tts-consent-id <id>` | Existing OpenAI consent recording ID |
| `--openai-tts-consent-audio <path>` | OpenAI consent recording audio path to upload |
| `--openai-tts-consent-language <tag>` | Consent recording language tag; default `en-US` |
| `--openai-tts-consent-name <name>` | Consent recording label |
| `--openai-tts-voice-name <name>` | Created OpenAI custom voice label |
| `--gemini-voice <name>` | Gemini TTS voice name override |
| `--deepgram-voice <id>` | Deepgram TTS voice override |
| `--runway-tts-voice <preset>` | Runway TTS preset voice override |
| `--groq-voice <id>` | Groq TTS voice ID override |
| `--mistral-tts-voice <id>` | Mistral saved/custom voice ID |
| `--mistral-tts-ref-audio <path>` | Mistral one-off voice clone reference audio path |
| `--gemini-speaker-1-name <name>` | Gemini multispeaker speaker 1 name |
| `--gemini-speaker-1-voice <voice>` | Gemini multispeaker speaker 1 voice |
| `--gemini-speaker-2-name <name>` | Gemini multispeaker speaker 2 name |
| `--gemini-speaker-2-voice <voice>` | Gemini multispeaker speaker 2 voice |

### Image

| Flag | Description |
|------|-------------|
| `--gemini-image <model>` | Select one or more Gemini image models |
| `--openai-image <model>` | Select one or more OpenAI image models |
| `--minimax-image <model>` | Select one or more MiniMax image models |
| `--glm-image <model>` | Select one or more GLM image models |
| `--grok-image <model>` | Select one or more Grok image models |
| `--runway-image <model>` | Select one or more Runway image models |
| `--bfl-image <model>` | Select one or more BFL image models |
| `--deapi-image <model>` | Select one or more deAPI image models |
| `--image-aspect-ratio <ratio>` | Image aspect ratio |
| `--image-size <size>` | Image size/resolution |
| `--image-quality <quality>` | Image quality (OpenAI) |
| `--image-format <format>` | Image output format (OpenAI/BFL) |
| `--image-background <bg>` | Image background (OpenAI) |
| `--imagen-count <n>` | Number of images to generate (Imagen 4) |

### Video

| Flag | Description |
|------|-------------|
| `--gemini-video <model>` | Select one or more Gemini video models |
| `--minimax-video <model>` | Select one or more MiniMax video models |
| `--glm-video <model>` | Select one or more GLM video models |
| `--grok-video <model>` | Select one or more Grok video models |
| `--runway-video <model>` | Select one or more Runway video models |
| `--video-duration <seconds>` | Video duration in seconds |
| `--video-size <size>` | Video size |
| `--video-aspect-ratio <ratio>` | Video aspect ratio |
| `--video-resolution <res>` | Video resolution (Gemini) |

### Music

| Flag | Description |
|------|-------------|
| `--elevenlabs-music <model>` | Select one or more ElevenLabs music models |
| `--minimax-music <model>` | Select one or more MiniMax music models |
| `--deapi-music <model>` | Select one or more deAPI music models |
| `--gemini-music <model>` | Select one or more Gemini Lyria music models |
| `--music-duration <seconds>` | Music duration in seconds |
| `--music-lyrics-file <path>` | Lyrics file path for MiniMax, deAPI, and Gemini |
| `--music-instrumental` | Force instrumental generation where supported |

## Notes

- `resume` updates the existing output directory in place.
- Extract media and document child batch resumes rewrite the existing `batch.json` with updated per-item status.
- Extract parent batch resumes update `extract-batch.json` at the parent and the routed child `media/batch.json` and `document/batch.json` manifests underneath it.
- Generation step resumes (TTS, image, video, music) rewrite `run.json` with merged metadata from existing and newly produced provider outputs.
- Generation step resumes require `run.json` to contain `requestedProviders` and `input` fields. Manifests created before resume support was added cannot be resumed.
- Async STT providers with checkpointed remote jobs, including deAPI and Happy Scribe, reuse saved provider state when possible instead of recreating the remote request.
- `resume` does not define `--price`.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.
