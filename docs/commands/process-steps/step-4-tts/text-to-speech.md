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
  - [Google Cloud](#google-cloud)
  - [deAPI](#deapi)
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
DEAPI_API_KEY=...
DEAPI_BASE_URL=https://api.deapi.ai
# Google Cloud TTS uses gcloud CLI auth and an active billed project
bun as setup --gcloud
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
| `--all-tts` | Select the default all-provider TTS target set |
| `--tts-provider-concurrency <n>` | Hosted TTS providers/models to run concurrently per item; default `2`, or up to `8` for `--all-tts` |
| `--tts-local-concurrency <n>` | Local TTS providers to run concurrently per item; default `1` |
| `--price` | Show the aggregated estimate and exit |
| `--out <dir>` / `--output-dir <dir>` | Use an exact run directory instead of a timestamped output directory |

You can combine multiple TTS targets in one run. Each successful target writes its own output file. Model-selecting flags are repeatable, including repeated flags from the same provider. Shared voice flags apply to every selected model for that provider.

`--all-tts` expands to the self-contained TTS target set, including Kitten, ElevenLabs, MiniMax, Groq, Grok, Mistral, OpenAI, Gemini, the default Deepgram model, Speechify, Hume, Cartesia, Google Cloud prebuilt models, and runnable deAPI models. It excludes special modes that require extra inputs, including Google Cloud `instant-custom-voice`, deAPI voice clone/design models, and dialogue-only flows.

```bash
bun as tts input/examples/tts/1-tts.md \
  --kitten kitten-tts-mini \
  --openai gpt-4o-mini-tts \
  --openai-voice alloy

bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3
```

## TTS Services

### Kitten TTS

| Option | Value |
|--------|-------|
| Selector | `--kitten <model>` |
| Models | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |
| Voice | `--kitten-voice <name>`, default `Jasper` |

```bash
bun as tts input/examples/tts/1-tts.md
bun as tts input/examples/tts/1-tts.md --kitten kitten-tts-mini --kitten-voice Luna
```

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--elevenlabs <model>` |
| Models | `eleven_v3` |
| Existing voice | `--elevenlabs-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us` |
| Instant Voice Cloning | `--elevenlabs-tts-ref-audio <path>`, `--elevenlabs-tts-voice-name <name>`, `--elevenlabs-tts-clone-remove-background-noise` |
| Professional Voice Cloning | `--elevenlabs-tts-pvc-voice <id>`, `--elevenlabs-tts-pvc-sample <path>`, `--elevenlabs-tts-pvc-sample-dir <dir>`, `--elevenlabs-tts-pvc-language <code>`, `--elevenlabs-tts-pvc-description <text>`, `--elevenlabs-tts-pvc-captcha-out <path>`, `--elevenlabs-tts-pvc-verify-audio <path>`, `--elevenlabs-tts-pvc-wait` |

```bash
bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3 --elevenlabs-voice hpp4J3VqNfWAUOO0d1Us
bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3 --elevenlabs-tts-ref-audio input/examples/audio/anthony-voice.mp3 --elevenlabs-tts-voice-name AutoShowAnthony
bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3 --elevenlabs-tts-ref-audio input/examples/audio/anthony-voice.mp3 --price
bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3 --elevenlabs-tts-pvc-voice pvc_voice_123
bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3 --elevenlabs-tts-pvc-sample-dir input/pvc-samples --elevenlabs-tts-voice-name AutoShowPVC --elevenlabs-tts-pvc-captcha-out output/pvc-captcha.png
bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3 --elevenlabs-tts-pvc-voice pvc_voice_123 --elevenlabs-tts-pvc-verify-audio input/pvc-captcha-reading.mp3 --elevenlabs-tts-pvc-wait
```

ElevenLabs TTS uses existing voices by default. Add `--elevenlabs-tts-ref-audio` to create one persistent ElevenLabs Instant Voice Clone before synthesis and reuse the returned `voice_id` for every selected ElevenLabs model in that run. `--elevenlabs-tts-voice-name` labels the created voice and defaults to `AutoShow_<timestamp>`. Do not combine clone mode with `--elevenlabs-voice`; if ElevenLabs returns `requires_verification`, AutoShow stops with the created `voice_id` so you can verify it in ElevenLabs and rerun with `--elevenlabs-voice <id>`.

Use `--elevenlabs-tts-pvc-voice <voice_id>` when the PVC voice is already trained; synthesis still uses normal ElevenLabs TTS character pricing, while metadata records `speaker: "pvc:<voice_id>"`. To start PVC setup from `tts`, provide one or more PVC sample flags. Without `--elevenlabs-tts-pvc-wait`, setup/status runs exit after writing artifacts and do not synthesize speech. With `--elevenlabs-tts-pvc-wait`, AutoShow polls until the selected model is `fine_tuned` or `failed`, then synthesizes with the PVC voice.

PVC samples must be local, non-empty audio files with supported extensions. AutoShow warns when the known total duration is under 30 minutes or over 180 minutes. It does not automate ElevenLabs speaker separation; use clean single-speaker samples or process/select speakers in ElevenLabs before training.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--minimax <model>` |
| Models | `speech-2.8-hd`, `speech-2.8-turbo` |
| Voice | `--minimax-tts-voice <id>`, default `English_expressive_narrator` |
| Synthesis controls | `--minimax-tts-language-boost <language>`, `--minimax-tts-speed <0.5..2>`, `--minimax-tts-volume <greater-than-0..10>`, `--minimax-tts-pitch <-12..12>`, `--minimax-tts-emotion <emotion>`, `--minimax-tts-english-normalization`, repeatable `--minimax-tts-pronunciation <rule>` |

```bash
bun as tts input/examples/tts/1-tts.md --minimax speech-2.8-turbo --minimax-tts-voice English_expressive_narrator
bun as tts input/examples/tts/1-tts.md --minimax speech-2.8-hd --minimax-tts-language-boost English --minimax-tts-speed 1.15 --minimax-tts-emotion calm
bun as tts input/examples/tts/1-tts.md --minimax speech-2.8-turbo --minimax-tts-voice English_expressive_narrator --price
```

MiniMax TTS uses existing/preset voices. Use `--minimax-tts-voice` to override the voice ID for the selected MiniMax model.

### Groq

| Option | Value |
|--------|-------|
| Selector | `--groq <model>` |
| Models | `canopylabs/orpheus-v1-english`, `canopylabs/orpheus-arabic-saudi` |
| Voice | `--groq-voice <id>`; English voices `autumn`, `diana`, `hannah`, `austin`, `daniel`, `troy`; Arabic voices `abdullah`, `fahad`, `sultan`, `lulwa`, `noura`, `aisha` |

```bash
bun as tts input/examples/tts/1-tts.md --groq canopylabs/orpheus-v1-english --groq-voice troy
bun as tts input/examples/tts/1-tts.md --groq canopylabs/orpheus-arabic-saudi --groq-voice fahad
```

Groq voices are validated against the selected model. English defaults to `troy`; Arabic Saudi defaults to `fahad`.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--grok <model>` |
| Models | `grok-tts` |
| Voice | `--grok-tts-voice <id>`, default `eve`; built-ins `eve`, `ara`, `rex`, `sal`, `leo`, or an 8-character custom voice ID |
| Language | `--grok-tts-language <code>`, default `auto` |
| Text normalization | `--grok-tts-text-normalization` |

```bash
bun as tts input/examples/tts/1-tts.md --grok grok-tts --grok-tts-voice eve
bun as tts input/examples/tts/1-tts.md --grok grok-tts --grok-tts-voice ab12cd34 --grok-tts-language ar-SA --grok-tts-text-normalization
```

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--mistral <model>` |
| Models | `voxtral-mini-tts-2603` |
| Voice source | exactly one of `--mistral-tts-voice <id>` or `--mistral-tts-ref-audio <path>` |
| Dialogue mode | `--tts-dialogue-format screenplay|labeled` plus repeatable `--tts-speaker-ref-audio SPEAKER=path` |

```bash
bun as tts input/examples/tts/1-tts.md --mistral voxtral-mini-tts-2603 --mistral-tts-voice voice_abc123
bun as tts input/examples/tts/1-tts.md --mistral voxtral-mini-tts-2603 --mistral-tts-ref-audio input/examples/audio/anthony-voice.mp3
bun as tts input/chat-and-duco.txt \
  --mistral voxtral-mini-tts-2603 \
  --tts-dialogue-format screenplay \
  --tts-speaker-ref-audio DUCO=input/examples/audio/anthony-voice.mp3 \
  --tts-speaker-ref-audio CHAT=input/examples/audio/1-audio.mp3
```

Mistral Voxtral TTS requires one voice source when generating audio: a saved/custom voice ID or a one-off local reference audio file. `--price` can estimate Mistral TTS with only `--mistral` because no synthesis request is made. Reference audio is base64-encoded for the request and is not written into run metadata; metadata records the speaker as `ref_audio:<basename>`.

Dialogue mode is Mistral-only in v1 and uses per-speaker reference audio mappings instead of `--mistral-tts-voice` or `--mistral-tts-ref-audio`. `screenplay` mode extracts configured speaker dialogue, strips leading parentheticals, and omits scene/action directions. `labeled` mode expects `SPEAKER: text` lines. Runs write `dialogue-normalized.txt`, one WAV per turn under `segments/`, the final `speech.wav`, and `run.json`; price estimates use the spoken dialogue character count.

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--openai <model>` |
| Models | `gpt-4o-mini-tts` |
| Voice | `--openai-voice <id>`, default `alloy`; existing `voice_...` custom IDs are supported |
| Synthesis controls | `--openai-tts-instructions <text>`, `--openai-tts-speed <0.25..4>` |
| Custom voice creation | `--openai-tts-ref-audio <path>` plus exactly one of `--openai-tts-consent-id <id>` or `--openai-tts-consent-audio <path>` |
| Consent metadata | `--openai-tts-consent-language <tag>`, `--openai-tts-consent-name <name>`, `--openai-tts-voice-name <name>` |

```bash
bun as tts input/examples/tts/1-tts.md --openai gpt-4o-mini-tts --openai-voice alloy
bun as tts input/examples/tts/1-tts.md --openai gpt-4o-mini-tts --openai-tts-instructions "Warm documentary narration" --openai-tts-speed 1.1
bun as tts input/examples/tts/1-tts.md --openai gpt-4o-mini-tts --openai-voice voice_existing123
bun as tts input/examples/tts/1-tts.md --openai gpt-4o-mini-tts --openai-tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123 --openai-tts-voice-name AutoShowAnthony
```

OpenAI custom voices are available only to eligible OpenAI customers. To create a custom voice, provide `--openai-tts-ref-audio` plus consent. Do not combine `--openai-voice` with `--openai-tts-ref-audio`. Sample and consent audio must be local, non-empty, at most 10 MiB, and have one of these extensions/MIME families: `mp3`/`mpeg`, `wav`, `ogg`, `aac`, `flac`, `webm`, `mp4`, or `m4a`.

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--gemini <model>` |
| Models | `gemini-3.1-flash-tts-preview` |
| Single voice | `--gemini-voice <name>`, default `Kore` |
| Multispeaker | `--gemini-speaker-1-name`, `--gemini-speaker-1-voice`, `--gemini-speaker-2-name`, `--gemini-speaker-2-voice` |

```bash
bun as tts input/examples/tts/1-tts.md --gemini gemini-3.1-flash-tts-preview --gemini-voice Kore

bun as tts input/examples/tts/tts-dialogue.txt \
  --gemini gemini-3.1-flash-tts-preview \
  --gemini-speaker-1-name Host \
  --gemini-speaker-1-voice Kore \
  --gemini-speaker-2-name Guest \
  --gemini-speaker-2-voice Puck
```

Gemini multispeaker mode is enabled only when all four `--gemini-speaker-*` flags are provided together. Do not combine the multispeaker flags with `--gemini-voice`. The input text must include explicit speaker labels such as `Host:` and `Guest:` that match the configured speaker names. Inline Gemini-style delivery tags like `[whispers]` or `[excitedly]` stay in the source text and are passed through unchanged.

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--deepgram <model>` |
| Models | `aura-2-thalia-en`, `aura-2-andromeda-en`, `aura-2-apollo-en`, `aura-2-arcas-en`, `aura-2-asteria-en`, `aura-2-athena-en`, `aura-2-helena-en`, `aura-2-aries-en` |
| Voice/model override | `--deepgram-voice <model>`, default selected model |

```bash
bun as tts input/examples/tts/1-tts.md --deepgram aura-2-thalia-en --deepgram-voice aura-2-andromeda-en
```

### Speechify

| Option | Value |
|--------|-------|
| Selector | `--speechify <model>` |
| Models | `simba-english`, `simba-multilingual` |
| Voice | `--speechify-voice <id>`, `SPEECHIFY_TTS_VOICE`, default `george` |
| Custom voice creation | `--speechify-tts-ref-audio <path>`, `--speechify-tts-voice-name <name>`, `--speechify-tts-consent-name <name>`, `--speechify-tts-consent-email <email>`, `--speechify-tts-voice-locale <tag>`, `--speechify-tts-voice-gender <gender>` |

```bash
bun as tts input/examples/tts/1-tts.md --speechify simba-english --speechify-voice george
bun as tts input/examples/tts/1-tts.md --speechify simba-english --speechify-tts-ref-audio input/voices/my-10-to-30-second-sample.mp3 --speechify-tts-consent-name "Anthony Example" --speechify-tts-consent-email anthony@example.com --speechify-tts-voice-name AutoShowAnthony
bun as tts input/examples/tts/1-tts.md --speechify simba-multilingual --speechify-tts-ref-audio input/voices/my-10-to-30-second-sample.mp3 --speechify-tts-consent-name "Anthony Example" --speechify-tts-consent-email anthony@example.com --speechify-tts-voice-locale en-US --speechify-tts-voice-gender notSpecified --price
bun as tts input/examples/tts/1-tts.md --speechify simba-english --speechify-voice speechify_custom_voice_123
SPEECHIFY_TTS_VOICE=speechify_custom_voice_123 bun as tts input/examples/tts/1-tts.md --speechify simba-multilingual
bun as config --speechify-tts simba-english --speechify-voice speechify_custom_voice_123
```

Speechify TTS sends text chunks to `POST /v1/audio/speech` and requests MP3 output before AutoShow converts the final result to `speech.wav`. `--speechify-voice` accepts any non-empty Speechify voice ID, including custom voice IDs created by Speechify or by a previous AutoShow run.

To create a Speechify custom voice as part of `tts`, add `--speechify-tts-ref-audio` plus consent flags. AutoShow calls Speechify `POST /v1/voices` once, reuses the returned `id` for every selected Speechify model in that run, and records `speaker: ref_audio:<basename>`, `clonedVoiceId`, and `cloneCostCents: 0` in metadata. Do not combine custom voice creation with `--speechify-voice`.

The reference sample must be local, non-empty audio with a supported extension (`mp3`/`mpeg`, `wav`, `m4a`/`mp4`, `ogg`, `flac`, `aac`, or `webm`) and at most 5 MiB. When `ffprobe` can detect duration, AutoShow requires 10-30 seconds to match Speechify's cloning guidance. `--speechify-tts-voice-locale` defaults to `en-US`; `--speechify-tts-voice-gender` defaults to `notSpecified` and accepts `male`, `female`, or `notSpecified`.

### Hume

| Option | Value |
|--------|-------|
| Selector | `--hume <model>` |
| Models | `octave-2` |
| Voice | `--hume-tts-voice <name-or-id>`, `HUME_TTS_VOICE`, default `Male English Actor` |
| Voice provider | `--hume-tts-voice-provider HUME_AI|CUSTOM_VOICE`, `HUME_TTS_VOICE_PROVIDER`, default `HUME_AI` for named voices |
| API settings | `HUME_API_KEY`, optional `HUME_BASE_URL` |

```bash
bun as tts input/examples/tts/1-tts.md --hume octave-2
bun as tts input/examples/tts/1-tts.md --hume octave-2 --hume-tts-voice "Male English Actor"
bun as tts input/examples/tts/1-tts.md --hume octave-2 --hume-tts-voice 00000000-0000-4000-8000-000000000000
bun as config --hume-tts octave-2 --hume-tts-voice "Studio Voice" --hume-tts-voice-provider CUSTOM_VOICE
```

Hume TTS uses Octave 2 through `POST /v0/tts/file`, sends `version: "2"`, requests MP3 chunks, and converts the final output to `speech.wav`. Text is split into 5000-character chunks. UUID-like voice values are sent as voice IDs unless a provider is explicit; named voices are sent with the selected provider.

### Cartesia

| Option | Value |
|--------|-------|
| Selector | `--cartesia <model>` |
| Models | `sonic-3`, `sonic-3.5` |
| Voice | `--cartesia-tts-voice <voice-id>`, `CARTESIA_TTS_VOICE`, default `f786b574-daa5-4673-aa0c-cbe3e8534c02` |
| Language | `--cartesia-tts-language <code>` |
| API settings | `CARTESIA_API_KEY`, optional `CARTESIA_BASE_URL`, `CARTESIA_VERSION` |

```bash
bun as tts input/examples/tts/1-tts.md --cartesia sonic-3
bun as tts input/examples/tts/1-tts.md --cartesia sonic-3.5 --cartesia-tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun as tts input/examples/tts/1-tts.md --cartesia sonic-3.5 --cartesia-tts-language en
bun as config --cartesia-tts sonic-3.5 --cartesia-tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
```

Cartesia TTS uses `POST /tts/bytes`, sends the `Cartesia-Version` header, requests 24000 Hz `pcm_s16le` WAV bytes, and converts the final output to `speech.wav`. Text is split into 5000-character chunks. Voice selection currently uses Cartesia voice IDs; cloning, localization, pronunciation dictionaries, speed, volume, and emotion controls are not exposed in this pass.

### Google Cloud

| Option | Value |
|--------|-------|
| Selector | `--gcloud <model>` |
| Models | `chirp3-hd`, `studio`, `instant-custom-voice` |
| Prebuilt voice | `--gcloud-tts-voice <name>` |
| Language | `--gcloud-tts-language <tag>` |
| Instant Custom Voice | `--gcloud-tts-ref-audio <path>`, `--gcloud-tts-consent-audio <path>`, `--gcloud-tts-consent-language <tag>`, `--gcloud-tts-voice-cloning-key <key>`, `--gcloud-tts-voice-cloning-key-out <path>` |

```bash
bun as tts input/examples/tts/1-tts.md --gcloud chirp3-hd --gcloud-tts-voice en-US-Chirp3-HD-Charon
bun as tts input/examples/tts/1-tts.md --gcloud instant-custom-voice --gcloud-tts-voice-cloning-key "$GCLOUD_TTS_VOICE_CLONING_KEY"
bun as tts input/examples/tts/1-tts.md --gcloud instant-custom-voice --gcloud-tts-ref-audio input/examples/audio/anthony-voice.mp3 --gcloud-tts-consent-audio input/examples/audio/0-audio-short.mp3 --gcloud-tts-voice-cloning-key-out output/gcloud-voice-key.txt
```

Google Cloud prebuilt TTS uses `gcloud` CLI auth to call `v1/text:synthesize` with `LINEAR16` output. `--gcloud-tts-language` overrides language code; otherwise AutoShow infers it from the voice name and falls back to `en-US`. Default voices are `en-US-Chirp3-HD-Charon` for `chirp3-hd` and `en-US-Studio-O` for `studio`.

Google Cloud `instant-custom-voice` uses `v1beta1/text:synthesize` with a voice cloning key. Provide an existing key with `--gcloud-tts-voice-cloning-key`, or generate one in the run with both `--gcloud-tts-ref-audio` and `--gcloud-tts-consent-audio`. Optional `--gcloud-tts-voice-cloning-key-out <path>` writes the generated key; AutoShow does not save raw cloning keys to config. Reference and consent audio must be local, non-empty `wav`, `mp3`, `m4a`, or `pcm`; when `ffprobe` can detect duration and channels, files must be at most 10 seconds and single-channel. `--gcloud-tts-consent-language` currently supports `en-US`.

### deAPI

| Option | Value |
|--------|-------|
| Selector | `--deapi <model>` |
| Models | `Kokoro`, `Chatterbox`, `Qwen3_TTS_12Hz_1_7B_CustomVoice`, `Qwen3_TTS_12Hz_1_7B_Base`, `Qwen3_TTS_12Hz_1_7B_VoiceDesign` |
| Preset voice | `--deapi-tts-voice <id>` |
| Voice cloning | `--deapi-tts-ref-audio <path>`, `--deapi-tts-ref-text <text>` |

```bash
bun as tts input/examples/tts/1-tts.md --deapi Kokoro
bun as tts input/examples/tts/1-tts.md --deapi Kokoro --deapi-tts-voice af_heart --price
bun as tts input/examples/tts/1-tts.md --deapi Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/anthony-voice-8-seconds.mp3
bun as tts input/examples/tts/1-tts.md --deapi Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/0-audio-short.mp3 --deapi-tts-ref-text "Reference transcript"
```

deAPI preset voice models keep using `mode=custom_voice` and accept `--deapi-tts-voice`. deAPI voice cloning uses `Qwen3_TTS_12Hz_1_7B_Base` plus `--deapi-tts-ref-audio`; optional `--deapi-tts-ref-text` is sent as `ref_text`. Reference audio must be a local `mp3`, `wav`, `flac`, `ogg`, or `m4a` file, at most 10 MB, and 3-10 seconds long. `--deapi-tts-voice` and `--deapi-tts-ref-audio` are mutually exclusive. `Qwen3_TTS_12Hz_1_7B_VoiceDesign` requires `--deapi-tts-instruction`. `--all-tts` selects only preset/runnable deAPI models and does not include clone or voice-design modes.

## Pricing Notes

- ElevenLabs API pricing is 10 cents / 1K characters for `eleven_v3`. IVC setup adds a one-time 0 cent setup estimate and a 10000 ms setup timing estimate. PVC setup adds a 0 cent setup estimate; training time estimates are 3 hours for English and 6 hours for non-English/multilingual setup when `--elevenlabs-tts-pvc-wait` is used.
- MiniMax synthesis estimates are 6 cents / 1K characters for `speech-2.8-turbo` and 10 cents / 1K characters for `speech-2.8-hd`.
- Groq English Orpheus estimates use $10 / 1M input characters plus $22 / 1M output characters. Groq Arabic Saudi uses $0 input plus $40 / 1M output characters.
- Mistral `voxtral-mini-tts-2603` is priced at $0 input and $16 per 1M output characters, equivalent to 1.6 cents per 1K characters. AutoShow uses a 36908 ms / 1K characters timing heuristic.
- OpenAI `gpt-4o-mini-tts` estimates use 60 cents / 1M input characters plus 1200 cents / 1M output characters, equivalent to 1.26 cents per 1K characters in AutoShow's character estimator. OpenAI custom voice creation adds a one-time 0 cent setup estimate and a 15000 ms setup timing estimate.
- Speechify Simba estimates use 1 cent / 1K characters for both `simba-english` and `simba-multilingual`, with a 3000 ms / 1K characters timing heuristic. Custom voice creation adds a one-time 0 cent setup estimate and a 10000 ms setup timing estimate.
- Hume `octave-2` estimates use the conservative public overage rate of 15 cents / 1K characters.
- Cartesia Sonic estimates use 3.7375 cents / 1K characters for `sonic-3` and `sonic-3.5`, with a 3000 ms / 1K characters timing heuristic.
- Google Cloud TTS estimates use paid list prices without subtracting free-tier usage: Chirp 3 HD 3 cents / 1K characters, Instant Custom Voice 6 cents / 1K, and Studio 16 cents / 1K. Timing heuristics are 9000 ms / 1K characters for Chirp 3 HD, 10000 ms / 1K for Studio, and 12000 ms / 1K for Instant Custom Voice.
- deAPI TTS price preflight calls `/api/v2/audio/speech/price` when `DEAPI_API_KEY` is available. Voice clone quotes send `mode: "voice_clone"` with `count_text`, `model`, `lang`, `speed`, `format`, and `sample_rate`; `voice` is not sent. Without a key, AutoShow falls back to the local registry rate of `$0.00077 / 1K characters` (`0.077¢ / 1K`, `$0.77 / 1M`). `Qwen3_TTS_12Hz_1_7B_Base` uses a 10000 ms / 1K characters processing-time estimate.

## Output

- If exactly one TTS target succeeds, the run writes `speech.wav` plus `run.json`.
- If multiple TTS targets succeed, the run writes `speech-<service>-<sanitized-model>.wav` for each successful target plus `run.json`.
- Dialogue runs also write `dialogue-normalized.txt` and per-turn WAVs under `segments/`.
- ElevenLabs IVC runs record `speaker: "ref_audio:<basename>"`, `clonedVoiceId`, and `cloneCostCents: 0` in the Step 4 metadata.
- Ready ElevenLabs PVC synthesis records `speaker: "pvc:<voice_id>"` in Step 4 metadata. PVC setup-only runs write `elevenlabs-pvc-status.json`; when no wait is requested, no `speech.wav` is produced.
- OpenAI custom voice creation runs record `speaker: "ref_audio:<basename>"`, `clonedVoiceId`, and `cloneCostCents: 0` in the Step 4 metadata.
- Hume runs record the selected voice name or ID as `speaker`.
- Cartesia runs record the selected voice ID as `speaker`.
- Google Cloud Instant Custom Voice runs record `speaker: "instant-custom-voice"` and do not store the raw voice cloning key in `run.json`.
- `run.json` includes `tts`, `cost`, and `timing` sections. `tts` is always an array, even when only one target succeeds.
- Reference-audio runs store only `speaker: "ref_audio:<basename>"`; the full path and reference transcript are not written to `run.json`.
- `--out` / `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.
