# tts (services)

Generate speech audio from a local text file with a hosted TTS provider.

## Outline

- [Usage](#usage)
- [Service Engines](#service-engines)
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

For hosted TTS usage, pass exactly one of these provider flags.

## Examples

```bash
bun as tts input/1-tts.md --openai-tts gpt-4o-mini-tts --openai-voice alloy
bun as tts input/1-tts.md --gemini-tts gemini-2.5-flash-preview-tts --gemini-voice Kore
bun as tts input/1-tts.md --groq-tts canopylabs/orpheus-v1-english --groq-voice hannah
bun as tts input/1-tts.md --elevenlabs-tts eleven_v3 --elevenlabs-voice <voice-id>
bun as tts input/1-tts.md --minimax-tts speech-2.8-hd --minimax-tts-voice <voice-id>
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

Each standalone `tts` run writes:
- `speech.wav`
- `metadata.json`

`metadata.json` includes `tts`, `cost`, and `timing` sections.

Service setup details are in [`text-to-speech-local.md#setup`](./text-to-speech-local.md#setup).
