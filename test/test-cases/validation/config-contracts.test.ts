import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfigPatchFromFlags, extractExplicitFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'

const tempDirs: string[] = []

const writeTempConfig = async (value: unknown): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-next-config-'))
  tempDirs.push(dir)
  const configPath = join(dir, 'autoshow.json')
  await writeFile(configPath, JSON.stringify(value, null, 2))
  return configPath
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('config contracts', () => {
  test('extractExplicitFlags ignores tokens after the positional separator', () => {
    expect(extractExplicitFlags([
      'extract',
      'https://ajc.pics/autoshow/examples/1-audio.mp3',
      '--openai-stt',
      'gpt-4o-mini-transcribe',
      '--',
      '--deepinfra-ocr',
      'Qwen/Qwen3-VL-30B-A3B-Instruct'
    ])).toEqual(new Set(['openai-stt']))
  })

  test('buildConfigPatchFromFlags maps explicit provider, OCR, batch, and pricing defaults', () => {
    expect(buildConfigPatchFromFlags({
      openai: 'gpt-5.4-mini',
      grok: 'grok-4.3',
      glm: 'glm-5.1',
      kimi: 'kimi-k2.6',
      'llm-provider-concurrency': '3',
      'llm-local-concurrency': '1',
      'tesseract-ocr': true,
      'openai-ocr': ['gpt-5.5'],
      'grok-ocr': ['grok-4.3'],
      'deepinfra-ocr': ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
      'kimi-ocr': ['kimi-k2.6'],
      dpi: '450',
      'ocr-provider-concurrency': '4',
      'ocr-local-concurrency': '2',
      'batch-limit': '7',
      'max-cents': '25'
    }, new Set(['openai', 'grok', 'glm', 'kimi', 'llm-provider-concurrency', 'llm-local-concurrency', 'tesseract-ocr', 'openai-ocr', 'grok-ocr', 'deepinfra-ocr', 'kimi-ocr', 'dpi', 'ocr-provider-concurrency', 'ocr-local-concurrency', 'batch-limit', 'max-cents']))).toEqual({
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
          grok: ['grok-4.3'],
          glm: ['glm-5.1'],
          kimi: ['kimi-k2.6'],
          providerConcurrency: 3,
          localConcurrency: 1
        },
        extract: {
          ocr: {
            tesseract: true,
            openaiOcr: ['gpt-5.5'],
            grokOcr: ['grok-4.3'],
            deepinfraOcr: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
            kimiOcr: ['kimi-k2.6'],
            dpi: 450,
            providerConcurrency: 4,
            localConcurrency: 2
          }
        },
        batch: {
          limit: 7
        }
      },
      pricing: {
        maxCents: 25
      }
    })
  })

  test('buildConfigPatchFromFlags saves generation provider concurrency defaults', () => {
    expect(buildConfigPatchFromFlags({
      'tts-provider-concurrency': '4',
      'tts-local-concurrency': '1',
      'image-provider-concurrency': '5',
      'image-local-concurrency': '1',
      'video-provider-concurrency': '6',
      'video-local-concurrency': '1',
      'music-provider-concurrency': '7',
      'music-local-concurrency': '1'
    }, new Set([
      'tts-provider-concurrency',
      'tts-local-concurrency',
      'image-provider-concurrency',
      'image-local-concurrency',
      'video-provider-concurrency',
      'video-local-concurrency',
      'music-provider-concurrency',
      'music-local-concurrency'
    ]))).toEqual({
      defaults: {
        post: {
          tts: {
            providerConcurrency: 4,
            localConcurrency: 1
          },
          image: {
            providerConcurrency: 5,
            localConcurrency: 1
          },
          video: {
            providerConcurrency: 6,
            localConcurrency: 1
          },
          music: {
            providerConcurrency: 7,
            localConcurrency: 1
          }
        }
      }
    })
  })

  test('runtime-only options are excluded from saved config patches', () => {
    expect(buildConfigPatchFromFlags({
      'reverb-stt': true,
      price: true,
      password: 'secret-pdf-password',
      'config-path': '/tmp/autoshow.json',
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-voice-name': 'AutoShow Anthony',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com',
      'speechify-tts-voice-locale': 'en-US',
      'speechify-tts-voice-gender': 'notSpecified'
    }, new Set([
      'reverb-stt',
      'price',
      'password',
      'config-path',
      'speechify-tts-ref-audio',
      'speechify-tts-voice-name',
      'speechify-tts-consent-name',
      'speechify-tts-consent-email',
      'speechify-tts-voice-locale',
      'speechify-tts-voice-gender'
    ]))).toEqual({
      defaults: {
        extract: {
          stt: {
            reverb: true
          }
        }
      }
    })
  })

  test('buildConfigPatchFromFlags saves BFL image defaults', () => {
    expect(buildConfigPatchFromFlags({
      'bfl-image': ['flux-2-pro'],
      'reve-image': ['latest'],
      'image-size': '1024x1024',
      'image-format': 'webp'
    }, new Set(['bfl-image', 'reve-image', 'image-size', 'image-format']))).toEqual({
      defaults: {
        post: {
          image: {
            bflImage: ['flux-2-pro'],
            reveImage: ['latest'],
            imageSize: '1024x1024',
            imageFormat: 'webp'
          }
        }
      }
    })
  })

  test('buildConfigPatchFromFlags saves and merges Speechify, Hume, and Cartesia TTS defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'speechify-tts': ['simba-english', 'simba-multilingual'],
      'speechify-voice': 'narrator_voice',
      'speechify-tts-audio-format': 'wav',
      'speechify-tts-language': 'en-US',
      'hume-tts': ['octave-2'],
      'hume-tts-voice': 'Studio Voice',
      'hume-tts-voice-provider': 'CUSTOM_VOICE',
      'cartesia-tts': ['sonic-3.5'],
      'cartesia-tts-voice': 'cartesia-voice-id',
      'cartesia-tts-language': 'en'
    }, new Set([
      'speechify-tts',
      'speechify-voice',
      'speechify-tts-audio-format',
      'speechify-tts-language',
      'hume-tts',
      'hume-tts-voice',
      'hume-tts-voice-provider',
      'cartesia-tts',
      'cartesia-tts-voice',
      'cartesia-tts-language'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            speechifyTts: ['simba-english', 'simba-multilingual'],
            speechifyVoice: 'narrator_voice',
            speechifyTtsAudioFormat: 'wav',
            speechifyTtsLanguage: 'en-US',
            humeTts: ['octave-2'],
            humeTtsVoice: 'Studio Voice',
            humeTtsVoiceProvider: 'CUSTOM_VOICE',
            cartesiaTts: ['sonic-3.5'],
            cartesiaTtsVoice: 'cartesia-voice-id',
            cartesiaTtsLanguage: 'en'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'speechify-tts': ['simba-english', 'simba-multilingual'],
      'speechify-voice': 'narrator_voice',
      'speechify-tts-audio-format': 'wav',
      'speechify-tts-language': 'en-US',
      'hume-tts': ['octave-2'],
      'hume-tts-voice': 'Studio Voice',
      'hume-tts-voice-provider': 'CUSTOM_VOICE',
      'cartesia-tts': ['sonic-3.5'],
      'cartesia-tts-voice': 'cartesia-voice-id',
      'cartesia-tts-language': 'en'
    })
  })

  test('buildConfigPatchFromFlags saves and merges Mistral TTS defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'mistral-tts': ['voxtral-mini-tts-2603'],
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'mistral-tts-voice-name': 'AutoShow Saved Voice'
    }, new Set(['mistral-tts', 'mistral-tts-voice', 'mistral-tts-ref-audio', 'mistral-tts-voice-name']))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            mistralTtsVoiceName: 'AutoShow Saved Voice'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'mistral-tts': ['voxtral-mini-tts-2603'],
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'mistral-tts-voice-name': 'AutoShow Saved Voice'
    })
  })

  test('buildConfigPatchFromFlags saves and merges MiniMax TTS voice defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'minimax-tts': ['speech-2.8-turbo'],
      'minimax-tts-voice': 'English_expressive_narrator'
    }, new Set([
      'minimax-tts',
      'minimax-tts-voice'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsVoice: 'English_expressive_narrator'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'minimax-tts': ['speech-2.8-turbo'],
      'minimax-tts-voice': 'English_expressive_narrator'
    })
  })

  test('buildConfigPatchFromFlags saves and merges TTS request-control defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'grok-tts-language': 'ar-SA',
      'grok-tts-text-normalization': true,
      'openai-tts-instructions': 'Speak with calm narration.',
      'openai-tts-speed': '1.25',
      'minimax-tts-language-boost': 'English',
      'minimax-tts-speed': '1.2',
      'minimax-tts-volume': '2.5',
      'minimax-tts-pitch': '-2',
      'minimax-tts-emotion': 'calm',
      'minimax-tts-english-normalization': true,
      'minimax-tts-pronunciation': ['AutoShow/auto show', 'TTS/tee tee ess'],
      'deepgram-tts-encoding': 'linear16',
      'deepgram-tts-container': 'wav',
      'deepgram-tts-bit-rate': '128000',
      'deepgram-tts-sample-rate': '24000',
      'deepgram-tts-speed': '1.1',
      'elevenlabs-tts-output-format': 'mp3_22050_32',
      'elevenlabs-tts-language-code': 'en',
      'elevenlabs-tts-stability': '0.4',
      'elevenlabs-tts-similarity-boost': '0.8',
      'elevenlabs-tts-style': '0.2',
      'elevenlabs-tts-use-speaker-boost': true,
      'elevenlabs-tts-speed': '1.1',
      'elevenlabs-tts-seed': '12345',
      'elevenlabs-tts-text-normalization': 'on',
      'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2', 'dict_3'],
      'elevenlabs-tts-optimize-streaming-latency': '2'
    }, new Set([
      'grok-tts-language',
      'grok-tts-text-normalization',
      'openai-tts-instructions',
      'openai-tts-speed',
      'minimax-tts-language-boost',
      'minimax-tts-speed',
      'minimax-tts-volume',
      'minimax-tts-pitch',
      'minimax-tts-emotion',
      'minimax-tts-english-normalization',
      'minimax-tts-pronunciation',
      'deepgram-tts-encoding',
      'deepgram-tts-container',
      'deepgram-tts-bit-rate',
      'deepgram-tts-sample-rate',
      'deepgram-tts-speed',
      'elevenlabs-tts-output-format',
      'elevenlabs-tts-language-code',
      'elevenlabs-tts-stability',
      'elevenlabs-tts-similarity-boost',
      'elevenlabs-tts-style',
      'elevenlabs-tts-use-speaker-boost',
      'elevenlabs-tts-speed',
      'elevenlabs-tts-seed',
      'elevenlabs-tts-text-normalization',
      'elevenlabs-tts-pronunciation-dictionary-locator',
      'elevenlabs-tts-optimize-streaming-latency'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            grokTtsLanguage: 'ar-SA',
            grokTtsTextNormalization: true,
            openaiTtsInstructions: 'Speak with calm narration.',
            openaiTtsSpeed: 1.25,
            minimaxTtsLanguageBoost: 'English',
            minimaxTtsSpeed: 1.2,
            minimaxTtsVolume: 2.5,
            minimaxTtsPitch: -2,
            minimaxTtsEmotion: 'calm',
            minimaxTtsEnglishNormalization: true,
            minimaxTtsPronunciations: ['AutoShow/auto show', 'TTS/tee tee ess'],
            deepgramTtsEncoding: 'linear16',
            deepgramTtsContainer: 'wav',
            deepgramTtsBitRate: 128000,
            deepgramTtsSampleRate: 24000,
            deepgramTtsSpeed: 1.1,
            elevenlabsTtsOutputFormat: 'mp3_22050_32',
            elevenlabsTtsLanguageCode: 'en',
            elevenlabsTtsStability: 0.4,
            elevenlabsTtsSimilarityBoost: 0.8,
            elevenlabsTtsStyle: 0.2,
            elevenlabsTtsUseSpeakerBoost: true,
            elevenlabsTtsSpeed: 1.1,
            elevenlabsTtsSeed: 12345,
            elevenlabsTtsTextNormalization: 'on',
            elevenlabsTtsPronunciationDictionaryLocators: ['dict_1:version_2', 'dict_3'],
            elevenlabsTtsOptimizeStreamingLatency: 2
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'grok-tts-language': 'ar-SA',
      'grok-tts-text-normalization': true,
      'openai-tts-instructions': 'Speak with calm narration.',
      'openai-tts-speed': '1.25',
      'minimax-tts-language-boost': 'English',
      'minimax-tts-speed': '1.2',
      'minimax-tts-volume': '2.5',
      'minimax-tts-pitch': '-2',
      'minimax-tts-emotion': 'calm',
      'minimax-tts-english-normalization': true,
      'minimax-tts-pronunciation': ['AutoShow/auto show', 'TTS/tee tee ess'],
      'deepgram-tts-encoding': 'linear16',
      'deepgram-tts-container': 'wav',
      'deepgram-tts-bit-rate': '128000',
      'deepgram-tts-sample-rate': '24000',
      'deepgram-tts-speed': '1.1',
      'elevenlabs-tts-output-format': 'mp3_22050_32',
      'elevenlabs-tts-language-code': 'en',
      'elevenlabs-tts-stability': '0.4',
      'elevenlabs-tts-similarity-boost': '0.8',
      'elevenlabs-tts-style': '0.2',
      'elevenlabs-tts-use-speaker-boost': true,
      'elevenlabs-tts-speed': '1.1',
      'elevenlabs-tts-seed': '12345',
      'elevenlabs-tts-text-normalization': 'on',
      'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2', 'dict_3'],
      'elevenlabs-tts-optimize-streaming-latency': '2'
    })
  })

  test('buildConfigPatchFromFlags saves and merges OpenAI TTS custom voice defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'openai-tts': ['gpt-4o-mini-tts'],
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-consent-audio': 'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
      'openai-tts-consent-language': 'en-US',
      'openai-tts-consent-name': 'Anthony Consent',
      'openai-tts-voice-name': 'AutoShow Anthony'
    }, new Set([
      'openai-tts',
      'openai-tts-ref-audio',
      'openai-tts-consent-id',
      'openai-tts-consent-audio',
      'openai-tts-consent-language',
      'openai-tts-consent-name',
      'openai-tts-voice-name'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            openaiTts: ['gpt-4o-mini-tts'],
            openaiTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            openaiTtsConsentId: 'cons_123',
            openaiTtsConsentAudio: 'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
            openaiTtsConsentLanguage: 'en-US',
            openaiTtsConsentName: 'Anthony Consent',
            openaiTtsVoiceName: 'AutoShow Anthony'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'openai-tts': ['gpt-4o-mini-tts'],
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-consent-audio': 'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
      'openai-tts-consent-language': 'en-US',
      'openai-tts-consent-name': 'Anthony Consent',
      'openai-tts-voice-name': 'AutoShow Anthony'
    })
  })

  test('buildConfigPatchFromFlags saves and merges ElevenLabs TTS clone defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'elevenlabs-tts': ['eleven_v3'],
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony',
      'elevenlabs-tts-clone-remove-background-noise': true
    }, new Set([
      'elevenlabs-tts',
      'elevenlabs-tts-ref-audio',
      'elevenlabs-tts-voice-name',
      'elevenlabs-tts-clone-remove-background-noise'
    ]))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            elevenlabsTts: ['eleven_v3'],
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'elevenlabs-tts': ['eleven_v3'],
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony',
      'elevenlabs-tts-clone-remove-background-noise': true
    })
  })

  test('loadConfig accepts current array-shaped defaults', async () => {
    const configPath = await writeTempConfig({
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
          grok: ['grok-4.3'],
          glm: ['glm-5.1'],
          kimi: ['kimi-k2.6'],
          providerConcurrency: 3,
          localConcurrency: 1
        },
        extract: {
          stt: {
            deepgramStt: ['nova-3']
          },
          ocr: {
            providerConcurrency: 3,
            localConcurrency: 1,
            openaiOcr: ['gpt-5.5'],
            grokOcr: ['grok-4.3'],
            deepinfraOcr: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
            kimiOcr: ['kimi-k2.6']
          }
        },
        post: {
          tts: {
            speechifyTts: ['simba-english'],
            speechifyVoice: 'narrator_voice',
            speechifyTtsAudioFormat: 'wav',
            speechifyTtsLanguage: 'en-US',
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            mistralTtsVoiceName: 'AutoShow Saved Voice',
            deepgramTtsEncoding: 'linear16',
            deepgramTtsContainer: 'wav',
            deepgramTtsBitRate: 128000,
            deepgramTtsSampleRate: 24000,
            deepgramTtsSpeed: 1.1,
            openaiTts: ['gpt-4o-mini-tts'],
            openaiVoice: 'voice_existing123',
            openaiTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            openaiTtsConsentId: 'cons_123',
            openaiTtsConsentAudio: 'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
            openaiTtsConsentLanguage: 'en-US',
            openaiTtsConsentName: 'Anthony Consent',
            openaiTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTts: ['eleven_v3'],
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true,
            elevenlabsTtsOutputFormat: 'mp3_22050_32',
            elevenlabsTtsLanguageCode: 'en',
            elevenlabsTtsStability: 0.4,
            elevenlabsTtsSimilarityBoost: 0.8,
            elevenlabsTtsStyle: 0.2,
            elevenlabsTtsUseSpeakerBoost: true,
            elevenlabsTtsSpeed: 1.1,
            elevenlabsTtsSeed: 12345,
            elevenlabsTtsTextNormalization: 'on',
            elevenlabsTtsPronunciationDictionaryLocators: ['dict_1:version_2'],
            elevenlabsTtsOptimizeStreamingLatency: 2,
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsVoice: 'AutoShowTestVoice'
          },
          image: {
            bflImage: ['flux-2-pro'],
            imageFormat: 'jpeg'
          }
        }
      }
    })

    await expect(loadConfig(configPath)).resolves.toMatchObject({
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
          grok: ['grok-4.3'],
          glm: ['glm-5.1'],
          kimi: ['kimi-k2.6'],
          providerConcurrency: 3,
          localConcurrency: 1
        },
        extract: {
          stt: {
            deepgramStt: ['nova-3']
          },
          ocr: {
            providerConcurrency: 3,
            localConcurrency: 1,
            openaiOcr: ['gpt-5.5'],
            grokOcr: ['grok-4.3'],
            deepinfraOcr: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
            kimiOcr: ['kimi-k2.6']
          }
        },
        post: {
          tts: {
            speechifyTts: ['simba-english'],
            speechifyVoice: 'narrator_voice',
            speechifyTtsAudioFormat: 'wav',
            speechifyTtsLanguage: 'en-US',
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            mistralTtsVoiceName: 'AutoShow Saved Voice',
            deepgramTtsEncoding: 'linear16',
            deepgramTtsContainer: 'wav',
            deepgramTtsBitRate: 128000,
            deepgramTtsSampleRate: 24000,
            deepgramTtsSpeed: 1.1,
            openaiTts: ['gpt-4o-mini-tts'],
            openaiVoice: 'voice_existing123',
            openaiTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            openaiTtsConsentId: 'cons_123',
            openaiTtsConsentAudio: 'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
            openaiTtsConsentLanguage: 'en-US',
            openaiTtsConsentName: 'Anthony Consent',
            openaiTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTts: ['eleven_v3'],
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true,
            elevenlabsTtsOutputFormat: 'mp3_22050_32',
            elevenlabsTtsLanguageCode: 'en',
            elevenlabsTtsStability: 0.4,
            elevenlabsTtsSimilarityBoost: 0.8,
            elevenlabsTtsStyle: 0.2,
            elevenlabsTtsUseSpeakerBoost: true,
            elevenlabsTtsSpeed: 1.1,
            elevenlabsTtsSeed: 12345,
            elevenlabsTtsTextNormalization: 'on',
            elevenlabsTtsPronunciationDictionaryLocators: ['dict_1:version_2'],
            elevenlabsTtsOptimizeStreamingLatency: 2,
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsVoice: 'AutoShowTestVoice'
          },
          image: {
            bflImage: ['flux-2-pro'],
            imageFormat: 'jpeg'
          }
        }
      }
    })
  })

  test('removed schema shapes are rejected', async () => {
    const versionConfig = await writeTempConfig({
      version: 2
    })
    const scalarConfig = await writeTempConfig({
      defaults: {
        llm: {
          openai: 'gpt-5.4-mini'
        }
      }
    })
    const pricingConfig = await writeTempConfig({
      pricing: {
        maxUsd: 1
      }
    })

    await expect(loadConfig(versionConfig)).rejects.toThrow('autoshow config')
    await expect(loadConfig(scalarConfig)).rejects.toThrow('autoshow config')
    await expect(loadConfig(pricingConfig)).rejects.toThrow('autoshow config')
  })
})
