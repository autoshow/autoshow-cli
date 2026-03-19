# tts (services)

Generate speech audio from text input using service TTS APIs only.

## Outline

- [Usage](#usage)
- [Service TTS engines](#service-tts-engines)
- [Examples](#examples)
- [Flags](#flags)
- [Pricing](#pricing)
- [Output](#output)

## Usage

```bash
bun as tts <input> [flags]
```

`<input>` must be a `.md` or `.txt` file.

## Service TTS engines

| Engine | Selection | Models |
|--------|-----------|--------|
| ElevenLabs TTS | `--elevenlabs-tts <model>` | `eleven_v3`, `eleven_flash_v2_5`, `eleven_turbo_v2_5` |
| MiniMax TTS | `--minimax-tts <model>` | `speech-2.8-hd`, `speech-2.8-turbo` |
| Groq TTS | `--groq-tts <model>` | `canopylabs/orpheus-v1-english` |
| OpenAI TTS | `--openai-tts <model>` | `gpt-4o-mini-tts` |
| Gemini TTS | `--gemini-tts <model>` | `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` |

Exactly one service TTS engine flag must be set.

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
| `--elevenlabs-tts <model>` | ElevenLabs model |
| `--minimax-tts <model>` | MiniMax model |
| `--groq-tts <model>` | Groq model |
| `--openai-tts <model>` | OpenAI model |
| `--gemini-tts <model>` | Gemini model |
| `--elevenlabs-voice <id>` | ElevenLabs voice override |
| `--minimax-tts-voice <id>` | MiniMax voice override |
| `--groq-voice <id>` | Groq voice override |
| `--openai-voice <id>` | OpenAI voice override |
| `--gemini-voice <id>` | Gemini voice override |
| `--price` | Show cost estimate and exit |

## Pricing

- ElevenLabs: `$0.06` to `$0.12` per 1K chars by model
- MiniMax: `$0.06` to `$0.10` per 1K chars by model
- Gemini: `$0.0005` to `$0.001` per 1K chars by model
- Groq/OpenAI: dual-rate input/output pricing

## Output

Each run writes:
- `speech.wav`
- `metadata.json`

Service setup/env details are in [`text-to-speech-setup.md`](./text-to-speech-setup.md).
