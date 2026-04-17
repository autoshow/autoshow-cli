import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { applyModelConfigCalibrations } from '../../test-runner/model-calibration'

describe('test runner model calibration', () => {
  test('updates model estimation fields from accumulated drift data', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-cli-bun-calibration-'))
    const configPath = join(rootDir, 'llm-config.json')
    const runDir = join(rootDir, 'run-1')
    const metadataDir = join(runDir, 'metadata')

    try {
      await mkdir(metadataDir, { recursive: true })
      await writeFile(configPath, JSON.stringify({
        openai: {
          description: 'OpenAI language models',
          type: 'api',
          models: {
            'gpt-5.4': {
              description: 'GPT-5.1',
              inputCostPer1MUSD: 2,
              inputCostPer1MCents: 200,
              outputCostPer1MUSD: 8,
              outputCostPer1MCents: 800,
              estimation: {
                costMultiplier: 1,
                msPer1KTokens: 15000,
              },
            },
          },
        },
      }, null, 2))

      const metadata = {
        step3: {
          llmService: 'openai',
          llmModel: 'gpt-5.4',
          processingTime: 2000,
          inputTokenCount: 100,
          outputTokenCount: 100,
          outputFileName: 'text.json',
          outputFormat: 'json',
          structuredMode: 'off',
          structuredPresetNames: [],
        },
        cost: {
          estimated: {
            totalCost: 0.4,
            steps: [
              {
                step: 'llm',
                provider: 'openai',
                model: 'gpt-5.4',
                cost: 0.4,
                costMultiplier: 1,
                estimatedInputTokens: 100,
                estimatedOutputTokens: 100,
              },
            ],
          },
          actual: {
            totalCost: 0.2,
            steps: [
              {
                step: 'llm',
                provider: 'openai',
                model: 'gpt-5.4',
                cost: 0.2,
                inputMetric: 'tokens',
                inputValue: 200,
              },
            ],
          },
        },
        timing: {
          actual: {
            steps: [
              {
                step: 'llm',
                provider: 'openai',
                model: 'gpt-5.4',
                processingTimeMs: 2000,
                inputMetric: 'tokens',
                inputValue: 200,
              },
            ],
          },
        },
      }

      await writeFile(join(metadataDir, 'sample.json'), JSON.stringify(metadata, null, 2))

      const report = await applyModelConfigCalibrations(rootDir, { llm: configPath })
      expect(report.updatedModels).toBe(1)
      expect(report.updates[0]).toMatchObject({
        kind: 'llm',
        service: 'openai',
        model: 'gpt-5.4',
        costSamples: 1,
        timeSamples: 1,
        oldCostMultiplier: 1,
        newCostMultiplier: 0.825,
        medianCostMultiplier: 0.5,
        timeField: 'msPer1KTokens',
        oldTimeValue: 15000,
        newTimeValue: 13250,
        medianTimeValue: 10000,
      })

      const updated = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
      const estimation = ((((updated['openai'] as Record<string, unknown>)['models'] as Record<string, unknown>)['gpt-5.4'] as Record<string, unknown>)['estimation'] as Record<string, unknown>)
      expect(estimation['costMultiplier']).toBe(0.825)
      expect(estimation['msPer1KTokens']).toBe(13250)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
