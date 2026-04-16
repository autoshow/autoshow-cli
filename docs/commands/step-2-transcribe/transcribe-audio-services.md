# stt (services)

Download audio and transcribe it with the hosted STT providers. Alias: `transcribe`.

## Outline

- [Usage](#usage)
- [Service Engines](#service-engines)
- [Examples](#examples)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun as stt [input] [flags]
bun as stt --resume-missing [batch-dir] [provider flags]
```

The input routing is the same as local `stt`: direct media URLs, streaming URLs, local media files, URL lists, directories, feeds, and YouTube channels are all supported.

## Service Engines

| Engine | Selection | Models |
|--------|-----------|--------|
| Groq Whisper | `--groq-stt <model>` | `whisper-large-v3`, `whisper-large-v3-turbo` |
| ElevenLabs | `--elevenlabs-stt <model>` | `scribe_v2` |
| Deepgram | `--deepgram-stt <model>` | `nova-3` |
| Soniox | `--soniox-stt <model>` | `stt-async-v4`, `stt-async-v3` |
| Speechmatics | `--speechmatics-stt <model>` | `standard`, `enhanced` |
| Rev | `--rev-stt <model>` | `machine` |
| OpenAI | `--openai-stt <model>` | `gpt-4o-transcribe-diarize` |
| Mistral | `--mistral-stt <model>` | `voxtral-mini-latest`, `voxtral-mini-2602` |
| AssemblyAI | `--assemblyai-stt <model>` | `universal-2`, `universal-3-pro` |

You can combine multiple hosted STT provider flags in one execution. Each selected provider writes its own transcript and metadata under `providers/<service>-<model>/`.

## Examples

```bash
# Groq
bun as stt input/examples/audio/1-audio.mp3 --groq-stt whisper-large-v3

# ElevenLabs with diarization
bun as stt input/examples/audio/1-audio.mp3 --elevenlabs-stt scribe_v2

# ElevenLabs with an optional speaker-count hint
bun as stt input/examples/audio/1-audio.mp3 --elevenlabs-stt scribe_v2 --speaker-count 3

# Deepgram with diarization always enabled
bun as stt input/examples/audio/1-audio.mp3 --deepgram-stt nova-3

# Soniox with diarization always enabled
bun as stt input/examples/audio/1-audio.mp3 --soniox-stt stt-async-v4

# Speechmatics with diarization always enabled
bun as stt input/examples/audio/1-audio.mp3 --speechmatics-stt enhanced

# Speechmatics bare flag defaults to enhanced
bun as stt input/examples/audio/1-audio.mp3 --speechmatics-stt

# Rev with diarization always enabled
bun as stt input/examples/audio/1-audio.mp3 --rev-stt machine

# Rev bare flag defaults to machine
bun as stt input/examples/audio/1-audio.mp3 --rev-stt

# OpenAI with known speaker references
bun as stt input/examples/audio/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize \
  --speaker-name Host --speaker-reference clips/host.mp3 \
  --speaker-name Guest --speaker-reference clips/guest.mp3

# Mistral
bun as stt input/examples/audio/1-audio.mp3 --mistral-stt voxtral-mini-2602

# AssemblyAI with diarization
bun as stt input/examples/audio/1-audio.mp3 --assemblyai-stt universal-2

# AssemblyAI with an optional speaker-count hint
bun as stt input/examples/audio/1-audio.mp3 --assemblyai-stt universal-2 --speaker-count 3

# Multi-provider batch
bun as stt input/ajc --batch-all \
  --batch-concurrency 3 \
  --elevenlabs-stt scribe_v2 \
  --deepgram-stt nova-3 \
  --soniox-stt stt-async-v4 \
  --speechmatics-stt enhanced \
  --assemblyai-stt universal-3-pro \
  --mistral-stt voxtral-mini-latest \
  --speaker-count 2

# Resume only the missing provider outputs from an earlier batch
bun as stt --resume-missing output/2026-04-12_22-37-12-852_files

# Resume the newest compatible incomplete STT batch under ./output
bun as stt --resume-missing

# Resume only a subset of the originally requested providers
bun as stt --resume-missing output/2026-04-12_22-37-12-852_files --deepgram-stt nova-3

# Resume only Rev backfill from the newest compatible incomplete STT batch under ./output
bun as stt --resume-missing --rev-stt

# Price preflight
bun as stt input/examples/audio/1-audio.mp3 --openai-stt gpt-4o-transcribe-diarize --price
```

## Flags

| Flag | Description |
|------|-------------|
| `--groq-stt <model>` | Select a Groq Whisper model |
| `--elevenlabs-stt <model>` | Select the ElevenLabs STT model |
| `--deepgram-stt <model>` | Select the Deepgram STT model |
| `--soniox-stt <model>` | Select the Soniox STT model |
| `--speechmatics-stt <model>` | Select the Speechmatics STT model |
| `--rev-stt <model>` | Select the Rev STT model |
| `--openai-stt <model>` | Select the OpenAI STT model |
| `--mistral-stt <model>` | Select the Mistral STT model |
| `--assemblyai-stt <model>` | Select the AssemblyAI STT model |
| `--speaker-count <n>` | Speaker-count hint for providers that support it |
| `--speaker-name <name...>` | OpenAI known speaker names. Repeat in the same order as `--speaker-reference` |
| `--speaker-reference <path...>` | OpenAI known speaker reference clips or data URLs. Repeat in the same order as `--speaker-name` |
| `--prompt <name...>` | Named prompt(s) from `src/prompts/prompts.json` |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |
| `--stt-provider-concurrency <n>` | Per-item cloud provider concurrency upper bound; in multi-item multi-provider batches the scheduler still honors this cap while also limiting each provider/model to one in-flight item at a time |
| `--resume-missing [batch-dir]` | Reuse an existing STT batch directory and rerun only the missing provider outputs. If omitted, the CLI auto-picks the newest compatible resumable batch under `./output` |
| `--price` | Show the aggregated estimate and exit |

## Notes

- Diarization is enabled by default for ElevenLabs, Deepgram, Soniox, Speechmatics, Rev, AssemblyAI, Mistral, and OpenAI diarized STT models.
- ElevenLabs and AssemblyAI use `--speaker-count` as an optional diarization hint.
- Speechmatics always sends `language: "auto"` and `diarization: "speaker"`, so no extra language flag is required and speaker labels use Speechmatics native IDs such as `S1`, `S2`, and `UU`.
- Rev uploads the already-downloaded local file as `multipart/form-data`, always uses the `machine` transcriber with `remove_disfluencies: true`, and deletes the remote job after terminal success or failure.
- Set `REVAI_ACCESS_TOKEN` to enable the provider. `REVAI_BASE_URL` is optional and defaults to `https://api.rev.ai/speechtotext/v1`.
- Set `SPEECHMATICS_API_KEY` to enable the provider. `SPEECHMATICS_BASE_URL` is optional and defaults to `https://eu1.asr.api.speechmatics.com`.
- Deepgram, Soniox, Speechmatics, Rev, Mistral, Groq, local engines, and count-only OpenAI diarization ignore `--speaker-count`; the CLI now emits one aggregated warning that lists which selected providers honor the hint and which ignore it.
- OpenAI does not support count-only diarization hints. Use `--speaker-name` with matching `--speaker-reference` clips instead.
- OpenAI known speaker references support up to 4 speakers. Each reference clip should be about 2-10 seconds.
- In multi-item batch mode with more than one hosted STT provider active, the batch scheduler keeps one in-flight item per provider/model and uses free provider slots across items before waiting behind a busy provider. `--stt-provider-concurrency` remains the per-item upper bound.
- Async hosted STT providers now use a shorter default poll budget: `max(10m, audio duration * 250ms)` capped at `30m`, unless `AUTOSHOW_STT_POLL_DEADLINE_MS` or the provider-specific override is set.
- Multi-item multi-provider STT batches now do one automatic retry-only backfill sweep in the same invocation. Retryable missing provider outputs are rerun from the batch manifest before the command exits, and persisted async jobs are resumed with short bounded status probes instead of another long poll window.
- If a provider hits a clearly permanent provider-wide failure during a batch, later file/provider pairs are marked as `skipped` instead of being retried blindly for every remaining item.
- Multi-provider STT items are only considered complete when every requested provider succeeded. If any provider is still missing after automatic backfill, the run exits non-zero, keeps all successful provider outputs, and records `completionStatus`, `requestedProviders`, `providerStates`, and `missingProviders` in `metadata.json`.
- Provider metadata now includes additive STT timing fields such as scheduler queue wait, upload/create/poll, transcript fetch, and cleanup where the provider exposes those phases.
- Batch `info.json` entries now include each item's `outputDir` and the same completion fields so missing provider/file pairs can be resumed later.
- Failed providers keep `providers/<service>-<model>/error.json`, and validation-style failures also keep `raw-response.json` for debugging. Skipped providers also write a local `error.json` explaining which earlier provider failure blocked the attempt.
- `--resume-missing` takes a batch directory produced by a prior STT batch run. If you omit the path entirely, the CLI scans `./output` and auto-picks the newest compatible resumable STT batch. With no provider flags, it reuses the original requested provider set. If provider flags are supplied, they must be a subset of the original requested providers. Persisted async jobs are resumed via short bounded status probes; if they are still pending after those checks, rerun the command later.
- `--resume-missing` does not take a positional input and does not support `--price` / `--dry-run`.
- Incomplete STT batches still exit with code `2`, but they are reported as operational batch failures rather than CLI usage errors.
- Service setup details are in [`transcribe-audio-local.md#setup`](./transcribe-audio-local.md#setup).
