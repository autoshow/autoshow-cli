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
| MiniMax | `--minimax-tts <model>` | `speech-2.8-hd`, `speech-2.8-turbo` | `--minimax-tts-voice`, default `English_expressive_narrator` |
| Groq | `--groq-tts <model>` | `canopylabs/orpheus-v1-english` | `--groq-voice`, default `troy` |
| Grok | `--grok-tts <model>` | `grok-tts` | `--grok-tts-voice`, default `eve`; voices `eve`, `ara`, `rex`, `sal`, `leo` |
| Mistral | `--mistral-tts <model>` | `voxtral-mini-tts-2603` | exactly one of `--mistral-tts-voice` or `--mistral-tts-ref-audio` |
| OpenAI | `--openai-tts <model>` | `gpt-4o-mini-tts` | `--openai-voice`, default `alloy` |
| Gemini | `--gemini-tts <model>` | `gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` | `--gemini-voice`, default `Kore` |
| Deepgram | `--deepgram-tts <model>` | `aura-2-thalia-en`, `aura-2-andromeda-en`, `aura-2-apollo-en`, `aura-2-arcas-en`, `aura-2-asteria-en`, `aura-2-athena-en`, `aura-2-helena-en`, `aura-2-aries-en` | `--deepgram-voice`, default selected model |
| Runway | `--runway-tts <model>` | `eleven_multilingual_v2` | `--runway-tts-voice`, default `Leslie` |
| deAPI | `--deapi-tts <model>` | `Kokoro`, `Chatterbox`, `Qwen3_TTS_12Hz_1_7B_CustomVoice`, `Qwen3_TTS_12Hz_1_7B_Base`, `Qwen3_TTS_12Hz_1_7B_VoiceDesign` | `--deapi-tts-voice`, default `af_heart` for Kokoro |

If no engine flag is provided, `tts` defaults to Kitten TTS with `kitten-tts-nano-0.8-int8`.

You can combine multiple TTS targets in one run. Each successful target writes its own output file.
Model-selecting flags are repeatable, including repeated flags from the same provider. Shared voice flags apply to every selected model for that provider. `--all-tts` expands to every supported TTS provider/model, including Grok, Mistral, Deepgram, Runway, and runnable deAPI models.

Mistral Voxtral TTS requires one voice source when generating audio: a saved/custom voice ID or a one-off local reference audio file. `--price` can estimate Mistral TTS with only `--mistral-tts` because no synthesis request is made. Reference audio is base64-encoded for the request and is not written into run metadata; metadata records the speaker as `ref_audio:<basename>`.

deAPI `Qwen3_TTS_12Hz_1_7B_Base` and `Qwen3_TTS_12Hz_1_7B_VoiceDesign` are listed in the catalog, but execution rejects them until the CLI has first-class flags for their required reference audio or voice-design instructions. `--all-tts` selects only runnable deAPI models.

## Pricing Notes

- Runway `eleven_multilingual_v2` is priced at 1 credit per 50 input characters. AutoShow treats 1 credit as 1 cent, so the equivalent rate is 20 cents per 1K characters.
- Runway TTS estimates use exact block rounding: `ceil(characterCount / 50) * 1¢`, so 1-50 characters cost 1¢ and 51-100 characters cost 2¢.
- Runway does not publish a TTS processing-time SLA in the local reference, so AutoShow uses a 10000 ms / 1K characters timing heuristic.
- Mistral `voxtral-mini-tts-2603` is priced at $0 input and $16 per 1M output characters, equivalent to 1.6 cents per 1K characters. AutoShow uses a provisional 6000 ms / 1K characters timing heuristic until benchmarked.

## Examples

```bash
# Default local Kitten TTS
bun as tts input/examples/tts/1-tts.md

# Local Kitten TTS with explicit model and speaker
bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-mini --kitten-voice Luna

# Hosted providers
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --openai-voice alloy
bun as tts input/examples/tts/1-tts.md --gemini-tts gemini-3.1-flash-tts-preview --gemini-voice Kore
bun as tts input/examples/tts/1-tts.md --grok-tts grok-tts --grok-tts-voice eve
bun as tts input/examples/tts/1-tts.md --mistral-tts voxtral-mini-tts-2603 --mistral-tts-voice voice_abc123
bun as tts input/examples/tts/1-tts.md --mistral-tts voxtral-mini-tts-2603 --mistral-tts-ref-audio input/examples/audio/anthony-voice.mp3
bun as tts input/examples/tts/1-tts.md --deepgram-tts aura-2-thalia-en --deepgram-voice aura-2-andromeda-en
bun as tts input/examples/tts/1-tts.md --runway-tts eleven_multilingual_v2 --runway-tts-voice Leslie
bun as tts input/examples/tts/1-tts.md --deapi-tts Kokoro
bun as tts input/examples/tts/1-tts.md --deapi-tts Kokoro --deapi-tts-voice af_heart --price

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
| `--minimax-tts-voice <id>` | Override the MiniMax voice ID |
| `--groq-voice <id>` | Override the Groq voice ID |
| `--grok-tts-voice <id>` | Override the Grok voice ID (`eve`, `ara`, `rex`, `sal`, or `leo`) |
| `--mistral-tts-voice <id>` | Use a Mistral saved/custom voice ID |
| `--mistral-tts-ref-audio <path>` | Use local reference audio for one-off Mistral voice cloning |
| `--openai-voice <id>` | Override the OpenAI voice ID |
| `--gemini-voice <name>` | Override the Gemini voice name |
| `--deepgram-voice <model>` | Override the Deepgram API voice/model |
| `--runway-tts-voice <preset>` | Override the Runway preset voice |
| `--deapi-tts-voice <id>` | Override the deAPI voice ID |
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
- `run.json` includes `tts`, `cost`, and `timing` sections. `tts` is always an array, even when only one target succeeds.
