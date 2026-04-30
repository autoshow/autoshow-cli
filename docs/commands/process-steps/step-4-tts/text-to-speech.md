# tts

Generate speech audio from a local `.md` or `.txt` file with local or hosted TTS providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Engines](#engines)
- [Pricing Notes](#pricing-notes)
- [Examples](#examples)
- [Flags](#flags)
- [Gemini Multispeaker](#gemini-multispeaker)
- [Output](#output)

## Setup

```bash
# full setup
bun as setup

# install Kitten TTS and download all supported local TTS models
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
RUNWAYML_API_SECRET=...
MISTRAL_API_KEY=...
DEAPI_API_KEY=...
DEAPI_BASE_URL=https://api.deapi.ai
# optional for Mistral TTS; set exactly one
MISTRAL_TTS_VOICE=...
MISTRAL_TTS_REF_AUDIO=input/examples/audio/anthony-voice.mp3
# optional for Runway TTS
RUNWAY_TTS_VOICE=Leslie
# optional for Grok TTS
XAI_BASE_URL=https://api.x.ai/v1
XAI_TTS_VOICE=eve
```

## Usage

```bash
bun as tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file.

## Engines

| Provider | Selection | Models | Voice flag / default |
|----------|-----------|--------|----------------------|
| Kitten TTS | `--kitten-tts <model>` | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` | `--kitten-voice`, default `Jasper` |
| ElevenLabs | `--elevenlabs-tts <model>` | `eleven_v3`, `eleven_flash_v2_5`, `eleven_turbo_v2_5` | `--elevenlabs-voice`, default `hpp4J3VqNfWAUOO0d1Us` |
| MiniMax | `--minimax-tts <model>` | `speech-2.8-hd`, `speech-2.8-turbo` | `--minimax-tts-voice`, default `English_expressive_narrator`, or `--minimax-tts-ref-audio` for rapid voice cloning |
| Groq | `--groq-tts <model>` | `canopylabs/orpheus-v1-english` | `--groq-voice`, default `troy` |
| Grok | `--grok-tts <model>` | `grok-tts` | `--grok-tts-voice`, default `eve`; voices `eve`, `ara`, `rex`, `sal`, `leo` |
| Mistral | `--mistral-tts <model>` | `voxtral-mini-tts-2603` | exactly one of `--mistral-tts-voice` or `--mistral-tts-ref-audio` |
| OpenAI | `--openai-tts <model>` | `gpt-4o-mini-tts` | `--openai-voice`, default `alloy`; existing `voice_...` custom IDs are supported, or use `--openai-tts-ref-audio` to create a custom voice |
| Gemini | `--gemini-tts <model>` | `gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` | `--gemini-voice`, default `Kore` |
| Deepgram | `--deepgram-tts <model>` | `aura-2-thalia-en`, `aura-2-andromeda-en`, `aura-2-apollo-en`, `aura-2-arcas-en`, `aura-2-asteria-en`, `aura-2-athena-en`, `aura-2-helena-en`, `aura-2-aries-en` | `--deepgram-voice`, default selected model |
| Runway | `--runway-tts <model>` | `eleven_multilingual_v2` | `--runway-tts-voice`, default `Leslie` |
| deAPI | `--deapi-tts <model>` | `Kokoro`, `Chatterbox`, `Qwen3_TTS_12Hz_1_7B_CustomVoice`, `Qwen3_TTS_12Hz_1_7B_Base`, `Qwen3_TTS_12Hz_1_7B_VoiceDesign` | `--deapi-tts-voice` for preset voices, or `--deapi-tts-ref-audio` for Qwen3 voice cloning |

If no engine flag is provided, `tts` defaults to Kitten TTS with `kitten-tts-nano-0.8-int8`.

You can combine multiple TTS targets in one run. Each successful target writes its own output file.
Model-selecting flags are repeatable, including repeated flags from the same provider. Shared voice flags apply to every selected model for that provider. `--all-tts` expands to every supported TTS provider/model, including Grok, Mistral, Deepgram, Runway, and runnable deAPI models.

Mistral Voxtral TTS requires one voice source when generating audio: a saved/custom voice ID or a one-off local reference audio file. `--price` can estimate Mistral TTS with only `--mistral-tts` because no synthesis request is made. Reference audio is base64-encoded for the request and is not written into run metadata; metadata records the speaker as `ref_audio:<basename>`.

MiniMax TTS uses existing/preset voices by default. Add `--minimax-tts-ref-audio` to create one MiniMax rapid clone before synthesis and reuse the cloned `voice_id` for every selected MiniMax model in that run. `--minimax-tts-voice` becomes the custom clone `voice_id` in clone mode; omit it to let AutoShow generate one. Source audio must be local `mp3`, `m4a`, or `wav`, 10 seconds to 5 minutes, and at most 20 MB. Optional `--minimax-tts-prompt-audio` must be paired with `--minimax-tts-prompt-text`; prompt audio must be less than 8 seconds and at most 20 MB. Clone metadata records `speaker` as `ref_audio:<basename>` plus `clonedVoiceId`, without storing the full local path. `--all-tts` does not clone unless `--minimax-tts-ref-audio` is also set.

OpenAI custom voices are available only to eligible OpenAI customers. Use an existing custom voice with `--openai-voice voice_...`, which sends the speech request voice as `{ id: "voice_..." }`. To create a custom voice, select OpenAI TTS and provide `--openai-tts-ref-audio` plus exactly one of `--openai-tts-consent-id` or `--openai-tts-consent-audio`. `--openai-tts-consent-language` defaults to `en-US`; `--openai-tts-consent-name` defaults to the consent file name; `--openai-tts-voice-name` defaults to `AutoShow_<timestamp>`. Do not combine `--openai-voice` with `--openai-tts-ref-audio`. Sample and consent audio must be local, non-empty, at most 10 MiB, and have one of these extensions/MIME families: `mp3`/`mpeg`, `wav`, `ogg`, `aac`, `flac`, `webm`, `mp4`, or `m4a`. Clone metadata records `speaker` as `ref_audio:<basename>`, `clonedVoiceId`, and `cloneCostCents: 0`; it does not store local paths or consent IDs.

deAPI preset voice models keep using `mode=custom_voice` and accept `--deapi-tts-voice`. deAPI voice cloning uses `Qwen3_TTS_12Hz_1_7B_Base` plus `--deapi-tts-ref-audio`; optional `--deapi-tts-ref-text` is sent as `ref_text`. Reference audio must be a local `mp3`, `wav`, `flac`, `ogg`, or `m4a` file, at most 10 MB, and 3-10 seconds long. `--deapi-tts-voice` and `--deapi-tts-ref-audio` are mutually exclusive. `Qwen3_TTS_12Hz_1_7B_VoiceDesign` remains listed but unsupported until an instruction flag is added. `--all-tts` selects only preset/runnable deAPI models and does not include clone mode.

## Pricing Notes

- Runway `eleven_multilingual_v2` is priced at 1 credit per 50 input characters. AutoShow treats 1 credit as 1 cent, so the equivalent rate is 20 cents per 1K characters.
- Runway TTS estimates use exact block rounding: `ceil(characterCount / 50) * 1¢`, so 1-50 characters cost 1¢ and 51-100 characters cost 2¢.
- Runway does not publish a TTS processing-time SLA in the local reference, so AutoShow uses a 10000 ms / 1K characters timing heuristic.
- MiniMax synthesis estimates stay at 6 cents / 1K characters for `speech-2.8-turbo` and 10 cents / 1K characters for `speech-2.8-hd`. Clone mode adds a one-time 150 cents rapid clone setup cost per `tts` run, counted once across selected MiniMax models. AutoShow does not send clone preview text, so no preview-character charge is added.
- MiniMax clone mode adds a fixed 15000 ms setup timing estimate because MiniMax does not publish a clone latency SLA. The existing MiniMax synthesis timing estimates still apply per character; actual runtime is recorded in `run.json`.
- Mistral `voxtral-mini-tts-2603` is priced at $0 input and $16 per 1M output characters, equivalent to 1.6 cents per 1K characters. AutoShow uses a provisional 6000 ms / 1K characters timing heuristic until benchmarked.
- OpenAI `gpt-4o-mini-tts` estimates use 60 cents / 1M input characters plus 1200 cents / 1M output characters, equivalent to 1.26 cents per 1K characters in AutoShow's character estimator. OpenAI custom voice creation adds a one-time 0 cent setup estimate and a 15000 ms setup timing estimate because OpenAI does not publish a separate custom voice creation fee or latency SLA. Example clone-mode estimates: 1,000 chars costs 1.26 cents and about 34.7 seconds; 5,000 chars costs 6.30 cents and about 113.3 seconds; 10,000 chars costs 12.60 cents and about 211.6 seconds.
- deAPI TTS price preflight calls `/api/v2/audio/speech/price` when `DEAPI_API_KEY` is available. Voice clone quotes send `mode: "voice_clone"` with `count_text`, `model`, `lang`, `speed`, `format`, and `sample_rate`; `voice` is not sent. Without a key, AutoShow falls back to the local registry rate of `$0.00077 / 1K characters` (`0.077¢ / 1K`, `$0.77 / 1M`). At `speed=1`, fallback examples are 1,000 chars: `$0.00077`, 5,000 chars: `$0.00385`, and 10,000 chars: `$0.00770`.
- deAPI `Qwen3_TTS_12Hz_1_7B_Base` uses a 10000 ms / 1K characters processing-time estimate, so 1,000 chars is about 10 seconds, 5,000 chars about 50 seconds, and 10,000 chars about 100 seconds. Actual runtime is recorded in `run.json`; provider price quotes are authoritative when available.

## Examples

```bash
# Default local Kitten TTS
bun as tts input/examples/tts/1-tts.md

# Local Kitten TTS with explicit model and speaker
bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-mini --kitten-voice Luna

# Hosted providers
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --openai-voice alloy
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --openai-voice voice_existing123
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --openai-tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123 --openai-tts-voice-name AutoShowAnthony
bun as tts input/examples/tts/1-tts.md --gemini-tts gemini-3.1-flash-tts-preview --gemini-voice Kore
bun as tts input/examples/tts/1-tts.md --grok-tts grok-tts --grok-tts-voice eve
bun as tts input/examples/tts/1-tts.md --minimax-tts speech-2.8-turbo --minimax-tts-voice English_expressive_narrator
bun as tts input/examples/tts/1-tts.md --minimax-tts speech-2.8-turbo --minimax-tts-ref-audio input/examples/audio/anthony-voice.mp3
bun as tts input/examples/tts/1-tts.md --minimax-tts speech-2.8-turbo --minimax-tts-ref-audio input/examples/audio/anthony-voice.mp3 --minimax-tts-voice AutoShowAnthony01 --price
bun as tts input/examples/tts/1-tts.md --mistral-tts voxtral-mini-tts-2603 --mistral-tts-voice voice_abc123
bun as tts input/examples/tts/1-tts.md --mistral-tts voxtral-mini-tts-2603 --mistral-tts-ref-audio input/examples/audio/anthony-voice.mp3
bun as tts input/examples/tts/1-tts.md --deepgram-tts aura-2-thalia-en --deepgram-voice aura-2-andromeda-en
bun as tts input/examples/tts/1-tts.md --runway-tts eleven_multilingual_v2 --runway-tts-voice Leslie
bun as tts input/examples/tts/1-tts.md --deapi-tts Kokoro
bun as tts input/examples/tts/1-tts.md --deapi-tts Kokoro --deapi-tts-voice af_heart --price
bun as tts input/examples/tts/1-tts.md --deapi-tts Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/anthony-voice-8-seconds.mp3
bun as tts input/examples/tts/1-tts.md --deapi-tts Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/0-audio-short.mp3 --deapi-tts-ref-text "Reference transcript"

# Gemini multispeaker dialogue
bun as tts input/examples/tts/tts-dialogue.txt \
  --gemini-tts gemini-3.1-flash-tts-preview \
  --gemini-speaker-1-name Host \
  --gemini-speaker-1-voice Kore \
  --gemini-speaker-2-name Guest \
  --gemini-speaker-2-voice Puck

# Multi-target run
bun as tts input/examples/tts/1-tts.md \
  --kitten-tts kitten-tts-mini \
  --openai-tts gpt-4o-mini-tts \
  --openai-voice alloy

# Same provider, multiple models
bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_v3 --elevenlabs-tts eleven_flash_v2_5
```

## Flags

| Flag | Description |
|------|-------------|
| `--kitten-tts <model>` | Select one or more Kitten TTS models; omit the value to use the cheapest supported model |
| `--kitten-voice <name>` | Select the Kitten speaker |
| `--elevenlabs-tts <model>` | Select one or more ElevenLabs models; omit the value to use the cheapest supported model |
| `--minimax-tts <model>` | Select one or more MiniMax models; omit the value to use the cheapest supported model |
| `--groq-tts <model>` | Select one or more Groq models; omit the value to use the cheapest supported model |
| `--grok-tts <model>` | Select one or more xAI Grok TTS models; omit the value to use `grok-tts` |
| `--mistral-tts <model>` | Select one or more Mistral Voxtral TTS models; omit the value to use the cheapest supported model |
| `--openai-tts <model>` | Select one or more OpenAI models; omit the value to use the cheapest supported model |
| `--gemini-tts <model>` | Select one or more Gemini models; omit the value to use the cheapest supported model |
| `--deepgram-tts <model>` | Select one or more Deepgram Aura models; omit the value to use the cheapest supported model |
| `--runway-tts <model>` | Select one or more Runway TTS models; omit the value to use the cheapest supported model |
| `--deapi-tts <model>` | Select one or more deAPI speech models; omit the value to use the cheapest supported model |
| `--elevenlabs-voice <id>` | Override the ElevenLabs voice ID |
| `--minimax-tts-voice <id>` | Override the MiniMax voice ID, or provide the custom clone `voice_id` when `--minimax-tts-ref-audio` is set |
| `--minimax-tts-ref-audio <path>` | Use local source audio for MiniMax rapid voice cloning |
| `--minimax-tts-prompt-audio <path>` | Optional MiniMax clone prompt audio; requires `--minimax-tts-prompt-text` |
| `--minimax-tts-prompt-text <text>` | Transcript for `--minimax-tts-prompt-audio` |
| `--minimax-tts-clone-noise-reduction` | Enable MiniMax clone noise reduction |
| `--minimax-tts-clone-volume-normalization` | Enable MiniMax clone volume normalization |
| `--groq-voice <id>` | Override the Groq voice ID |
| `--grok-tts-voice <id>` | Override the Grok voice ID (`eve`, `ara`, `rex`, `sal`, or `leo`) |
| `--mistral-tts-voice <id>` | Use a Mistral saved/custom voice ID |
| `--mistral-tts-ref-audio <path>` | Use local reference audio for one-off Mistral voice cloning |
| `--openai-voice <id>` | Override the OpenAI voice ID; `voice_...` values are sent as custom voice objects |
| `--openai-tts-ref-audio <path>` | Local sample audio used to create an OpenAI custom voice |
| `--openai-tts-consent-id <id>` | Reuse an existing OpenAI consent recording for custom voice creation |
| `--openai-tts-consent-audio <path>` | Upload a new OpenAI consent recording for custom voice creation |
| `--openai-tts-consent-language <tag>` | BCP 47 language tag for the consent recording; default `en-US` |
| `--openai-tts-consent-name <name>` | Consent recording label; defaults to the consent file name |
| `--openai-tts-voice-name <name>` | Created custom voice label; defaults to `AutoShow_<timestamp>` |
| `--gemini-voice <name>` | Override the Gemini voice name |
| `--deepgram-voice <model>` | Override the Deepgram API voice/model |
| `--runway-tts-voice <preset>` | Override the Runway preset voice |
| `--deapi-tts-voice <id>` | Override the deAPI voice ID |
| `--deapi-tts-ref-audio <path>` | Use local reference audio for deAPI `Qwen3_TTS_12Hz_1_7B_Base` voice cloning |
| `--deapi-tts-ref-text <text>` | Optional transcript for the deAPI reference audio |
| `--gemini-speaker-1-name <name>` | Gemini multispeaker speaker 1 label; requires all four Gemini speaker flags |
| `--gemini-speaker-1-voice <name>` | Gemini multispeaker speaker 1 voice; requires all four Gemini speaker flags |
| `--gemini-speaker-2-name <name>` | Gemini multispeaker speaker 2 label; requires all four Gemini speaker flags |
| `--gemini-speaker-2-voice <name>` | Gemini multispeaker speaker 2 voice; requires all four Gemini speaker flags |
| `--all-tts` | Select every supported TTS provider/model |
| `--price` | Show the aggregated estimate and exit |

## Gemini Multispeaker

- Gemini multispeaker mode is enabled only when all four `--gemini-speaker-*` flags are provided together.
- Do not combine the multispeaker flags with `--gemini-voice`.
- The input text must include explicit speaker labels such as `Host:` and `Guest:` that match the configured speaker names.
- Inline Gemini-style delivery tags like `[whispers]` or `[excitedly]` stay in the source text and are passed through unchanged.

## Output

- If exactly one TTS target succeeds, the run writes `speech.wav` plus `run.json`.
- If multiple TTS targets succeed, the run writes `speech-<service>-<sanitized-model>.wav` for each successful target plus `run.json`.
- MiniMax clone runs record `speaker: "ref_audio:<basename>"`, `clonedVoiceId`, and one `cloneCostCents: 150` entry in the Step 4 metadata.
- OpenAI custom voice creation runs record `speaker: "ref_audio:<basename>"`, `clonedVoiceId`, and `cloneCostCents: 0` in the Step 4 metadata.
- `run.json` includes `tts`, `cost`, and `timing` sections. `tts` is always an array, even when only one target succeeds.
- Reference-audio runs store only `speaker: "ref_audio:<basename>"`; the full path and reference transcript are not written to `run.json`.
