# resume

Backfill missing provider outputs in an existing run, child batch, or parent `extract` batch directory.

## Outline

- [Usage](#usage)
- [Target Discovery](#target-discovery)
- [Provider Selection](#provider-selection)
- [Examples](#examples)
- [Flags](#flags)
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

- `resume` supports STT, OCR, TTS, image, video, and music `run.json` / `batch.json` targets plus parent `extract-batch.json` targets.
- A single-run target must contain `run.json`.
- A batch target must contain `batch.json`.
- An extract parent batch must contain `extract-batch.json`.
- Auto-discovery only considers targets that still have missing provider work to backfill.
- Generation steps (TTS, image, video, music) require `run.json` to contain `requestedProviders` and `input` fields (written automatically by recent versions of the generation commands).

## Provider Selection

- With no provider flags, `resume` uses the original requested providers stored in the manifest and reruns only the missing ones.
- Explicit provider flags narrow the rerun set, but they must be a subset of the original requested providers for that run or batch.
- STT runs accept STT provider/runtime flags.
- OCR runs accept OCR provider/runtime flags.
- TTS runs accept TTS provider/voice flags.
- Image runs accept image provider/option flags.
- Video runs accept video provider/option flags.
- Music runs accept music provider/option flags.
- `extract` parent batches forward explicit STT flags only to routed STT child batches and explicit OCR flags only to routed OCR child batches.

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

# Resume only Deepgram outputs from an STT batch
bun as resume ./output/2026-04-22_12-00-00-000_batch --deepgram-stt nova-3

# Resume only DeepInfra Whisper outputs from an STT batch
bun as resume ./output/2026-04-22_12-00-00-000_batch --deepinfra-stt

# Resume only deAPI outputs from an STT batch
bun as resume ./output/2026-04-22_12-00-00-000_batch --deapi-stt WhisperLargeV3

# Resume only Happy Scribe outputs from an STT batch
bun as resume ./output/2026-04-22_12-00-00-000_batch --happyscribe-stt auto --happyscribe-organization-id org_123

# Resume missing ElevenLabs TTS outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --elevenlabs-tts eleven_v3

# Resume missing Gemini image outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --gemini-image imagen-4.0-fast-generate-001

# Resume missing deAPI image outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --deapi-image Flux1schnell

# Resume missing Runway video outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --runway-video gen4.5

# Resume missing deAPI video outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --deapi-video Ltxv_13B_0_9_8_Distilled_FP8

# Resume missing MiniMax music outputs
bun as resume ./output/2026-04-22_12-00-00-000_run --minimax-music music-2.5
```

## Flags

### Shared

| Flag | Description |
|------|-------------|
| `--prompt <name...>` | Named prompt presets discovered recursively under `src/prompts/entries/` |
| `--batch-concurrency <n>` | Number of batch items to process concurrently |

### STT

| Flag | Description |
|------|-------------|
| `--whisper <model>` | Select one or more local Whisper models |
| `--reverb` | Use Reverb instead of Whisper |
| `--youtube-captions` | Prefer English YouTube captions before STT when available |
| `--gcloud-stt <model>` | Select one or more Google Cloud STT models |
| `--aws-stt <model>` | Select one or more AWS Transcribe models |
| `--aws-region <region>` | Override the AWS CLI region used for AWS Transcribe jobs |
| `--aws-bucket <bucket>` | S3 bucket used for temporary AWS Transcribe input/output objects |
| `--elevenlabs-stt <model>` | Select one or more ElevenLabs STT models |
| `--deepgram-stt <model>` | Select one or more Deepgram STT models |
| `--soniox-stt <model>` | Select one or more Soniox STT models |
| `--speechmatics-stt <model>` | Select one or more Speechmatics STT models |
| `--rev-stt <model>` | Select one or more Rev STT models |
| `--groq-stt <model>` | Select one or more Groq STT models |
| `--deepinfra-stt <model>` | Select one or more DeepInfra Whisper models |
| `--openai-stt <model>` | Select one or more OpenAI STT models |
| `--gemini-stt <model>` | Select one or more Gemini STT models |
| `--glm-stt <model>` | Select one or more GLM STT models |
| `--deapi-stt <model>` | Select one or more deAPI STT models |
| `--happyscribe-stt <model>` | Select one or more Happy Scribe STT models |
| `--happyscribe-organization-id <id>` | Happy Scribe organization/workspace ID override |
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
| `--tesseract` | Use Tesseract explicitly |
| `--ocrmypdf` | Use OCRmyPDF |
| `--paddle-ocr` | Use PaddleOCR |
| `--mistral-ocr <model>` | Use Mistral OCR; omit the value to use the cheapest supported model |
| `--glm-ocr <model>` | Use GLM OCR; omit the value to use the cheapest supported model |
| `--openai-ocr <model>` | Use OpenAI OCR; omit the value to use the cheapest supported model |
| `--anthropic-ocr <model>` | Use Anthropic OCR; omit the value to use the cheapest supported model |
| `--gemini-ocr <model>` | Use Gemini OCR; omit the value to use the cheapest supported model |
| `--dpi <n>` | Render DPI for OCR pages |
| `--psm <n>` | Tesseract page segmentation mode |
| `--oem <n>` | Tesseract OCR engine mode |
| `--page-separator <text>` | Custom page separator string |
| `--preserve-spaces` | Enable Tesseract `preserve_interword_spaces=1` |
| `--rotate <degrees>` | Rotate pages before OCR |
| `--epub-bun` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | Inspect EPUB structure with Calibre |

### TTS

| Flag | Description |
|------|-------------|
| `--kitten-tts <model>` | Select one or more Kitten TTS models |
| `--elevenlabs-tts <model>` | Select one or more ElevenLabs TTS models |
| `--minimax-tts <model>` | Select one or more MiniMax TTS models |
| `--groq-tts <model>` | Select one or more Groq TTS models |
| `--openai-tts <model>` | Select one or more OpenAI TTS models |
| `--gemini-tts <model>` | Select one or more Gemini TTS models |
| `--deepgram-tts <model>` | Select one or more Deepgram TTS models |
| `--kitten-voice <speaker>` | Kitten TTS speaker override |
| `--elevenlabs-voice <id>` | ElevenLabs voice ID override |
| `--minimax-tts-voice <id>` | MiniMax TTS voice ID override |
| `--openai-voice <id>` | OpenAI TTS voice ID override |
| `--gemini-voice <name>` | Gemini TTS voice name override |
| `--deepgram-voice <id>` | Deepgram TTS voice override |
| `--groq-voice <id>` | Groq TTS voice ID override |

### Image

| Flag | Description |
|------|-------------|
| `--gemini-image <model>` | Select one or more Gemini image models |
| `--openai-image <model>` | Select one or more OpenAI image models |
| `--minimax-image <model>` | Select one or more MiniMax image models |
| `--glm-image <model>` | Select one or more GLM image models |
| `--grok-image <model>` | Select one or more Grok image models |
| `--runway-image <model>` | Select one or more Runway image models |
| `--deapi-image <model>` | Select one or more deAPI image models |
| `--image-aspect-ratio <ratio>` | Image aspect ratio |
| `--image-size <size>` | Image size/resolution |
| `--image-quality <quality>` | Image quality (OpenAI) |
| `--image-format <format>` | Image output format (OpenAI) |
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
| `--deapi-video <model>` | Select one or more deAPI video models |
| `--video-duration <seconds>` | Video duration in seconds |
| `--video-size <size>` | Video size |
| `--video-aspect-ratio <ratio>` | Video aspect ratio |
| `--video-resolution <res>` | Video resolution (Gemini) |

### Music

| Flag | Description |
|------|-------------|
| `--elevenlabs-music <model>` | Select one or more ElevenLabs music models |
| `--minimax-music <model>` | Select one or more MiniMax music models |
| `--music-duration <seconds>` | Music duration in seconds |
| `--music-lyrics-file <path>` | Lyrics file path for MiniMax |
| `--music-instrumental` | Force instrumental generation (ElevenLabs) |

## Notes

- `resume` updates the existing output directory in place.
- STT and OCR batch resumes rewrite the existing `batch.json` with updated per-item status.
- Extract batch resumes update `extract-batch.json` at the parent and the routed child `stt/batch.json` and `ocr/batch.json` manifests underneath it.
- Generation step resumes (TTS, image, video, music) rewrite `run.json` with merged metadata from existing and newly produced provider outputs.
- Generation step resumes require `run.json` to contain `requestedProviders` and `input` fields. Manifests created before resume support was added cannot be resumed.
- Async STT providers with checkpointed remote jobs, including deAPI and Happy Scribe, reuse saved provider state when possible instead of recreating the remote request.
- `resume` does not define `--price`.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.
