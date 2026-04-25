# tts

Generate speech audio from a local `.md` or `.txt` file with local or hosted TTS providers.

## Outline

- [Setup](#setup)
- [Usage](#usage)
- [Engines](#engines)
- [Examples](#examples)
- [Flags](#flags)
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
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
DEEPGRAM_API_KEY=...
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
| OpenAI | `--openai-tts <model>` | `gpt-4o-mini-tts` | `--openai-voice`, default `alloy` |
| Gemini | `--gemini-tts <model>` | `gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` | `--gemini-voice`, default `Kore` |
| Deepgram | `--deepgram-tts <model>` | `aura-2-thalia-en`, `aura-2-andromeda-en`, `aura-2-apollo-en`, `aura-2-arcas-en`, `aura-2-asteria-en`, `aura-2-athena-en`, `aura-2-helena-en`, `aura-2-aries-en` | `--deepgram-voice`, default selected model |

If no engine flag is provided, `tts` defaults to Kitten TTS with `kitten-tts-nano-0.8-int8`.

You can combine multiple TTS targets in one run. Each successful target writes its own output file.
Model-selecting flags are repeatable, including repeated flags from the same provider. Shared voice flags apply to every selected model for that provider. `--all-tts` expands to every supported TTS provider/model, including Deepgram.

## Examples

```bash
# Default local Kitten TTS
bun as tts input/examples/tts/1-tts.md

# Local Kitten TTS with explicit model and speaker
bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-mini --kitten-voice Luna

# Hosted providers
bun as tts input/examples/tts/1-tts.md --openai-tts gpt-4o-mini-tts --openai-voice alloy
bun as tts input/examples/tts/1-tts.md --gemini-tts gemini-3.1-flash-tts-preview --gemini-voice Kore
bun as tts input/examples/tts/1-tts.md --deepgram-tts aura-2-thalia-en --deepgram-voice aura-2-andromeda-en

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
| `--openai-tts <model>` | Select one or more OpenAI models; omit the value to use the cheapest supported model |
| `--gemini-tts <model>` | Select one or more Gemini models; omit the value to use the cheapest supported model |
| `--deepgram-tts <model>` | Select one or more Deepgram Aura models; omit the value to use the cheapest supported model |
| `--elevenlabs-voice <id>` | Override the ElevenLabs voice ID |
| `--minimax-tts-voice <id>` | Override the MiniMax voice ID |
| `--groq-voice <id>` | Override the Groq voice ID |
| `--openai-voice <id>` | Override the OpenAI voice ID |
| `--gemini-voice <name>` | Override the Gemini voice name |
| `--deepgram-voice <model>` | Override the Deepgram API voice/model |
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
