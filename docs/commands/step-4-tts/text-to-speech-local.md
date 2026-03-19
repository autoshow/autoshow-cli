# tts (local)

Generate speech audio from local text using Kitten TTS.

## Outline

- [Usage](#usage)
- [Local TTS engine](#local-tts-engine)
- [Examples](#examples)
- [Flags](#flags)
- [Pricing](#pricing)
- [Output](#output)

## Usage

```bash
bun as tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file.

## Local TTS engine

| Engine | Selection | Models |
|--------|-----------|--------|
| Kitten TTS | `--kitten-tts <model>` | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |

If no TTS engine flag is set, `tts` defaults to Kitten TTS (`kitten-tts-nano-0.8-int8`).

## Examples

```bash
bun as tts input/1-tts.md --kitten-tts kitten-tts-mini --tts-speaker Jasper
bun as tts input/1-tts.md
```

## Flags

| Flag | Description |
|------|-------------|
| `--kitten-tts <model>` | Kitten model |
| `--tts-speaker <name>` | Kitten voice/speaker |
| `--price` | Show cost estimate and exit |

## Pricing

- Local TTS providers: `$0`.

## Output

Each run writes:
- `speech.wav`
- `metadata.json`

Local setup/runtime details are in [`text-to-speech-setup.md`](./text-to-speech-setup.md).
