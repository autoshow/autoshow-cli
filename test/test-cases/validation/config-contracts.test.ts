import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfigPatchFromFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
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
      'config-path': '/tmp/autoshow.json'
    }, new Set(['reverb-stt', 'price', 'password', 'config-path']))).toEqual({
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
            runwayTtsVoice: 'Leslie'
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
            runwayTtsVoice: 'Leslie'
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
