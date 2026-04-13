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
bun as stt --resume-missing-from <batch-dir> [provider flags]
```

The input routing is the same as local `stt`: direct media URLs, streaming URLs, local media files, URL lists, directories, feeds, and YouTube channels are all supported.

## Service Engines

| Engine | Selection | Models |
|--------|-----------|--------|
| Groq Whisper | `--groq-stt <model>` | `whisper-large-v3`, `whisper-large-v3-turbo` |
| ElevenLabs | `--elevenlabs-stt <model>` | `scribe_v2` |
| Deepgram | `--deepgram-stt <model>` | `nova-3` |
| Soniox | `--soniox-stt <model>` | `stt-async-v4`, `stt-async-v3` |
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
  --assemblyai-stt universal-3-pro \
  --mistral-stt voxtral-mini-latest \
  --speaker-count 2

# Resume only the missing provider outputs from an earlier batch
bun as stt --resume-missing-from output/2026-04-12_22-37-12-852_files

# Resume only a subset of the originally requested providers
bun as stt --resume-missing-from output/2026-04-12_22-37-12-852_files --deepgram-stt nova-3

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
| `--stt-provider-concurrency <n>` | Per-item cloud provider concurrency upper bound; auto-clamped to `1` in multi-item multi-provider batch runs |
| `--resume-missing-from <batch-dir>` | Reuse an existing STT batch directory and rerun only the missing provider outputs |
| `--price` | Show the aggregated estimate and exit |

## Notes

- Diarization is enabled by default for ElevenLabs, Deepgram, Soniox, AssemblyAI, Mistral, and OpenAI diarized STT models.
- ElevenLabs and AssemblyAI use `--speaker-count` as an optional diarization hint.
- Deepgram, Soniox, Mistral, Groq, local engines, and count-only OpenAI diarization ignore `--speaker-count`; the CLI now emits one aggregated warning that lists which selected providers honor the hint and which ignore it.
- OpenAI does not support count-only diarization hints. Use `--speaker-name` with matching `--speaker-reference` clips instead.
- OpenAI known speaker references support up to 4 speakers. Each reference clip should be about 2-10 seconds.
- In multi-item batch mode with more than one hosted STT provider active, `--stt-provider-concurrency` is treated as an upper bound and the effective hosted-provider concurrency is auto-clamped to `1` per item for reliability.
- Multi-item multi-provider STT batches now do one automatic retry-only backfill sweep in the same invocation. Retryable missing provider outputs are rerun from the batch manifest before the command exits.
- If a provider hits a clearly permanent provider-wide failure during a batch, later file/provider pairs are marked as `skipped` instead of being retried blindly for every remaining item.
- Multi-provider STT items are only considered complete when every requested provider succeeded. If any provider is still missing after automatic backfill, the run exits non-zero, keeps all successful provider outputs, and records `completionStatus`, `requestedProviders`, `providerStates`, and `missingProviders` in `metadata.json`.
- Batch `info.json` entries now include each item's `outputDir` and the same completion fields so missing provider/file pairs can be resumed later.
- Failed providers keep `providers/<service>-<model>/error.json`, and validation-style failures also keep `raw-response.json` for debugging. Skipped providers also write a local `error.json` explaining which earlier provider failure blocked the attempt.
- `--resume-missing-from` takes a batch directory produced by a prior STT batch run. With no provider flags, it reuses the original requested provider set. If provider flags are supplied, they must be a subset of the original requested providers.
- `--resume-missing-from` does not take a positional input and does not support `--price` / `--dry-run`.
- Incomplete STT batches still exit with code `2`, but they are reported as operational batch failures rather than CLI usage errors.
- Service setup details are in [`transcribe-audio-local.md#setup`](./transcribe-audio-local.md#setup).
