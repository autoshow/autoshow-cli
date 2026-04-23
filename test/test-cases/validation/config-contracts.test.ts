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
      'tesseract-ocr': true,
      dpi: '450',
      'batch-limit': '7',
      'max-cents': '25'
    }, new Set(['openai', 'tesseract-ocr', 'dpi', 'batch-limit', 'max-cents']))).toEqual({
      version: 2,
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini']
        },
        extract: {
          ocr: {
            tesseract: true,
            dpi: 450
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

  test('loadConfig accepts current v2 array-shaped defaults', async () => {
    const configPath = await writeTempConfig({
      version: 2,
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini']
        },
        extract: {
          stt: {
            deepgramStt: ['nova-3']
          }
        }
      }
    })

    await expect(loadConfig(configPath)).resolves.toMatchObject({
      version: 2,
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini']
        },
        extract: {
          stt: {
            deepgramStt: ['nova-3']
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
