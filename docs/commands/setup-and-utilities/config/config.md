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

No input argument is required. Flags that are explicitly passed are persisted to the config file when they map to reusable defaults. Runtime-only flags such as `--price`, `--allow-over-budget`, `--show`, `--reset`, `--config-path`, PDF passwords, Speechify custom-voice creation fields, `--music-lyrics-file`, and `--music-instrumental` are never persisted. Image edit/reference controls such as `--image-input`, `--image-mask`, `--image-response-mode`, `--image-search-grounding`, and `--image-compression` are accepted by write/config/resume flag surfaces but are not persisted or injected by the current config command.

## Config File Location

Default path: `config/autoshow.json` in the project root, located by walking up to the nearest `package.json`.

Override with `--config-path <path>`:

```bash
bun as config --show --config-path ./input/my-autoshow.json
bun as write input/examples/audio/1-audio.mp3 --config-path ./input/my-autoshow.json
```

## Setting Defaults

```bash
bun as config --llm openai=gpt-5.4
bun as config --llm glm=glm-5.1
bun as config --llm kimi=kimi-k2.6
bun as config --stt whisper=large-v3-turbo
bun as config --stt reverb --stt-reverb-verbatimicity 0.5
bun as config --stt happyscribe=auto --stt-happyscribe-organization-id org_123
bun as config --stt supadata=auto --stt-supadata-lang en
bun as config --ocr paddle-ocr
bun as config --ocr mistral=mistral-ocr-2512 --ocr-language eng --ocr-dpi 300
bun as config --tts kitten=kitten-tts-mini --tts-voice Jasper
bun as config --tts elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3
bun as config --tts minimax=speech-2.8-hd --minimax-tts-language-boost English --tts-speed 1.15
bun as config --tts grok=grok-tts --tts-language auto --tts-text-normalization true
bun as config --tts mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3 --tts-voice-name AutoShowAnthony
bun as config --tts openai=gpt-4o-mini-tts --tts-ref-audio input/examples/audio/anthony-voice.mp3 --openai-tts-consent-id cons_123
bun as config --tts openai=gpt-4o-mini-tts --tts-instructions "Warm documentary narration" --tts-speed 1.1
bun as config --tts deepgram=aura-2-thalia-en --deepgram-tts-container wav --deepgram-tts-sample-rate 24000
bun as config --tts speechify=simba-english --tts-voice george --speechify-tts-audio-format mp3 --tts-language en-US
bun as config --tts hume=octave-2 --tts-voice "Male English Actor"
bun as config --tts cartesia=sonic-3.5 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun as config --batch-limit 20 --batch-order oldest
bun as config --max-cents 100
```

Model-selecting step selector flags are repeatable. Repeating a provider selector saves all selected models in first-seen order:

```bash
bun as config --stt speechmatics=standard --stt speechmatics=enhanced
bun as config --llm openai=gpt-5.4 --llm openai=gpt-5.4-mini
```

The config command only persists flags mapped by the current config merge layer. Hidden compatibility aliases may still work at runtime, but saved examples use the public names shown by `bun as config --help`.

## Config Schema

Representative JSON shape:

```json
{
  "defaults": {
    "extract": {
      "stt": {
        "whisper": ["large-v3-turbo"],
        "reverb": true,
        "youtubeCaptions": true,
        "deepinfraStt": ["openai/whisper-large-v3-turbo"],
        "groqStt": ["whisper-large-v3-turbo"],
        "grokStt": ["speech-to-text"],
        "elevenlabsStt": ["scribe_v2"],
        "deepgramStt": ["nova-3"],
        "sonioxStt": ["stt-async-v4"],
        "speechmaticsStt": ["standard"],
        "revStt": ["machine"],
        "mistralStt": ["voxtral-mini-2602"],
        "assemblyaiStt": ["universal-3-pro"],
        "gladiaStt": ["default"],
        "happyscribeStt": ["auto"],
        "supadataStt": ["auto"],
        "scrapecreatorsStt": ["youtube-transcript"],
        "openaiStt": ["gpt-4o-mini-transcribe"],
        "geminiStt": ["gemini-3-flash-preview"],
        "glmStt": ["glm-asr-2512"],
        "happyscribeOrganizationId": "org_123",
        "supadataLang": "en",
        "scrapecreatorsLang": "en",
        "speakerCount": 2,
        "split": true,
        "reverbVerbatimicity": 0.5,
        "providerConcurrency": 2,
        "localConcurrency": 1,
        "segmentConcurrency": 2,
        "preflightConcurrency": 4,
        "refreshCache": false,
        "noCache": false
      },
      "ocr": {
        "lang": "eng",
        "out": "text",
        "tesseract": true,
        "ocrmypdf": true,
        "paddleOcr": true,
        "dpi": 300,
        "mistralOcr": ["mistral-ocr-2512"],
        "glmOcr": ["glm-ocr"],
        "kimiOcr": ["kimi-k2.6"],
        "openaiOcr": ["gpt-5.4-nano"],
        "grokOcr": ["grok-4.3"],
        "anthropicOcr": ["claude-haiku-4-5"],
        "geminiOcr": ["gemini-3.1-flash-lite-preview"],
        "deepinfraOcr": ["Qwen/Qwen3-VL-30B-A3B-Instruct"],
        "unstructuredOcr": ["hi_res_and_enrichment"],
        "chapters": true,
        "length": 50,
        "pdfChapterMode": "auto"
      }
    },
    "llm": {
      "llama": ["ggml-org/gemma-3-270m-it-GGUF"],
      "openai": ["gpt-5.4", "gpt-5.4-mini"],
      "groq": ["openai/gpt-oss-20b"],
      "gemini": ["gemini-3.1-flash-lite-preview"],
      "anthropic": ["claude-haiku-4-5"],
      "minimax": ["MiniMax-M2.7"],
      "grok": ["grok-4.3"],
      "glm": ["glm-5.1"],
      "kimi": ["kimi-k2.6"],
      "providerConcurrency": 2,
      "localConcurrency": 1
    },
    "post": {
      "tts": {
        "kittenTts": ["kitten-tts-mini"],
        "elevenlabsTts": ["eleven_v3"],
        "minimaxTts": ["speech-2.8-turbo"],
        "minimaxTtsLanguageBoost": "English",
        "minimaxTtsSpeed": 1.1,
        "minimaxTtsEnglishNormalization": true,
        "groqTts": ["canopylabs/orpheus-v1-english"],
        "groqVoice": "troy",
        "grokTts": ["grok-tts"],
        "grokTtsLanguage": "auto",
        "grokTtsTextNormalization": true,
        "mistralTts": ["voxtral-mini-tts-2603"],
        "mistralTtsRefAudio": "input/examples/audio/anthony-voice.mp3",
        "mistralTtsVoiceName": "AutoShowAnthony",
        "openaiTts": ["gpt-4o-mini-tts"],
        "openaiTtsInstructions": "Warm documentary narration",
        "openaiTtsSpeed": 1.1,
        "geminiTts": ["gemini-3.1-flash-tts-preview"],
        "geminiVoice": "Kore",
        "deepgramTts": ["aura-2-thalia-en"],
        "deepgramTtsContainer": "wav",
        "deepgramTtsSampleRate": 24000,
        "speechifyTts": ["simba-english"],
        "speechifyVoice": "george",
        "speechifyTtsAudioFormat": "mp3",
        "speechifyTtsLanguage": "en-US",
        "humeTts": ["octave-2"],
        "humeTtsVoice": "Male English Actor",
        "humeTtsVoiceProvider": "HUME_AI",
        "cartesiaTts": ["sonic-3.5"],
        "cartesiaTtsVoice": "f786b574-daa5-4673-aa0c-cbe3e8534c02",
        "cartesiaTtsLanguage": "en",
        "providerConcurrency": 2,
        "localConcurrency": 1
      },
      "image": {
        "geminiImage": ["gemini-3.1-flash-image-preview"],
        "openaiImage": ["gpt-image-2"],
        "grokImage": ["grok-imagine-image"],
        "bflImage": ["flux-2-pro"],
        "reveImage": ["latest"],
        "imageAspectRatio": "16:9",
        "imageSize": "1024x1024",
        "imageQuality": "low",
        "imageFormat": "png",
        "imageBackground": "auto",
        "imageCount": 1,
        "providerConcurrency": 2,
        "localConcurrency": 1
      },
      "video": {
        "geminiVideo": ["veo-3.1-fast-generate-preview"],
        "minimaxVideo": ["MiniMax-Hailuo-2.3"],
        "glmVideo": ["cogvideox-3"],
        "grokVideo": ["grok-imagine-video"],
        "runwayVideo": ["gen4.5"],
        "videoDuration": 8,
        "videoSize": "1280x720",
        "videoAspectRatio": "16:9",
        "videoResolution": "720p",
        "videoMode": "text",
        "videoInputImage": "input/reference.png",
        "videoLastFrame": "input/last-frame.png",
        "videoReferenceImages": ["input/reference-1.png"],
        "videoInputVideo": "input/source.mp4",
        "grokVideoStorageFilename": "autoshow-source.mp4",
        "grokVideoStorageExpiresAfter": 86400,
        "providerConcurrency": 2,
        "localConcurrency": 1
      },
      "music": {
        "elevenlabsMusic": ["music_v1"],
        "minimaxMusic": ["music-2.6"],
        "geminiMusic": ["lyria-3-clip-preview"],
        "musicDuration": 30,
        "providerConcurrency": 2,
        "localConcurrency": 1
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
| `whisper` and hosted STT model fields | `--stt provider[=model]` |
| `reverb` | `--stt reverb` |
| `youtubeCaptions` | `--youtube-captions` |
| `happyscribeOrganizationId`, `supadataLang`, `scrapecreatorsLang` | `--stt-happyscribe-organization-id`, `--stt-supadata-lang`, `--stt-scrapecreators-lang` |
| `speakerCount`, `split`, `reverbVerbatimicity` | `--speaker-count`, `--split`, `--stt-reverb-verbatimicity` |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |
| `segmentConcurrency`, `preflightConcurrency` | `--stt-segment-concurrency`, `--stt-preflight-concurrency` |
| `refreshCache`, `noCache` | `--refresh-cache`, `--no-cache` |

`--stt together` appears in generated config help through the shared STT registry, but the current persisted config schema does not validate `defaults.extract.stt.togetherStt`. Use it on `extract` or `write` directly until schema support is added.

### defaults.extract.ocr

| Field | Flag |
|-------|------|
| Local OCR engine fields | `--ocr tesseract`, `--ocr ocrmypdf`, `--ocr paddle-ocr` |
| Hosted OCR model fields | `--ocr provider[=model]` |
| `lang`, `out`, `dpi` | `--ocr-language`, `--format`, `--ocr-dpi` |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |
| `chapters`, `length`, `pdfChapterMode` | `--chapters`, `--length`, `--pdf-chapter-mode` |

### defaults.llm

| Field | Flag |
|-------|------|
| `llama`, `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi` | `--llm provider[=model]` |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

### defaults.post.tts

| Field | Flag |
|-------|------|
| `kittenTts`, `elevenlabsTts`, `minimaxTts`, `groqTts`, `grokTts`, `mistralTts`, `openaiTts`, `geminiTts`, `deepgramTts`, `speechifyTts`, `humeTts`, `cartesiaTts` | `--tts provider[=model]` |
| `ttsSpeaker`, `groqVoice`, `grokTtsVoice`, `grokTtsLanguage`, `grokTtsTextNormalization`, `mistralTtsVoice`, `mistralTtsRefAudio`, `mistralTtsVoiceName` | generic `--tts-*` voice/reference flags or matching provider-specific controls |
| `ttsDialogueFormat`, `ttsSpeakerRefAudio` | dialogue TTS flags |
| `openaiVoice`, `openaiTtsInstructions`, `openaiTtsSpeed`, `openaiTtsRefAudio`, `openaiTtsConsentId`, `openaiTtsConsentAudio`, `openaiTtsConsentLanguage`, `openaiTtsConsentName`, `openaiTtsVoiceName` | generic `--tts-*` flags plus `--openai-tts-consent-id` |
| `geminiVoice`, `geminiSpeaker1Name`, `geminiSpeaker1Voice`, `geminiSpeaker2Name`, `geminiSpeaker2Voice` | Gemini voice and multispeaker flags |
| `elevenlabsVoice`, `elevenlabsTtsRefAudio`, `elevenlabsTtsVoiceName`, `elevenlabsTtsCloneRemoveBackgroundNoise`, `elevenlabsTtsOutputFormat`, `elevenlabsTtsLanguageCode`, `elevenlabsTtsStability`, `elevenlabsTtsSimilarityBoost`, `elevenlabsTtsStyle`, `elevenlabsTtsUseSpeakerBoost`, `elevenlabsTtsSpeed`, `elevenlabsTtsSeed`, `elevenlabsTtsTextNormalization`, `elevenlabsTtsPronunciationDictionaryLocators`, `elevenlabsTtsOptimizeStreamingLatency` | ElevenLabs reusable voice/clone and synthesis flags |
| `minimaxTtsVoice`, `minimaxTtsLanguageBoost`, `minimaxTtsSpeed`, `minimaxTtsVolume`, `minimaxTtsPitch`, `minimaxTtsEmotion`, `minimaxTtsEnglishNormalization`, `minimaxTtsPronunciations` | MiniMax voice and synthesis control flags |
| `deepgramVoice`, `deepgramTtsEncoding`, `deepgramTtsContainer`, `deepgramTtsBitRate`, `deepgramTtsSampleRate`, `deepgramTtsSpeed`, `speechifyVoice`, `speechifyTtsAudioFormat`, `speechifyTtsLanguage`, `humeTtsVoice`, `humeTtsVoiceProvider`, `cartesiaTtsVoice`, `cartesiaTtsLanguage` | provider voice/reference, output, and reusable setup flags |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

Speechify custom-voice creation fields (`--speechify-tts-ref-audio`, `--speechify-tts-voice-name`, `--speechify-tts-consent-*`, `--speechify-tts-voice-locale`, `--speechify-tts-voice-gender`) are runtime-only and are not persisted.

### defaults.post.image

| Field | Flag |
|-------|------|
| `geminiImage`, `openaiImage`, `grokImage`, `bflImage`, `reveImage` | `--image provider[=model]` |
| `imageAspectRatio`, `imageSize`, `imageQuality`, `imageFormat`, `imageBackground`, `imageCount` | matching reusable image option flags |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

`--image-input`, `--image-mask`, `--image-response-mode`, `--image-search-grounding`, and `--image-compression` are runtime image-generation flags. They are not persisted by the current config command.

### defaults.post.video

| Field | Flag |
|-------|------|
| `geminiVideo`, `minimaxVideo`, `glmVideo`, `grokVideo`, `runwayVideo` | `--video provider[=model]` |
| `videoDuration`, `videoSize`, `videoAspectRatio`, `videoResolution`, `videoMode`, `videoInputImage`, `videoLastFrame`, `videoReferenceImages`, `videoInputVideo`, `grokVideoStorageFilename`, `grokVideoStorageExpiresAfter` | matching video option flags |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

### defaults.post.music

| Field | Flag |
|-------|------|
| `elevenlabsMusic`, `minimaxMusic`, `geminiMusic` | `--music provider[=model]` |
| `musicDuration` | `--music-duration` |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

`--music-lyrics-file` and `--music-instrumental` are runtime music generation flags and are not persisted config defaults.

### defaults.batch, defaults.prompts, pricing

| Field | Flag |
|-------|------|
| `defaults.batch.limit`, `defaults.batch.order`, `defaults.batch.concurrency` | `--batch-limit`, `--batch-order`, `--batch-concurrency` |
| `defaults.prompts` | repeated `--prompt` |
| `pricing.maxCents` | `--max-cents` |

`default` prompt expansion is `shortSummary + longSummary + longChapters`.

## Precedence

```text
Explicit CLI flags > config file defaults > native CLI defaults
```

Only flags explicitly typed on the command line override config values. Native CLI defaults do not overwrite saved config defaults.

If you type any provider/model selector for a step family at runtime, configured provider selections for that family are replaced instead of merged. For example, passing `--llm openai=...` on `write` suppresses configured `defaults.llm.gemini` and `defaults.llm.groq` entries for that run.

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
  --stt whisper=tiny \
  --llm llama=ggml-org/gemma-3-270m-it-GGUF \
  --tts kitten=kitten-tts-mini
```

Image, video, and hosted music generation have no local provider defaults.

### Low-cost hosted defaults

```bash
bun as config \
  --stt groq=whisper-large-v3-turbo \
  --llm groq=openai/gpt-oss-20b \
  --tts minimax=speech-2.8-turbo \
  --image openai=gpt-image-2 --image-quality low \
  --video minimax=MiniMax-Hailuo-2.3 \
  --music minimax=music-2.6
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
