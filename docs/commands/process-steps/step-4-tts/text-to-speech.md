# tts

Generate speech audio from a local `.md` or `.txt` file with local or hosted TTS providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared TTS Options](#shared-tts-options)
- [TTS Services](#tts-services)
  - [Kitten TTS](#kitten-tts)
  - [ElevenLabs](#elevenlabs)
  - [MiniMax](#minimax)
  - [Groq](#groq)
  - [Grok](#grok)
  - [Mistral](#mistral)
  - [OpenAI](#openai)
  - [Gemini](#gemini)
  - [Deepgram](#deepgram)
  - [Speechify](#speechify)
  - [Hume](#hume)
  - [Cartesia](#cartesia)
- [Pricing Notes](#pricing-notes)
- [Output](#output)

## Setup

```bash
# full setup
bun as setup

# install Kitten TTS, download local models, and check hosted TTS readiness
bun as setup --step tts
```

Local TTS runtime pieces:

- Kitten TTS venv under `runtime/bin/kitten-tts/`
- downloaded model cache created by Kitten TTS itself

### Environment

Hosted providers need API keys:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
XAI_API_KEY=...
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
DEEPGRAM_API_KEY=...
MISTRAL_API_KEY=...
SPEECHIFY_API_KEY=...
HUME_API_KEY=...
CARTESIA_API_KEY=...
# optional for Mistral TTS; set exactly one
MISTRAL_TTS_VOICE=...
MISTRAL_TTS_REF_AUDIO=input/examples/audio/anthony-voice.mp3
# optional for Speechify TTS
SPEECHIFY_TTS_VOICE=george
# optional for Hume TTS
HUME_BASE_URL=https://api.hume.ai
HUME_TTS_VOICE="Male English Actor"
HUME_TTS_VOICE_PROVIDER=HUME_AI
# optional for Cartesia TTS
CARTESIA_BASE_URL=https://api.cartesia.ai
CARTESIA_VERSION=2026-03-01
CARTESIA_TTS_VOICE=f786b574-daa5-4673-aa0c-cbe3e8534c02
# optional for Grok TTS
XAI_BASE_URL=https://api.x.ai/v1
XAI_TTS_VOICE=eve
```

## Usage

```bash
bun as tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file. If no engine flag is provided, `tts` defaults to Kitten TTS with `kitten-tts-nano-0.8-int8`.

## Shared TTS Options

| Flag | Description |
|------|-------------|
| `--all-providers` | Select the default all-provider TTS target set |
| `--provider-concurrency <n>` | Hosted TTS providers/models to run concurrently per item; default `2`, or up to `8` for `--all-providers` |
| `--local-concurrency <n>` | Local TTS providers to run concurrently per item; default `1` |
| `--price` | Show the aggregated estimate and exit |
| `--output-dir <dir>` | Use an exact run directory instead of a timestamped output directory |

You can combine multiple TTS targets in one run. Each successful target writes its own output file. `--provider` is repeatable, including repeated selectors from the same provider. Shared voice flags apply to every selected model for that provider.


```bash
bun as tts input/examples/tts/1-tts.md \
  --provider kitten=kitten-tts-mini \
  --provider openai=gpt-4o-mini-tts \
  --tts-voice alloy

bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3
```

## TTS Services

### Kitten TTS

| Option | Value |
|--------|-------|
| Selector | `--provider kitten[=<model>]` |
| Models | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |
| Voice | `--tts-voice <name>`, default `Jasper` |

```bash
bun as tts input/examples/tts/1-tts.md
bun as tts input/examples/tts/1-tts.md --provider kitten=kitten-tts-mini --tts-voice Luna
```

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--provider elevenlabs[=<model>]` |
| Models | `eleven_v3` |
| Existing voice | `--tts-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us` |
| Instant Voice Cloning | `--tts-ref-audio <path>`, `--tts-voice-name <name>`, `--elevenlabs-tts-clone-remove-background-noise` |
| Output and synthesis controls | `--tts-output-format <format>`, `--tts-language <code>`, `--elevenlabs-tts-stability <0..1>`, `--elevenlabs-tts-similarity-boost <0..1>`, `--elevenlabs-tts-style <0..1>`, `--elevenlabs-tts-use-speaker-boost`, `--tts-speed <0.7..1.2>`, `--elevenlabs-tts-seed <n>`, `--tts-text-normalization auto\|on\|off`, repeatable `--elevenlabs-tts-pronunciation-dictionary-locator <id[:version]>`, `--elevenlabs-tts-optimize-streaming-latency <0..4>` |

```bash
bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3 --tts-voice-name AutoShowAnthony
bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3 --price
```

ElevenLabs TTS uses existing voices by default. Add `--tts-ref-audio` to create one persistent ElevenLabs Instant Voice Clone before synthesis and reuse the returned `voice_id` for every selected ElevenLabs model in that run. `--tts-voice-name` labels the created voice and defaults to `AutoShow_<timestamp>`. Do not combine clone mode with `--tts-voice`; if ElevenLabs returns `requires_verification`, AutoShow stops with the created `voice_id` so you can verify it in ElevenLabs and rerun with `--tts-voice <id>`.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--provider minimax[=<model>]` |
| Models | `speech-2.8-hd`, `speech-2.8-turbo` |
| Voice | `--tts-voice <id>`, default `English_expressive_narrator` |
| Synthesis controls | `--minimax-tts-language-boost <language>`, `--tts-speed <0.5..2>`, `--minimax-tts-volume <greater-than-0..10>`, `--minimax-tts-pitch <-12..12>`, `--minimax-tts-emotion <emotion>`, `--tts-text-normalization true`, repeatable `--minimax-tts-pronunciation <rule>` |

```bash
bun as tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator
bun as tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-hd --minimax-tts-language-boost English --tts-speed 1.15 --minimax-tts-emotion calm
bun as tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator --price
```

MiniMax TTS uses existing/preset voices. Use `--tts-voice` to override the voice ID for the selected MiniMax model.

### Groq

| Option | Value |
|--------|-------|
| Selector | `--provider groq[=<model>]` |
| Models | `canopylabs/orpheus-v1-english` |
| Voice | `--tts-voice <id>`; voices `autumn`, `diana`, `hannah`, `austin`, `daniel`, `troy` |

```bash
bun as tts input/examples/tts/1-tts.md --provider groq=canopylabs/orpheus-v1-english --tts-voice troy
```

Groq voices are validated against the selected model. Groq Orpheus English defaults to `troy`.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-tts` |
| Voice | `--tts-voice <id>`, default `eve`; built-ins `eve`, `ara`, `rex`, `sal`, `leo`, or an 8-character custom voice ID |
| Language | `--tts-language <code>`, default `auto` |
| Text normalization | `--tts-text-normalization true` |

```bash
bun as tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve
bun as tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice ab12cd34 --tts-language ar-SA --tts-text-normalization true
```

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `voxtral-mini-tts-2603` |
| Voice source | exactly one of `--tts-voice <id>` or `--tts-ref-audio <path>` |
| Saved voice name | `--tts-voice-name <name>` when creating a saved voice from reference audio |
| Dialogue mode | `--tts-dialogue-format screenplay|labeled` plus repeatable `--tts-speaker-ref-audio SPEAKER=path` |

```bash
bun as tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-voice voice_abc123
bun as tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3 --tts-voice-name AutoShowAnthony
bun as tts input/chat-and-duco.txt \
  --provider mistral=voxtral-mini-tts-2603 \
  --tts-dialogue-format screenplay \
  --tts-speaker-ref-audio DUCO=input/examples/audio/anthony-voice.mp3 \
  --tts-speaker-ref-audio CHAT=https://ajc.pics/autoshow/examples/1-audio.mp3
```

Mistral Voxtral TTS requires one voice source when generating audio: a saved/custom voice ID or a reference audio file, provided as a local path or HTTP(S) URL. Add `--tts-voice-name` with `--tts-ref-audio` when the run should create/name a saved voice instead of using one-off reference audio. `--price` can estimate Mistral TTS with only `--provider mistral=voxtral-mini-tts-2603` because no synthesis request is made. Reference audio is base64-encoded for the request and is not written into run metadata; metadata records the speaker as `ref_audio:<basename>`.

Dialogue mode is Mistral-only in v1 and uses per-speaker reference audio mappings instead of `--tts-voice` or `--tts-ref-audio`. `screenplay` mode extracts configured speaker dialogue, strips leading parentheticals, and omits scene/action directions. `labeled` mode expects `SPEAKER: text` lines. Runs write `dialogue-normalized.txt`, one WAV per turn under `segments/`, the final `speech.wav`, and `run.json`; price estimates use the spoken dialogue character count.

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--provider openai[=<model>]` |
| Models | `gpt-4o-mini-tts` |
| Voice | `--tts-voice <id>`, default `alloy`; existing `voice_...` custom IDs are supported |
| Synthesis controls | `--tts-instructions <text>`, `--tts-speed <0.25..4>` |
| Custom voice creation | `--tts-ref-audio <path>` plus exactly one of `--openai-tts-consent-id <id>` or `--tts-consent-audio <path>` |
| Consent metadata | `--tts-consent-language <tag>`, `--tts-consent-name <name>`, `--tts-voice-name <name>` |

```bash
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --tts-voice alloy
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --tts-instructions "Warm documentary narration" --tts-speed 1.1
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --tts-voice voice_existing123
bun as tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts --tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123 --tts-voice-name AutoShowAnthony
```

OpenAI custom voices are available only to eligible OpenAI customers. To create a custom voice, provide `--tts-ref-audio` plus consent. Do not combine `--tts-voice` with `--tts-ref-audio`. Sample and consent audio must be non-empty, at most 10 MiB, provided as local paths or HTTP(S) URLs, and have one of these extensions/MIME families: `mp3`/`mpeg`, `wav`, `ogg`, `aac`, `flac`, `webm`, `mp4`, or `m4a`.

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.1-flash-tts-preview` |
| Single voice | `--tts-voice <name>`, default `Kore` |
| Multispeaker | `--gemini-speaker-1-name`, `--gemini-speaker-1-voice`, `--gemini-speaker-2-name`, `--gemini-speaker-2-voice` |

```bash
bun as tts input/examples/tts/1-tts.md --provider gemini=gemini-3.1-flash-tts-preview --tts-voice Kore

bun as tts input/examples/tts/tts-dialogue.txt \
  --provider gemini=gemini-3.1-flash-tts-preview \
  --gemini-speaker-1-name Host \
  --gemini-speaker-1-voice Kore \
  --gemini-speaker-2-name Guest \
  --gemini-speaker-2-voice Puck
```

Gemini multispeaker mode is enabled only when all four `--gemini-speaker-*` flags are provided together. Do not combine the multispeaker flags with `--tts-voice`. The input text must include explicit speaker labels such as `Host:` and `Guest:` that match the configured speaker names. Inline Gemini-style delivery tags like `[whispers]` or `[excitedly]` stay in the source text and are passed through unchanged.

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--provider deepgram[=<model>]` |
| Models | Aura 2 voice models listed by `bun as tts --help`; default `aura-2-thalia-en` |
| Voice/model override | `--tts-voice <model>`, default selected model |
| Output controls | `--deepgram-tts-container <container>`, `--deepgram-tts-bit-rate <bps>`, `--deepgram-tts-sample-rate <hz>`, `--tts-speed <0.5..2>` |

```bash
bun as tts input/examples/tts/1-tts.md --provider deepgram=aura-2-thalia-en --tts-voice aura-2-andromeda-en
bun as tts input/examples/tts/1-tts.md --provider deepgram=aura-2-thalia-en --deepgram-tts-container wav --deepgram-tts-sample-rate 24000
```

### Speechify

| Option | Value |
|--------|-------|
| Selector | `--provider speechify[=<model>]` |
| Models | `simba-english`, `simba-multilingual` |
| Voice | `--tts-voice <id>`, `SPEECHIFY_TTS_VOICE`, default `george` |
| Audio/language controls | `--tts-output-format mp3\|ogg\|aac\|wav\|pcm`, `--tts-language <tag>` |
| Custom voice creation | `--tts-ref-audio <path>`, `--tts-voice-name <name>`, `--tts-consent-name <name>`, `--tts-consent-email <email>`, `--speechify-tts-voice-locale <tag>`, `--speechify-tts-voice-gender <gender>` |

```bash
bun as tts input/examples/tts/1-tts.md --provider speechify=simba-english --tts-voice george --tts-output-format mp3
bun as tts input/examples/tts/1-tts.md --provider speechify=simba-english --tts-ref-audio input/voices/my-10-to-30-second-sample.mp3 --tts-consent-name "Anthony Example" --tts-consent-email anthony@example.com --tts-voice-name AutoShowAnthony
bun as tts input/examples/tts/1-tts.md --provider speechify=simba-multilingual --tts-ref-audio input/voices/my-10-to-30-second-sample.mp3 --tts-consent-name "Anthony Example" --tts-consent-email anthony@example.com --speechify-tts-voice-locale en-US --speechify-tts-voice-gender notSpecified --price
bun as tts input/examples/tts/1-tts.md --provider speechify=simba-english --tts-voice speechify_custom_voice_123
SPEECHIFY_TTS_VOICE=speechify_custom_voice_123 bun as tts input/examples/tts/1-tts.md --provider speechify=simba-multilingual
bun as config --tts speechify=simba-english --tts-voice speechify_custom_voice_123
```

Speechify TTS sends text chunks to `POST /v1/audio/speech` and requests the selected output format, MP3 by default, before AutoShow converts the final result to `speech.wav`. `--tts-voice` accepts any non-empty Speechify voice ID, including custom voice IDs created by Speechify or by a previous AutoShow run.

To create a Speechify custom voice as part of `tts`, add `--tts-ref-audio` plus consent flags. AutoShow calls Speechify `POST /v1/voices` once, reuses the returned `id` for every selected Speechify model in that run, and records `speaker: ref_audio:<basename>`, `clonedVoiceId`, and `cloneCostCents: 0` in metadata. Do not combine custom voice creation with `--tts-voice`.

The reference sample must be non-empty audio with a supported extension (`mp3`/`mpeg`, `wav`, `m4a`/`mp4`, `ogg`, `flac`, `aac`, or `webm`), provided as a local path or HTTP(S) URL, and at most 5 MiB. When `ffprobe` can detect duration, AutoShow requires 10-30 seconds to match Speechify's cloning guidance. `--speechify-tts-voice-locale` defaults to `en-US`; `--speechify-tts-voice-gender` defaults to `notSpecified` and accepts `male`, `female`, or `notSpecified`.

### Hume

| Option | Value |
|--------|-------|
| Selector | `--provider hume[=<model>]` |
| Models | `octave-2` |
| Voice | `--tts-voice <name-or-id>`, `HUME_TTS_VOICE`, default `Male English Actor` |
| Voice provider | `--hume-tts-voice-provider HUME_AI|CUSTOM_VOICE`, `HUME_TTS_VOICE_PROVIDER`, default `HUME_AI` for named voices |
| API settings | `HUME_API_KEY`, optional `HUME_BASE_URL` |

```bash
bun as tts input/examples/tts/1-tts.md --provider hume=octave-2
bun as tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"
bun as tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice 00000000-0000-4000-8000-000000000000
bun as config --tts hume=octave-2 --tts-voice "Studio Voice" --hume-tts-voice-provider CUSTOM_VOICE
```

Hume TTS uses Octave 2 through `POST /v0/tts/file`, sends `version: "2"`, requests MP3 chunks, and converts the final output to `speech.wav`. Text is split into 5000-character chunks. UUID-like voice values are sent as voice IDs unless a provider is explicit; named voices are sent with the selected provider.

### Cartesia

| Option | Value |
|--------|-------|
| Selector | `--provider cartesia[=<model>]` |
| Models | `sonic-3`, `sonic-3.5` |
| Voice | `--tts-voice <voice-id>`, `CARTESIA_TTS_VOICE`, default `f786b574-daa5-4673-aa0c-cbe3e8534c02` |
| Language | `--tts-language <code>` |
| API settings | `CARTESIA_API_KEY`, optional `CARTESIA_BASE_URL`, `CARTESIA_VERSION` |

```bash
bun as tts input/examples/tts/1-tts.md --provider cartesia=sonic-3
bun as tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun as tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5 --tts-language en
bun as config --tts cartesia=sonic-3.5 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
```

Cartesia TTS uses `POST /tts/bytes`, sends the `Cartesia-Version` header, requests 24000 Hz `pcm_s16le` WAV bytes, and converts the final output to `speech.wav`. Text is split into 5000-character chunks. Voice selection currently uses Cartesia voice IDs; cloning, localization, pronunciation dictionaries, speed, volume, and emotion controls are not exposed in this pass.

## Pricing Notes

- ElevenLabs API pricing is 10 cents / 1K characters for `eleven_v3`. IVC setup adds a one-time 0 cent setup estimate and a 10000 ms setup timing estimate.
- MiniMax synthesis estimates are 6 cents / 1K characters for `speech-2.8-turbo` and 10 cents / 1K characters for `speech-2.8-hd`.
- Groq English Orpheus estimates use $10 / 1M input characters plus $22 / 1M output characters.
- Mistral `voxtral-mini-tts-2603` is priced at $0 input and $16 per 1M output characters, equivalent to 1.6 cents per 1K characters. AutoShow uses a 36908 ms / 1K characters timing heuristic.
- OpenAI `gpt-4o-mini-tts` estimates use 60 cents / 1M input characters plus 1200 cents / 1M output characters, equivalent to 1.26 cents per 1K characters in AutoShow's character estimator. OpenAI custom voice creation adds a one-time 0 cent setup estimate and a 15000 ms setup timing estimate.
- Speechify Simba estimates use 1 cent / 1K characters for both `simba-english` and `simba-multilingual`, with a 3000 ms / 1K characters timing heuristic. Custom voice creation adds a one-time 0 cent setup estimate and a 10000 ms setup timing estimate.
- Hume `octave-2` estimates use the conservative public overage rate of 15 cents / 1K characters.
- Cartesia Sonic estimates use 3.7375 cents / 1K characters for `sonic-3` and `sonic-3.5`, with a 3000 ms / 1K characters timing heuristic.
- Google Cloud TTS estimates use paid list prices without subtracting free-tier usage: Chirp 3 HD 3 cents / 1K characters, Instant Custom Voice 6 cents / 1K, and Studio 16 cents / 1K. Timing heuristics are 9000 ms / 1K characters for Chirp 3 HD, 10000 ms / 1K for Studio, and 12000 ms / 1K for Instant Custom Voice.

## Output

- If exactly one TTS target succeeds, the run writes `speech.wav` plus `run.json`.
- If multiple TTS targets succeed, the run writes `speech-<service>-<sanitized-model>.wav` for each successful target plus `run.json`.
- Dialogue runs also write `dialogue-normalized.txt` and per-turn WAVs under `segments/`.
- ElevenLabs IVC runs record `speaker: "ref_audio:<basename>"`, `clonedVoiceId`, and `cloneCostCents: 0` in the Step 4 metadata.
- OpenAI custom voice creation runs record `speaker: "ref_audio:<basename>"`, `clonedVoiceId`, and `cloneCostCents: 0` in the Step 4 metadata.
- Hume runs record the selected voice name or ID as `speaker`.
- Cartesia runs record the selected voice ID as `speaker`.
- Google Cloud Instant Custom Voice runs record `speaker: "instant-custom-voice"` and do not store the raw voice cloning key in `run.json`.
- `run.json` includes `tts`, `cost`, and `timing` sections. `tts` is always an array, even when only one target succeeds.
- Reference-audio runs store only `speaker: "ref_audio:<basename>"`; the full path and reference transcript are not written to `run.json`.
- `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.
