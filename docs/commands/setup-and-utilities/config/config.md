# config

View or set persistent CLI defaults saved to `config/autoshow.json`.

## Outline

- [Usage](#usage)
- [Config file location](#config-file-location)
- [Subcommands](#subcommands)
  - [Show](#show)
  - [Reset](#reset)
  - [Set defaults](#set-defaults)
- [Examples](#examples)
- [Config schema](#config-schema)
  - [defaults.stt](#defaultsstt)
  - [defaults.llm](#defaultsllm)
  - [defaults.post.tts](#defaultsposttts)
  - [defaults.post.image](#defaultspostimage)
  - [defaults.post.video](#defaultspostvideo)
  - [defaults.post.music](#defaultspostmusic)
  - [defaults.extract](#defaultsextract)
  - [defaults.batch](#defaultsbatch)
  - [defaults.prompts](#defaultsprompts)
  - [pricing](#pricing)
- [Precedence](#precedence)
- [Always-on preflight](#always-on-preflight)
- [Budget enforcement](#budget-enforcement)
- [LLM token estimation](#llm-token-estimation)
- [Recommended configs](#recommended-configs)
  - [All-local (free)](#all-local-free)
  - [All-service cheapest](#all-service-cheapest)
- [Flags](#flags)

## Usage

```bash
bun as config [flags]
bun as config --show
bun as config --reset
```

No input argument is required. Flags that are explicitly passed are persisted to the config file. Runtime-only flags (`--price`, `--allow-over-budget`) are never persisted.

## Config file location

Default path: `config/autoshow.json` in the project root (located by walking up to the nearest `package.json`).

Override with `--config-path <path>` (a global flag available on every command):

```bash
bun as config --show --config-path /tmp/my-autoshow.json
bun as write input/audio.mp3 --config-path /tmp/my-autoshow.json
```

## Subcommands

### Show

Print the resolved config path and current effective config:

```bash
bun as config --show
```

### Reset

Clear the config file back to an empty object:

```bash
bun as config --reset
```

### Set defaults

Pass any provider, model, or generation flag to persist it as a default:

```bash
bun as config --openai gpt-5.4
bun as config --whisper large-v3-turbo
bun as config --gcloud-stt chirp_3
bun as config --aws-stt standard --aws-region us-east-1 --aws-bucket my-transcribe-bucket
bun as config --kitten-tts kitten-tts-mini --kitten-voice Jasper
bun as config --batch-limit 20 --batch-order oldest
bun as config --max-cents 100
```

Model-selecting flags are repeatable. Repeating the same provider flag saves all selected models in first-seen order:

```bash
bun as config --speechmatics-stt standard --speechmatics-stt enhanced
bun as config --openai gpt-5.4 --openai gpt-5.4-mini
```

These model defaults are written as arrays in `config/autoshow.json`. Older config files that still store a single string are accepted and normalized to one-element arrays when loaded.

When you run `bun as setup --gcloud --gcloud-project PROJECT_ID`, AutoShow also saves `gcloudStt: ["chirp_3"]` automatically if no Google STT default has been saved yet, whether the project already existed or AutoShow created it during setup.

Only flags that are explicitly typed on the command line are written. Flags with Clerc-supplied defaults that you did not type are not persisted.

## Examples

```bash
bun as config --show
```

```bash
bun as config --openai gpt-5.4 --openai gpt-5.4-mini --whisper large-v3-turbo
```

```bash
bun as config --max-cents 50
```

```bash
bun as config --reset
```

```bash
bun as config --show --config-path /tmp/as-config.json
bun as config --minimax-music music-2.5 --config-path /tmp/as-config.json
```

## Config schema

Representative JSON shape of `config/autoshow.json`:

```json
{
  "version": 2,
  "defaults": {
    "stt": {
      "whisper": ["tiny"],
      "gcloudStt": ["chirp_3"],
      "awsStt": ["standard"],
      "awsRegion": "us-east-1",
      "awsBucket": "my-transcribe-bucket",
      "groqStt": ["whisper-large-v3-turbo"],
      "elevenlabsStt": ["scribe_v2"],
      "deepgramStt": ["nova-3"],
      "sonioxStt": ["stt-async-v4"],
      "revStt": ["machine"],
      "speechmaticsStt": ["standard", "enhanced"],
      "mistralStt": ["voxtral-mini-2602"],
      "assemblyaiStt": ["universal-3-pro"],
      "gladiaStt": ["default"],
      "happyscribeStt": ["auto"],
      "happyscribeOrganizationId": "org_123",
      "speakerCount": 2,
      "split": false,
      "reverbVerbatimicity": 0.5
    },
    "llm": {
      "llama": ["ggml-org/gemma-3-270m-it-GGUF"],
      "openai": ["gpt-5.4", "gpt-5.4-mini"],
      "groq": ["openai/gpt-oss-20b"],
      "gemini": ["gemini-3.1-flash-lite-preview"],
      "anthropic": ["claude-sonnet-4-6"],
      "minimax": ["MiniMax-M2.5"],
      "grok": ["grok-4.20-non-reasoning"]
    },
    "post": {
      "tts": {
        "kittenTts": ["kitten-tts-mini"],
        "ttsSpeaker": "Jasper"
      },
      "image": {
        "geminiImage": ["imagen-4.0-generate-001"],
        "imagenCount": 1
      },
      "video": {
        "geminiVideo": ["veo-3.1-fast-generate-preview"],
        "videoDuration": 8
      },
      "music": {
        "minimaxMusic": ["music-2.5"],
        "musicDuration": 30
      }
    },
    "extract": {
      "lang": "eng",
      "out": "text",
      "dpi": 300,
      "psm": 3,
      "oem": 1,
      "rotate": 0,
      "mistralOcr": ["mistral-ocr-2512"]
    },
    "batch": {
      "limit": 5,
      "order": "newest",
      "concurrency": 1
    },
    "prompts": ["shortSummary", "chapters"]
  },
  "pricing": {
    "maxCents": 100
  }
}
```

### defaults.stt

Model-selecting fields in this section are arrays of models, not single strings.

| Field | Flag | Description |
|-------|------|-------------|
| `whisper` | `--whisper` | Default Whisper model list |
| `gcloudStt` | `--gcloud-stt` | Default Google Cloud STT model list |
| `awsStt` | `--aws-stt` | Default AWS Transcribe model list |
| `awsRegion` | `--aws-region` | Default AWS region for AWS CLI Transcribe jobs |
| `awsBucket` | `--aws-bucket` | Default S3 bucket for AWS CLI Transcribe input/output staging |
| `groqStt` | `--groq-stt` | Default Groq STT model list |
| `elevenlabsStt` | `--elevenlabs-stt` | Default ElevenLabs STT model list |
| `deepgramStt` | `--deepgram-stt` | Default Deepgram STT model list |
| `sonioxStt` | `--soniox-stt` | Default Soniox STT model list |
| `speechmaticsStt` | `--speechmatics-stt` | Default Speechmatics STT model list |
| `revStt` | `--rev-stt` | Default Rev STT model list |
| `mistralStt` | `--mistral-stt` | Default Mistral STT model list |
| `assemblyaiStt` | `--assemblyai-stt` | Default AssemblyAI STT model list |
| `gladiaStt` | `--gladia-stt` | Default Gladia STT model list |
| `happyscribeStt` | `--happyscribe-stt` | Default Happy Scribe STT model list |
| `happyscribeOrganizationId` | `--happyscribe-organization-id` | Default Happy Scribe organization/workspace ID |
| `speakerCount` | `--speaker-count` | Optional diarization speaker count hint for Google Cloud, AWS, ElevenLabs, AssemblyAI, and Gladia; Deepgram, Happy Scribe, Soniox, Speechmatics, Rev, and Mistral ignore count-only hints |
| `split` | `--split` | Split audio into 10-minute chunks |
| `reverbVerbatimicity` | `--reverb-verbatimicity` | Reverb output style (0–1) |

### defaults.llm

Model-selecting fields in this section are arrays of models, not single strings.

| Field | Flag | Description |
|-------|------|-------------|
| `llama` | `--llama` | Default llama.cpp model list |
| `openai` | `--openai` | Default OpenAI model list |
| `groq` | `--groq` | Default Groq LLM model list |
| `gemini` | `--gemini` | Default Gemini model list |
| `anthropic` | `--anthropic` | Default Anthropic model list |
| `minimax` | `--minimax` | Default MiniMax model list |
| `grok` | `--grok` | Default Grok model list |

### defaults.post.tts

Model-selecting fields in this section are arrays of models, not single strings.

| Field | Flag | Description |
|-------|------|-------------|
| `kittenTts` | `--kitten-tts` | Kitten TTS model |
| `elevenlabsTts` | `--elevenlabs-tts` | ElevenLabs TTS model |
| `minimaxTts` | `--minimax-tts` | MiniMax TTS model |
| `groqTts` | `--groq-tts` | Groq TTS model |
| `openaiTts` | `--openai-tts` | OpenAI TTS model |
| `geminiTts` | `--gemini-tts` | Gemini TTS model |
| `ttsSpeaker` | `--kitten-voice` | Kitten speaker name |
| `groqVoice` | `--groq-voice` | Groq voice ID |
| `elevenlabsVoice` | `--elevenlabs-voice` | ElevenLabs voice ID |
| `openaiVoice` | `--openai-voice` | OpenAI TTS voice ID |
| `geminiVoice` | `--gemini-voice` | Gemini TTS voice name |
| `minimaxTtsVoice` | `--minimax-tts-voice` | MiniMax TTS voice ID |

### defaults.post.image

Model-selecting fields in this section are arrays of models, not single strings.

| Field | Flag | Description |
|-------|------|-------------|
| `geminiImage` | `--gemini-image` | Gemini image model |
| `openaiImage` | `--openai-image` | OpenAI image model |
| `minimaxImage` | `--minimax-image` | MiniMax image model |
| `imageAspectRatio` | `--image-aspect-ratio` | Aspect ratio |
| `imageSize` | `--image-size` | Image size |
| `imageQuality` | `--image-quality` | Quality level |
| `imageFormat` | `--image-format` | Output format |
| `imageBackground` | `--image-background` | Background style |
| `imagenCount` | `--imagen-count` | Number of images (Imagen 4) |

### defaults.post.video

Model-selecting fields in this section are arrays of models, not single strings.

| Field | Flag | Description |
|-------|------|-------------|
| `geminiVideo` | `--gemini-video` | Gemini Veo model |
| `minimaxVideo` | `--minimax-video` | MiniMax video model |
| `videoDuration` | `--video-duration` | Duration in seconds |
| `videoSize` | `--video-size` | Size string |
| `videoAspectRatio` | `--video-aspect-ratio` | Aspect ratio |
| `videoResolution` | `--video-resolution` | Resolution |

### defaults.post.music

Model-selecting fields in this section are arrays of models, not single strings.

| Field | Flag | Description |
|-------|------|-------------|
| `elevenlabsMusic` | `--elevenlabs-music` | ElevenLabs music model |
| `minimaxMusic` | `--minimax-music` | MiniMax music model |
| `musicDuration` | `--music-duration` | Duration in seconds |

### defaults.extract

Model-selecting OCR fields in this section are arrays of models, not single strings.

| Field | Flag | Description |
|-------|------|-------------|
| `lang` | `--lang` | Tesseract language(s) |
| `out` | `--out` | Output format: `text`, `json`, `tsv`, `hocr` |
| `dpi` | `--dpi` | Render DPI |
| `psm` | `--psm` | Page segmentation mode |
| `oem` | `--oem` | OCR engine mode |
| `rotate` | `--rotate` | Page rotation in degrees |
| `mistralOcr` | `--mistral-ocr` | Default Mistral OCR model list |
| `glmOcr` | `--glm-ocr` | Default GLM OCR model list |

### defaults.batch

| Field | Flag | Description |
|-------|------|-------------|
| `limit` | `--batch-limit` | Number of items to process |
| `order` | `--batch-order` | `newest` or `oldest` |
| `concurrency` | `--batch-concurrency` | Concurrent item count |

### defaults.prompts

An array of named prompt keys to use by default when no `--prompt` flag is passed:

```bash
bun as config --prompt shortSummary --prompt chapters
```

Saved as `["shortSummary", "chapters"]` in `defaults.prompts`.

### pricing

| Field | Flag | Description |
|-------|------|-------------|
| `maxCents` | `--max-cents` | Hard budget limit in cents |

## Precedence

```
Explicit CLI flags > config file defaults > Clerc framework defaults
```

Only flags explicitly typed on the command line override config values. Flags that Clerc auto-populates with default values (e.g. `--whisper tiny` when `--whisper` is not typed) do not override config defaults.

If you type any provider/model flag for a step family at runtime, the configured provider selections for that family are replaced instead of merged. For example, passing `--openai ...` on `write` suppresses configured `defaults.llm.gemini` / `defaults.llm.groq` entries for that run.

## Always-on preflight

Every runnable command (`download`, `stt`, `write`, `ocr`, `tts`, `image`, `music`, `video`) runs a cost preflight automatically before executing. The estimate is logged to the console.

To show the estimate and exit without running the pipeline, pass `--price`:

```bash
bun as write input/audio.mp3 --price
```

## Budget enforcement

Set `pricing.maxCents` to hard-fail any command whose estimate exceeds the limit:

```bash
bun as config --max-cents 50
```

When the estimate exceeds the limit the command fails before execution:

```
Estimated cost $0.7200 exceeds configured budget $0.5000. Use --allow-over-budget to proceed.
```

To continue despite the budget limit, pass `--allow-over-budget` at runtime:

```bash
bun as write input/audio.mp3 --allow-over-budget
```

`--allow-over-budget` is never persisted to the config file.

## LLM token estimation

LLM preflight estimates are prompt-driven from `src/prompts/entries/*.json`.
Each leaf prompt defines:

- `expectedInputTokens`
- `expectedOutputTokens`

- **Input tokens** = sum of `expectedInputTokens` for expanded unique selected prompts
- **Output tokens** = sum of `expectedOutputTokens` for expanded unique selected prompts
- **LLM cost** = `(inputTokens / 1M) × inputCostPer1M + (outputTokens / 1M) × outputCostPer1M`

`default` expands to `shortSummary + longSummary + chapters`.

Example output:

```
Cost Estimate
────────────────────────────────────────────────────────────
  STT      whisper/large
           Cost: $0.0000
  LLM      openai/gpt-5.4
           Rate: $2.00/1M input, $8.00/1M output
           Est. tokens: 1000 input, 2300 output
           Est. cost: $0.0204
────────────────────────────────────────────────────────────
  Total estimated cost: $0.0204
```

## Recommended configs

### All-local (free)

Every step runs entirely on-device with no API calls. Image, video, and music have no local option and are omitted.

| Step | Provider | Model | Cost |
|------|----------|-------|------|
| STT | Whisper | `tiny` | $0/hr |
| LLM | llama.cpp | `ggml-org/gemma-3-270m-it-GGUF` | $0/1M tokens |
| TTS | Kitten TTS | `kitten-tts-nano-0.8-int8` | $0/1K chars |
| Image | — | no local option | — |
| Video | — | no local option | — |
| Music | — | no local option | — |

```bash
bun as config \
  --whisper tiny \
  --llama ggml-org/gemma-3-270m-it-GGUF \
  --kitten-tts kitten-tts-nano-0.8-int8
```

### All-service cheapest

The cheapest paid API option per step. MiniMax dominates four of six categories.

| Step | Provider | Model | Cost |
|------|----------|-------|------|
| STT | Groq | `whisper-large-v3-turbo` | $0.04/hr |
| LLM | Groq | `openai/gpt-oss-20b` | $0.075/1M input, $0.30/1M output |
| TTS | MiniMax | `speech-2.8-turbo` | $0.06/1K chars |
| Image | MiniMax | `image-01` | $0.0035/image |
| Video | MiniMax | `T2V-01` | $0.19/6-second block |
| Music | MiniMax | `music-2.5` | $0.15/track |

```bash
bun as config \
  --groq-stt whisper-large-v3-turbo \
  --groq openai/gpt-oss-20b \
  --minimax-tts speech-2.8-turbo \
  --minimax-image image-01 \
  --minimax-video T2V-01 \
  --minimax-music music-2.5
```

Notable findings from the full pricing comparison:

- Groq LLM (`openai/gpt-oss-20b`) at $0.075/1M input, $0.30/1M output is the cheapest paid service LLM
- MiniMax image at $0.0035/image is roughly 6× cheaper than the next cheapest (OpenAI `gpt-image-1-mini` at $0.02/image)
- MiniMax music at $0.15/track vs ElevenLabs at $0.28/minute — MiniMax is cheaper for typical track lengths
- Groq STT `whisper-large-v3-turbo` at $0.04/hr vs `whisper-large-v3` at $0.111/hr — turbo is 2.8× cheaper for comparable quality

## Flags

| Flag | Type | Description |
|------|------|-------------|
| `--show` | boolean | Print resolved config path and effective config |
| `--reset` | boolean | Clear the config file |
| `--config-path` | string | Path to config file (global, all commands) |
| `--allow-over-budget` | boolean | Continue when estimate exceeds the configured budget (global, never persisted) |
| `--verbose` | boolean | Enable debug-level logging (global, overrides AUTOSHOW_LOG_LEVEL) |
| `--quiet` / `-q` | boolean | Suppress all output except errors (global, overrides AUTOSHOW_LOG_LEVEL) |
| `--json` | boolean | Output logs as JSON (global, overrides AUTOSHOW_LOG_FORMAT) |
| `--max-cents` | number | Budget limit in cents |
| All provider/model flags | string | Same surface as `write`, `tts`, `image`, `music`, `video` |
