# config

View or set persistent CLI defaults saved to `config/autoshow.json`.

## Outline

- [Usage](#usage)
- [Config File Location](#config-file-location)
- [Setting Defaults](#setting-defaults)
- [Config Schema](#config-schema)
- [Persisted Defaults](#persisted-defaults)
- [Precedence](#precedence)
- [Pricing And Budgets](#pricing-and-budgets)
- [Recommended Configs](#recommended-configs)
- [Flags](#flags)

## Usage

```bash
bun as config [flags]
bun as config --show
bun as config --reset
```

No input argument is required. Flags that are explicitly passed are persisted to the config file. Runtime-only flags such as `--price`, `--allow-over-budget`, `--show`, `--reset`, `--config-path`, and setup-only voice-clone verification flags are never persisted.

## Config File Location

Default path: `config/autoshow.json` in the project root, located by walking up to the nearest `package.json`.

Override with `--config-path <path>`:

```bash
bun as config --show --config-path ./input/my-autoshow.json
bun as write input/examples/audio/1-audio.mp3 --config-path ./input/my-autoshow.json
```

## Setting Defaults

```bash
bun as config --openai gpt-5.4
bun as config --glm glm-5.1
bun as config --kimi kimi-k2.6
bun as config --whisper-stt large-v3-turbo
bun as config --gcloud-stt chirp_3
bun as config --aws-stt standard --aws-region us-east-1 --aws-bucket my-transcribe-bucket
bun as config --kitten-tts kitten-tts-mini --kitten-voice Jasper
bun as config --elevenlabs-tts eleven_flash_v2_5 --elevenlabs-tts-ref-audio input/examples/audio/anthony-voice.mp3
bun as config --openai-tts gpt-4o-mini-tts --openai-tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123
bun as config --speechify-tts simba-english --speechify-voice george
bun as config --gcloud-tts chirp3-hd --gcloud-tts-voice en-US-Chirp3-HD-Achernar
bun as config --batch-limit 20 --batch-order oldest
bun as config --max-cents 100
```

Model-selecting flags are repeatable. Repeating a provider flag saves all selected models in first-seen order:

```bash
bun as config --speechmatics-stt standard --speechmatics-stt enhanced
bun as config --openai gpt-5.4 --openai gpt-5.4-mini
```

Setup commands do not write `config/autoshow.json`. Use `bun as config ...` when you want AWS, Google Cloud, or provider defaults to persist.

## Config Schema

Representative JSON shape:

```json
{
  "defaults": {
    "extract": {
      "stt": {
        "whisper": ["large-v3-turbo"],
        "gcloudStt": ["chirp_3"],
        "awsStt": ["standard"],
        "deepinfraStt": ["openai/whisper-large-v3-turbo"],
        "deapiStt": ["WhisperLargeV3"],
        "groqStt": ["whisper-large-v3-turbo"],
        "openaiStt": ["gpt-4o-mini-transcribe"],
        "geminiStt": ["gemini-3-flash-preview"],
        "glmStt": ["glm-asr-2512"],
        "speakerCount": 2,
        "providerConcurrency": 2,
        "localConcurrency": 1
      },
      "ocr": {
        "lang": "eng",
        "out": "text",
        "dpi": 300,
        "mistralOcr": ["mistral-ocr-2512"],
        "openaiOcr": ["gpt-5.4-nano"],
        "deepinfraOcr": ["Qwen/Qwen3-VL-30B-A3B-Instruct"],
        "awsTextract": ["detect-text"],
        "gcloudDocai": ["ocr"],
        "deapiOcr": ["Nanonets_Ocr_S_F16"]
      }
    },
    "llm": {
      "openai": ["gpt-5.4", "gpt-5.4-mini"],
      "groq": ["openai/gpt-oss-20b"],
      "glm": ["glm-5.1"],
      "kimi": ["kimi-k2.6"],
      "providerConcurrency": 2,
      "localConcurrency": 1
    },
    "post": {
      "tts": {
        "kittenTts": ["kitten-tts-mini"],
        "openaiTts": ["gpt-4o-mini-tts"],
        "speechifyTts": ["simba-english"],
        "gcloudTts": ["chirp3-hd"],
        "deapiTts": ["Qwen3_TTS_12Hz_1_7B_Base"]
      },
      "image": {
        "geminiImage": ["imagen-4.0-generate-001"],
        "bflImage": ["flux-2-pro-preview"],
        "deapiImage": ["Flux1schnell"],
        "imageSize": "1024x1024"
      },
      "video": {
        "geminiVideo": ["veo-3.1-fast-generate-preview"],
        "minimaxVideo": ["MiniMax-Hailuo-2.3"],
        "videoDuration": 8
      },
      "music": {
        "elevenlabsMusic": ["music_v1"],
        "minimaxMusic": ["music-2.5"],
        "musicDuration": 30
      }
    },
    "batch": {
      "limit": 5,
      "order": "newest",
      "concurrency": 1
    },
    "prompts": ["shortSummary", "longChapters"]
  },
  "pricing": {
    "maxCents": 100
  }
}
```

## Persisted Defaults

Model-selecting fields are arrays of models, not single strings.

### defaults.extract.stt

| Field | Flag |
|-------|------|
| `whisper` | `--whisper-stt` |
| `reverb` | `--reverb-stt` |
| `youtubeCaptions` | `--youtube-captions` |
| `gcloudStt`, `awsStt`, `deepinfraStt`, `deapiStt` | `--gcloud-stt`, `--aws-stt`, `--deepinfra-stt`, `--deapi-stt` |
| `groqStt`, `grokStt`, `elevenlabsStt`, `deepgramStt` | `--groq-stt`, `--grok-stt`, `--elevenlabs-stt`, `--deepgram-stt` |
| `sonioxStt`, `speechmaticsStt`, `revStt`, `mistralStt` | `--soniox-stt`, `--speechmatics-stt`, `--rev-stt`, `--mistral-stt` |
| `assemblyaiStt`, `gladiaStt`, `happyscribeStt`, `supadataStt` | `--assemblyai-stt`, `--gladia-stt`, `--happyscribe-stt`, `--supadata-stt` |
| `openaiStt`, `geminiStt`, `glmStt` | matching provider flags |
| `awsRegion`, `awsBucket`, `happyscribeOrganizationId`, `supadataLang` | matching provider option flags |
| `speakerCount`, `split`, `reverbVerbatimicity` | `--speaker-count`, `--split`, `--reverb-verbatimicity` |
| `providerConcurrency`, `localConcurrency`, `segmentConcurrency`, `preflightConcurrency` | STT concurrency flags |
| `refreshCache`, `noCache` | `--refresh-cache`, `--no-cache` |

`--together-stt` and `--cloudflare-stt` are runtime STT flags and appear in generated config help, but the current persisted config schema does not validate those defaults. Use them on `extract` or `write` directly until schema support is added.

### defaults.extract.ocr

| Field | Flag |
|-------|------|
| `tesseract`, `ocrmypdf`, `paddleOcr` | `--tesseract-ocr`, `--ocrmypdf`, `--paddle-ocr` |
| `mistralOcr`, `glmOcr`, `kimiOcr`, `openaiOcr`, `anthropicOcr`, `geminiOcr`, `deepinfraOcr`, `awsTextract`, `gcloudDocai`, `deapiOcr` | matching OCR provider flags |
| `lang`, `out`, `dpi`, `psm`, `oem`, `rotate`, `pageSeparator`, `preserveSpaces` | matching OCR tuning flags |
| `providerConcurrency`, `localConcurrency` | `--ocr-provider-concurrency`, `--ocr-local-concurrency` |
| `chapters`, `length`, `pdfChapterMode` | `--chapters`, `--length`, `--pdf-chapter-mode` |

Google Cloud Document AI runtime fields such as processor IDs, location, and bucket are accepted by the schema, but `bun as setup --gcloud` prints those values instead of saving them. Persist model defaults with `bun as config --gcloud-docai ocr`; set the printed runtime values with environment variables or by editing the config intentionally.

### defaults.llm

| Field | Flag |
|-------|------|
| `llama`, `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi` | matching LLM provider flags |
| `providerConcurrency`, `localConcurrency` | `--llm-provider-concurrency`, `--llm-local-concurrency` |

### defaults.post.tts

| Field | Flag |
|-------|------|
| `kittenTts`, `elevenlabsTts`, `minimaxTts`, `groqTts`, `grokTts`, `mistralTts`, `openaiTts`, `geminiTts`, `deepgramTts`, `runwayTts`, `speechifyTts`, `gcloudTts`, `deapiTts` | matching TTS provider flags |
| `ttsSpeaker`, `groqVoice`, `grokTtsVoice`, `mistralTtsVoice`, `mistralTtsRefAudio` | matching voice/reference flags |
| `ttsDialogueFormat`, `ttsSpeakerRefAudio` | dialogue TTS flags |
| `openaiVoice`, `openaiTtsRefAudio`, `openaiTtsConsentId`, `openaiTtsConsentAudio`, `openaiTtsConsentLanguage`, `openaiTtsConsentName`, `openaiTtsVoiceName` | OpenAI voice flags |
| `geminiVoice`, `geminiSpeaker1Name`, `geminiSpeaker1Voice`, `geminiSpeaker2Name`, `geminiSpeaker2Voice` | Gemini voice and multispeaker flags |
| `elevenlabsVoice`, `elevenlabsTtsPvcVoice`, `elevenlabsTtsRefAudio`, `elevenlabsTtsVoiceName`, `elevenlabsTtsCloneRemoveBackgroundNoise` | ElevenLabs reusable voice/clone flags |
| `minimaxTtsVoice`, `minimaxTtsRefAudio`, `minimaxTtsPromptAudio`, `minimaxTtsPromptText`, `minimaxTtsCloneNoiseReduction`, `minimaxTtsCloneVolumeNormalization` | MiniMax voice/clone flags |
| `deepgramVoice`, `runwayTtsVoice`, `speechifyVoice`, `gcloudTtsVoice`, `gcloudTtsLanguage`, `gcloudTtsRefAudio`, `gcloudTtsConsentAudio`, `gcloudTtsConsentLanguage`, `deapiTtsVoice`, `deapiTtsRefAudio`, `deapiTtsRefText` | provider voice/reference flags |

PVC training samples, CAPTCHA output, Speechify custom-voice consent fields, and Google Cloud voice-cloning key output flags are runtime-only and are not persisted.

### defaults.post.image

| Field | Flag |
|-------|------|
| `geminiImage`, `openaiImage`, `minimaxImage`, `glmImage`, `grokImage`, `runwayImage`, `bflImage`, `deapiImage` | matching image provider flags |
| `imageAspectRatio`, `imageSize`, `imageQuality`, `imageFormat`, `imageBackground`, `imagenCount` | matching image option flags |

### defaults.post.video

| Field | Flag |
|-------|------|
| `geminiVideo`, `minimaxVideo` | `--gemini-video`, `--minimax-video` |
| `videoDuration`, `videoSize`, `videoAspectRatio`, `videoResolution` | matching video option flags |

The schema also accepts `glmVideo`, `grokVideo`, and `runwayVideo`, but the current config merge only writes and injects Gemini and MiniMax video provider defaults. `--deapi-video` is a runtime command flag, not a persisted config default today.

### defaults.post.music

| Field | Flag |
|-------|------|
| `elevenlabsMusic`, `minimaxMusic` | `--elevenlabs-music`, `--minimax-music` |
| `musicDuration` | `--music-duration` |

The schema includes `deapiMusic`, but the current config merge does not write or inject it. Gemini music defaults are not schema-mapped today.

### defaults.batch, defaults.prompts, pricing

| Field | Flag |
|-------|------|
| `defaults.batch.limit`, `defaults.batch.order`, `defaults.batch.concurrency` | `--batch-limit`, `--batch-order`, `--batch-concurrency` |
| `defaults.prompts` | repeated `--prompt` |
| `pricing.maxCents` | `--max-cents` |

`default` prompt expansion is `shortSummary + longSummary + longChapters`.

## Precedence

```text
Explicit CLI flags > config file defaults > Clerc framework defaults
```

Only flags explicitly typed on the command line override config values. Flags populated by Clerc defaults do not overwrite saved config defaults.

If you type any provider/model flag for a step family at runtime, configured provider selections for that family are replaced instead of merged. For example, passing `--openai ...` on `write` suppresses configured `defaults.llm.gemini` and `defaults.llm.groq` entries for that run.

## Pricing And Budgets

Hosted or mixed-provider process and generation commands run cost preflight before execution. The top-level STT and OCR behaviors live under `extract` and `write`; there are no standalone `stt` or `ocr` commands.

To show the estimate and exit:

```bash
bun as write input/examples/audio/1-audio.mp3 --price
```

Set a hard budget:

```bash
bun as config --max-cents 50
```

When the estimate exceeds the limit, the command fails before execution. Use `--allow-over-budget` for a one-off runtime override; it is never persisted.

## Recommended Configs

### All-local

```bash
bun as config \
  --whisper-stt tiny \
  --llama ggml-org/gemma-3-270m-it-GGUF \
  --kitten-tts kitten-tts-mini
```

Image, video, and hosted music generation have no local provider defaults.

### Low-cost hosted defaults

```bash
bun as config \
  --groq-stt whisper-large-v3-turbo \
  --groq openai/gpt-oss-20b \
  --minimax-tts speech-2.8-turbo \
  --minimax-image image-01 \
  --minimax-video MiniMax-Hailuo-2.3 \
  --minimax-music music-2.5
```

## Flags

`bun as config --help` is the authoritative generated flag list for this command. It includes config controls, pricing controls, batch defaults, Step 2 STT/OCR defaults, Step 3 LLM defaults, and post-processing defaults for TTS, image, video, and music.

Global flags:

| Flag | Description |
|------|-------------|
| `--show` | Print resolved config path and effective config |
| `--reset` | Clear the config file |
| `--config-path` | Path to config file |
| `--allow-over-budget` | Runtime-only budget override |
| `--verbose`, `--quiet`, `--json` | Runtime-only logging controls |
