# resume

Backfill missing STT or OCR provider outputs in an existing run or batch directory.

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

If you omit `[output-dir]`, `resume` scans `./output` newest-first and picks the first resumable STT or OCR run or batch it finds.

## Target Discovery

- `resume` only supports STT and OCR manifests.
- A single-run target must contain `run.json`.
- A batch target must contain `batch.json`.
- Auto-discovery only considers targets that still have missing provider work to backfill.

## Provider Selection

- With no provider flags, `resume` uses the original requested providers stored in the manifest and reruns only the missing ones.
- Explicit provider flags narrow the rerun set, but they must be a subset of the original requested providers for that run or batch.
- STT runs accept STT provider/runtime flags.
- OCR runs accept OCR provider/runtime flags.

## Examples

```bash
# Resume the newest incomplete STT or OCR output under ./output
bun as resume

# Resume a single run directory in place
bun as resume ./output/2026-04-22_12-00-00-000_item

# Resume a batch directory in place
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
```

## Flags

### Shared

| Flag | Description |
|------|-------------|
| `--prompt <name...>` | Named prompt presets from `src/prompts/entries/*.json` |
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
| `--ocrmypdf` | Use OCRmyPDF |
| `--paddle-ocr` | Use PaddleOCR |
| `--mistral-ocr <model>` | Use Mistral OCR |
| `--glm-ocr <model>` | Use GLM OCR |
| `--openai-ocr <model>` | Use OpenAI OCR |
| `--anthropic-ocr <model>` | Use Anthropic OCR |
| `--gemini-ocr <model>` | Use Gemini OCR |
| `--dpi <n>` | Render DPI for OCR pages |
| `--psm <n>` | Tesseract page segmentation mode |
| `--oem <n>` | Tesseract OCR engine mode |
| `--page-separator <text>` | Custom page separator string |
| `--preserve-spaces` | Enable Tesseract `preserve_interword_spaces=1` |
| `--rotate <degrees>` | Rotate pages before OCR |
| `--epub-bun` | Inspect EPUB structure with the Bun parser |
| `--epub-calibre` | Inspect EPUB structure with Calibre |

## Notes

- `resume` updates the existing output directory in place.
- STT and OCR batch resumes rewrite the existing `batch.json` with updated per-item status.
- Async STT providers with checkpointed remote jobs, including deAPI and Happy Scribe, reuse saved provider state when possible instead of recreating the remote request.
- `resume` does not define `--price`.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.
