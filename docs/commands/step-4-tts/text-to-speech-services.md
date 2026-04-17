# tts (services)

Generate speech audio from a local text file with a hosted TTS provider.

## Outline

- [Usage](#usage)
- [Service Engines](#service-engines)
- [Multi-Target Runs](#multi-target-runs)
- [Examples](#examples)
- [Flags](#flags)
- [Output](#output)

## Usage

```bash
bun as tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file.

## Service Engines

| Engine | Selection | Models |
|--------|-----------|--------|
| ElevenLabs | `--elevenlabs-tts <model>` | `eleven_v3`, `eleven_flash_v2_5`, `eleven_turbo_v2_5` |
| MiniMax | `--minimax-tts <model>` | `speech-2.8-hd`, `speech-2.8-turbo` |
| Groq | `--groq-tts <model>` | `canopylabs/orpheus-v1-english` |
| OpenAI | `--openai-tts <model>` | `gpt-4o-mini-tts` |
| Gemini | `--gemini-tts <model>` | `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` |

You can combine multiple hosted TTS provider flags in the same command.

Each provider flag accepts one model, so a single `tts` run can fan out across multiple providers, with one model per provider.

Provider-specific voice flags only affect their matching target.

## Multi-Target Runs

```bash
bun as tts input/examples/document/1-tts.md \
  --openai-tts gpt-4o-mini-tts \
  --openai-voice alloy \
  --gemini-tts gemini-2.5-flash-preview-tts \
  --gemini-voice Kore
```

This generates one speech file per successful target from the same input text.

## Examples

```bash
bun as tts input/examples/document/1-tts.md --openai-tts gpt-4o-mini-tts --openai-voice alloy
bun as tts input/examples/document/1-tts.md --gemini-tts gemini-2.5-flash-preview-tts --gemini-voice Kore
bun as tts input/examples/document/1-tts.md --groq-tts canopylabs/orpheus-v1-english --groq-voice hannah
bun as tts input/examples/document/1-tts.md --elevenlabs-tts eleven_v3 --elevenlabs-voice <voice-id>
bun as tts input/examples/document/1-tts.md --minimax-tts speech-2.8-hd --minimax-tts-voice <voice-id>
bun as tts input/examples/document/1-tts.md --openai-tts gpt-4o-mini-tts --gemini-tts gemini-2.5-flash-preview-tts
bun as tts input/examples/document/1-tts.md --openai-tts gpt-4o-mini-tts --gemini-tts gemini-2.5-pro-preview-tts --groq-tts canopylabs/orpheus-v1-english
```

## Flags

| Flag | Description |
|------|-------------|
| `--elevenlabs-tts <model>` | Select an ElevenLabs model |
| `--minimax-tts <model>` | Select a MiniMax model |
| `--groq-tts <model>` | Select a Groq model |
| `--openai-tts <model>` | Select an OpenAI model |
| `--gemini-tts <model>` | Select a Gemini model |
| `--elevenlabs-voice <id>` | Override the ElevenLabs voice ID |
| `--minimax-tts-voice <id>` | Override the MiniMax voice ID |
| `--groq-voice <id>` | Override the Groq voice ID |
| `--openai-voice <id>` | Override the OpenAI voice ID |
| `--gemini-voice <name>` | Override the Gemini voice name |
| `--price` | Show the estimate and exit |

## Output

If exactly one TTS target succeeds, the run writes:
- `speech.wav`
- `run.json`

If multiple TTS targets succeed, the run writes:
- `speech-<service>-<sanitized-model>.wav` for each successful target
- `run.json`

Examples:
- `speech-openai-gpt-4o-mini-tts.wav`
- `speech-gemini-gemini-2.5-flash-preview-tts.wav`

`run.json` includes `tts`, `cost`, and `timing` sections. `tts` is always an array, even when only one target succeeds.

Service setup details are in [`text-to-speech-local.md#setup`](./text-to-speech-local.md#setup).
