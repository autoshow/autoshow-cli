# resume

Backfill missing provider outputs in an existing run, child batch, or parent `extract` batch directory.

## Usage

```bash
bun as resume <output-dir> [flags]
```

`resume` does not accept a new source input. It only works against an existing output directory containing one of:

- `run.json` for a single run
- `batch.json` for a batch
- `extract-batch.json` for an `extract` parent batch

## Target Resolution

- `resume` supports `extract`, TTS, image, video, and music manifests.
- With no provider flags, it uses the original `requestedProviders` stored in the manifest and reruns only missing or failed outputs.
- Explicit provider flags are additive: selected provider/models are appended to the stored request set and skipped if they already succeeded.
- Parent `extract` batch resumes route STT selections to `media/` children, OCR selections to `document/` children, and URL selections to article/X-Space children.
- Generation resumes require recent manifests with `requestedProviders` and `input` fields.

## Provider Selection

Use the target-aware generic selector:

| Flag | Description |
|------|-------------|
| `--provider provider[=model]` | Add one provider/model for the resolved target kind |
| `--all-providers` | Add every supported provider/model for the resolved target kind or extract route |

`--provider` is repeatable. For `extract` resumes, the target route decides whether a provider name maps to STT, OCR, or URL article extraction.

Examples of provider names:

| Target | Provider names |
|--------|----------------|
| STT extract | `whisper`, `reverb`, `deepinfra`, `elevenlabs`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `openai`, `gemini`, `glm`, `together` |
| OCR extract | `tesseract`, `ocrmypdf`, `paddle`, `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`, `unstructured` |
| URL extract | `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte` |
| TTS | `kitten`, `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia` |
| Image | `gemini`, `openai`, `grok`, `bfl`, `reve` |
| Video | `gemini`, `minimax`, `glm`, `grok`, `runway` |
| Music | `elevenlabs`, `minimax`, `gemini` |

## Examples

```bash
# Resume a single run directory in place
bun as resume ./output/2026-04-22_12-00-00-000_item

# Resume a batch directory or extract parent batch in place
bun as resume ./output/2026-04-22_12-00-00-000_batch

# Retry or append route-aware extract providers
bun as resume ./output/2026-04-22_12-00-00-000_batch --provider glm=glm-ocr
bun as resume ./output/2026-04-22_12-00-00-000_batch --provider kimi=kimi-k2.6
bun as resume ./output/2026-04-22_12-00-00-000_batch --provider deepgram=nova-3
bun as resume ./output/2026-04-22_12-00-00-000_batch --provider deepinfra
bun as resume ./output/2026-04-22_12-00-00-000_batch --provider happyscribe=auto --happyscribe-organization-id org_123

# Retry or append TTS providers
bun as resume ./output/2026-04-22_12-00-00-000_run --provider elevenlabs=eleven_v3
bun as resume ./output/2026-04-22_12-00-00-000_run --provider openai=gpt-4o-mini-tts --tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123
bun as resume ./output/2026-04-22_12-00-00-000_run --provider hume=octave-2 --tts-voice "Male English Actor"
bun as resume ./output/2026-04-22_12-00-00-000_run --provider cartesia=sonic-3.5 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02

# Retry or append image, video, and music providers
bun as resume ./output/2026-04-22_12-00-00-000_run --provider gemini=gemini-3.1-flash-image-preview
bun as resume ./output/2026-04-22_12-00-00-000_run --provider reve=latest
bun as resume ./output/2026-04-22_12-00-00-000_run --provider runway=gen4.5
bun as resume ./output/2026-04-22_12-00-00-000_run --provider minimax=music-2.6
bun as resume ./output/2026-04-22_12-00-00-000_run --provider gemini=lyria-3-clip-preview

# Add every supported provider for the resolved target
bun as resume ./output/2026-04-22_12-00-00-000_run --all-providers
```

## Shared Flags

| Flag | Description |
|------|-------------|
| `--prompt <name...>` | Named prompt presets discovered under `src/prompts/entries/` |
| `--prompt-md` | Save a second prompt file with Markdown examples when a resumed path rebuilds prompt output |
| `--batch-concurrency <n>` | Number of batch items to process concurrently |
| `--provider-concurrency <n>` | Max hosted providers/models running in parallel for one item |
| `--local-concurrency <n>` | Max local providers/models running in parallel for one item |

## Extract Options

| Flag | Description |
|------|-------------|
| `--youtube-captions` | Prefer English YouTube captions before STT when available |
| `--reverb-verbatimicity <0-1>` | Reverb output style |
| `--happyscribe-organization-id <id>` | Happy Scribe organization/workspace ID override |
| `--supadata-lang <code>` | Supadata preferred transcript language |
| `--scrapecreators-lang <code>` | ScrapeCreators transcript language; defaults to `en` |
| `--speaker-count <n>` | Diarization speaker-count hint |
| `--split` | Split audio into 30-minute segments before transcription |
| `--refresh-cache` | Rebuild STT cache entries touched by this run |
| `--no-cache` | Bypass the media cache for this run |
| `--format <format>` | OCR output format: `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--ocr-language <codes>` | Tesseract language codes such as `eng` or `eng+fra` |
| `--ocr-dpi <n>` | Render DPI for OCR pages |
| `--tesseract-psm <n>` | Tesseract page segmentation mode |
| `--tesseract-oem <n>` | Tesseract OCR engine mode |
| `--ocr-page-separator <text>` | Custom page separator string |
| `--tesseract-preserve-spaces` | Enable Tesseract `preserve_interword_spaces=1` |
| `--ocr-rotate <degrees>` | Rotate pages before OCR |
| `--chapters` | Write EPUB/PDF chapter files when rebuilding extraction artifacts |
| `--length <thousands>` | Hard export limit in thousands of characters for EPUB/PDF chunking |
| `--pdf-chapter-mode <mode>` | PDF chapter detection mode: `local`, `auto`, or `llm` |
| `--epub-bun` | Inspect EPUB structure with the Bun parser |

## TTS Options

Resume accepts generic TTS options plus provider-specific tuning flags that do not have generic equivalents.

| Flag | Description |
|------|-------------|
| `--tts-voice <provider=value|value>` | Generic TTS voice selector |
| `--tts-speed <provider=value|value>` | Generic TTS speed |
| `--tts-language <provider=value|value>` | Generic TTS language |
| `--tts-ref-audio <provider=path|path>` | Generic TTS reference audio path |
| `--tts-voice-name <provider=value|value>` | Generic created/saved voice label |
| `--tts-consent-audio <provider=path|path>` | Generic consent recording audio path |
| `--tts-consent-language <provider=value|value>` | Generic consent recording language |
| `--tts-consent-name <provider=value|value>` | Generic consent recording name |
| `--tts-consent-email <provider=value|value>` | Generic consent email |
| `--tts-text-normalization <provider=value|value>` | Generic text normalization |
| `--tts-instructions <provider=value|value>` | Generic voice/style instructions |
| `--tts-output-format <provider=value|value>` | Generic output format |

Provider-specific tuning flags include `--openai-tts-consent-id`, `--gemini-speaker-*`, public ElevenLabs/MiniMax/Deepgram TTS tuning flags, `--speechify-tts-voice-locale`, `--speechify-tts-voice-gender`, and `--hume-tts-voice-provider`.

## Image, Video, And Music Options

Resume keeps the pipeline/config option names for media generation options:

| Target | Option flags |
|--------|--------------|
| Image | `--image-aspect-ratio`, `--image-size`, `--image-quality`, `--image-format`, `--image-background`, `--image-count`, `--image-input`, `--image-mask`, `--image-response-mode`, `--gemini-search-grounding`, `--image-compression` |
| Video | `--video-mode`, `--video-duration`, `--video-size`, `--video-aspect-ratio`, `--video-resolution`, `--video-input-image`, `--video-last-frame`, `--video-reference-image`, `--video-input-video`, `--grok-video-storage-filename`, `--grok-video-storage-expires-after` |
| Music | `--music-duration`, `--music-lyrics-file`, `--music-instrumental` |

## Notes

- `resume` updates the existing output directory in place.
- `resume` does not define `--price`.
- Legacy suffixed resume selector aliases are no longer accepted. Use `--provider provider[=model]` or `--all-providers`.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.
