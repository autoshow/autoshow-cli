import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
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
  test('buildConfigPatchFromFlags maps explicit provider, OCR, batch, and pricing defaults', () => {
    expect(buildConfigPatchFromFlags({
      openai: 'gpt-5.4-mini',
      glm: 'glm-5.1',
      kimi: 'kimi-k2.6',
      'llm-provider-concurrency': '3',
      'llm-local-concurrency': '1',
      'tesseract-ocr': true,
      'deepinfra-ocr': ['allenai/olmOCR-2-7B-1025'],
      'kimi-ocr': ['kimi-k2.6'],
      dpi: '450',
      'ocr-provider-concurrency': '4',
      'ocr-local-concurrency': '2',
      'batch-limit': '7',
      'max-cents': '25'
    }, new Set(['openai', 'glm', 'kimi', 'llm-provider-concurrency', 'llm-local-concurrency', 'tesseract-ocr', 'deepinfra-ocr', 'kimi-ocr', 'dpi', 'ocr-provider-concurrency', 'ocr-local-concurrency', 'batch-limit', 'max-cents']))).toEqual({
      version: 2,
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
          glm: ['glm-5.1'],
          kimi: ['kimi-k2.6'],
          providerConcurrency: 3,
          localConcurrency: 1
        },
        extract: {
          ocr: {
            tesseract: true,
            deepinfraOcr: ['allenai/olmOCR-2-7B-1025'],
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

  test('runtime-only options are excluded from saved config patches', () => {
    expect(buildConfigPatchFromFlags({
      'reverb-stt': true,
      price: true,
      password: 'secret-pdf-password',
      'config-path': '/tmp/autoshow.json',
      'elevenlabs-tts-pvc-sample': ['input/examples/audio/anthony-voice.mp3'],
      'elevenlabs-tts-pvc-captcha-out': '/tmp/captcha.png',
      'elevenlabs-tts-pvc-verify-audio': 'input/examples/audio/0-audio-short.mp3',
      'elevenlabs-tts-pvc-wait': true
    }, new Set([
      'reverb-stt',
      'price',
      'password',
      'config-path',
      'elevenlabs-tts-pvc-sample',
      'elevenlabs-tts-pvc-captcha-out',
      'elevenlabs-tts-pvc-verify-audio',
      'elevenlabs-tts-pvc-wait'
    ]))).toEqual({
      version: 2,
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
      'bfl-image': ['flux-2-pro-preview'],
      'image-size': '1024x1024',
      'image-format': 'webp'
    }, new Set(['bfl-image', 'image-size', 'image-format']))).toEqual({
      version: 2,
      defaults: {
        post: {
          image: {
            bflImage: ['flux-2-pro-preview'],
            imageSize: '1024x1024',
            imageFormat: 'webp'
          }
        }
      }
    })
  })

  test('buildConfigPatchFromFlags saves Runway TTS defaults', () => {
    expect(buildConfigPatchFromFlags({
      'runway-tts': ['eleven_multilingual_v2'],
      'runway-tts-voice': 'Leslie'
    }, new Set(['runway-tts', 'runway-tts-voice']))).toEqual({
      version: 2,
      defaults: {
        post: {
          tts: {
            runwayTts: ['eleven_multilingual_v2'],
            runwayTtsVoice: 'Leslie'
          }
        }
      }
    })
  })

  test('buildConfigPatchFromFlags saves and merges Mistral TTS defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'mistral-tts': ['voxtral-mini-tts-2603'],
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    }, new Set(['mistral-tts', 'mistral-tts-voice', 'mistral-tts-ref-audio']))

    expect(patch).toEqual({
      version: 2,
      defaults: {
        post: {
          tts: {
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'mistral-tts': ['voxtral-mini-tts-2603'],
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })
  })

  test('buildConfigPatchFromFlags saves and merges MiniMax TTS clone defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'minimax-tts': ['speech-2.8-turbo'],
      'minimax-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'minimax-tts-voice': 'AutoShowTestVoice',
      'minimax-tts-prompt-audio': 'input/examples/audio/0-audio-short.mp3',
      'minimax-tts-prompt-text': 'Reference transcript.',
      'minimax-tts-clone-noise-reduction': true,
      'minimax-tts-clone-volume-normalization': true
    }, new Set([
      'minimax-tts',
      'minimax-tts-ref-audio',
      'minimax-tts-voice',
      'minimax-tts-prompt-audio',
      'minimax-tts-prompt-text',
      'minimax-tts-clone-noise-reduction',
      'minimax-tts-clone-volume-normalization'
    ]))

    expect(patch).toEqual({
      version: 2,
      defaults: {
        post: {
          tts: {
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            minimaxTtsVoice: 'AutoShowTestVoice',
            minimaxTtsPromptAudio: 'input/examples/audio/0-audio-short.mp3',
            minimaxTtsPromptText: 'Reference transcript.',
            minimaxTtsCloneNoiseReduction: true,
            minimaxTtsCloneVolumeNormalization: true
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'minimax-tts': ['speech-2.8-turbo'],
      'minimax-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'minimax-tts-voice': 'AutoShowTestVoice',
      'minimax-tts-prompt-audio': 'input/examples/audio/0-audio-short.mp3',
      'minimax-tts-prompt-text': 'Reference transcript.',
      'minimax-tts-clone-noise-reduction': true,
      'minimax-tts-clone-volume-normalization': true
    })
  })

  test('buildConfigPatchFromFlags saves and merges OpenAI TTS custom voice defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'openai-tts': ['gpt-4o-mini-tts'],
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-consent-audio': 'input/examples/audio/0-audio-short.mp3',
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
      version: 2,
      defaults: {
        post: {
          tts: {
            openaiTts: ['gpt-4o-mini-tts'],
            openaiTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            openaiTtsConsentId: 'cons_123',
            openaiTtsConsentAudio: 'input/examples/audio/0-audio-short.mp3',
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
      'openai-tts-consent-audio': 'input/examples/audio/0-audio-short.mp3',
      'openai-tts-consent-language': 'en-US',
      'openai-tts-consent-name': 'Anthony Consent',
      'openai-tts-voice-name': 'AutoShow Anthony'
    })
  })

  test('buildConfigPatchFromFlags saves and merges ElevenLabs TTS clone defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'elevenlabs-tts': ['eleven_flash_v2_5'],
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
      version: 2,
      defaults: {
        post: {
          tts: {
            elevenlabsTts: ['eleven_flash_v2_5'],
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'elevenlabs-tts': ['eleven_flash_v2_5'],
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony',
      'elevenlabs-tts-clone-remove-background-noise': true
    })
  })

  test('buildConfigPatchFromFlags saves and merges ElevenLabs ready PVC voice defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'elevenlabs-tts': ['eleven_flash_v2_5'],
      'elevenlabs-tts-pvc-voice': 'pvc_voice_123'
    }, new Set([
      'elevenlabs-tts',
      'elevenlabs-tts-pvc-voice'
    ]))

    expect(patch).toEqual({
      version: 2,
      defaults: {
        post: {
          tts: {
            elevenlabsTts: ['eleven_flash_v2_5'],
            elevenlabsTtsPvcVoice: 'pvc_voice_123'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'elevenlabs-tts': ['eleven_flash_v2_5'],
      'elevenlabs-tts-pvc-voice': 'pvc_voice_123'
    })
  })

  test('buildConfigPatchFromFlags saves and merges deAPI TTS clone defaults', () => {
    const patch = buildConfigPatchFromFlags({
      'deapi-tts': ['Qwen3_TTS_12Hz_1_7B_Base'],
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3',
      'deapi-tts-ref-text': 'Reference transcript.'
    }, new Set(['deapi-tts', 'deapi-tts-ref-audio', 'deapi-tts-ref-text']))

    expect(patch).toEqual({
      version: 2,
      defaults: {
        post: {
          tts: {
            deapiTts: ['Qwen3_TTS_12Hz_1_7B_Base'],
            deapiTtsRefAudio: 'input/examples/audio/0-audio-short.mp3',
            deapiTtsRefText: 'Reference transcript.'
          }
        }
      }
    })

    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'deapi-tts': ['Qwen3_TTS_12Hz_1_7B_Base'],
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3',
      'deapi-tts-ref-text': 'Reference transcript.'
    })
  })

  test('loadConfig accepts current v2 array-shaped defaults', async () => {
    const configPath = await writeTempConfig({
      version: 2,
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
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
            deepinfraOcr: ['allenai/olmOCR-2-7B-1025'],
            kimiOcr: ['kimi-k2.6'],
            gcloudDocai: ['ocr'],
            gcloudDocaiLocation: 'us',
            gcloudDocaiOcrProcessorId: 'processor-123',
            gcloudDocaiBucket: 'autoshow-docai-project-abc123'
          }
        },
        post: {
          tts: {
            runwayTts: ['eleven_multilingual_v2'],
            runwayTtsVoice: 'Leslie',
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            openaiTts: ['gpt-4o-mini-tts'],
            openaiVoice: 'voice_existing123',
            openaiTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            openaiTtsConsentId: 'cons_123',
            openaiTtsConsentAudio: 'input/examples/audio/0-audio-short.mp3',
            openaiTtsConsentLanguage: 'en-US',
            openaiTtsConsentName: 'Anthony Consent',
            openaiTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTts: ['eleven_flash_v2_5'],
            elevenlabsTtsPvcVoice: 'pvc_voice_123',
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true,
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsVoice: 'AutoShowTestVoice',
            minimaxTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            minimaxTtsPromptAudio: 'input/examples/audio/0-audio-short.mp3',
            minimaxTtsPromptText: 'Reference transcript.',
            minimaxTtsCloneNoiseReduction: true,
            minimaxTtsCloneVolumeNormalization: true,
            deapiTts: ['Qwen3_TTS_12Hz_1_7B_Base'],
            deapiTtsRefAudio: 'input/examples/audio/0-audio-short.mp3',
            deapiTtsRefText: 'Reference transcript.'
          },
          image: {
            bflImage: ['flux-2-pro-preview'],
            imageFormat: 'jpeg'
          }
        }
      }
    })

    await expect(loadConfig(configPath)).resolves.toMatchObject({
      version: 2,
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
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
            deepinfraOcr: ['allenai/olmOCR-2-7B-1025'],
            kimiOcr: ['kimi-k2.6'],
            gcloudDocai: ['ocr'],
            gcloudDocaiLocation: 'us',
            gcloudDocaiOcrProcessorId: 'processor-123',
            gcloudDocaiBucket: 'autoshow-docai-project-abc123'
          }
        },
        post: {
          tts: {
            runwayTts: ['eleven_multilingual_v2'],
            runwayTtsVoice: 'Leslie',
            mistralTts: ['voxtral-mini-tts-2603'],
            mistralTtsVoice: 'voice_abc123',
            mistralTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            openaiTts: ['gpt-4o-mini-tts'],
            openaiVoice: 'voice_existing123',
            openaiTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            openaiTtsConsentId: 'cons_123',
            openaiTtsConsentAudio: 'input/examples/audio/0-audio-short.mp3',
            openaiTtsConsentLanguage: 'en-US',
            openaiTtsConsentName: 'Anthony Consent',
            openaiTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTts: ['eleven_flash_v2_5'],
            elevenlabsTtsPvcVoice: 'pvc_voice_123',
            elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            elevenlabsTtsVoiceName: 'AutoShow Anthony',
            elevenlabsTtsCloneRemoveBackgroundNoise: true,
            minimaxTts: ['speech-2.8-turbo'],
            minimaxTtsVoice: 'AutoShowTestVoice',
            minimaxTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
            minimaxTtsPromptAudio: 'input/examples/audio/0-audio-short.mp3',
            minimaxTtsPromptText: 'Reference transcript.',
            minimaxTtsCloneNoiseReduction: true,
            minimaxTtsCloneVolumeNormalization: true,
            deapiTts: ['Qwen3_TTS_12Hz_1_7B_Base'],
            deapiTtsRefAudio: 'input/examples/audio/0-audio-short.mp3',
            deapiTtsRefText: 'Reference transcript.'
          },
          image: {
            bflImage: ['flux-2-pro-preview'],
            imageFormat: 'jpeg'
          }
        }
      }
    })
  })

  test('legacy schema shapes are rejected', async () => {
    const legacyScalarConfig = await writeTempConfig({
      version: 2,
      defaults: {
        llm: {
          openai: 'gpt-5.4-mini'
        }
      }
    })
    const legacyPricingConfig = await writeTempConfig({
      version: 2,
      pricing: {
        maxUsd: 1
      }
    })

    await expect(loadConfig(legacyScalarConfig)).rejects.toThrow('autoshow config')
    await expect(loadConfig(legacyPricingConfig)).rejects.toThrow('autoshow config')
  })
})
