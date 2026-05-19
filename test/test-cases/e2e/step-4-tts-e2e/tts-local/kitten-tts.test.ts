import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
  hasConfiguredEnvVar,
} from '../../../../test-utils/test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../test-utils/budget'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'

const hasOpenAiTtsEnv = async (): Promise<boolean> => {
  return await hasConfiguredEnvVar('OPENAI_API_KEY')
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}

describe('kitten-tts', () => {
  describe('tts command', () => {
    beforeAll(async () => {
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)
    })

    afterAll(async () => {
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)
    })

    const kittenModelCases = [
      { model: 'kitten-tts-micro', speaker: 'Bella', budgetKey: 'tts-kitten-micro' },
      { model: 'kitten-tts-mini', speaker: 'Luna', budgetKey: 'tts-kitten-mini' },
      { model: 'kitten-tts-nano', speaker: 'Rosie', budgetKey: 'tts-kitten-nano' },
      { model: 'kitten-tts-nano-0.8-int8', speaker: 'Hugo', budgetKey: 'tts-kitten-nano-0.8-int8' },
    ] as const

    for (const kittenModelCase of kittenModelCases) {
      budgetedTest(kittenModelCase.budgetKey, `${kittenModelCase.model} with --kitten-voice ${kittenModelCase.speaker} generates speech.wav`, async () => {
        await cleanupTestOutput(STABLE_TTS_MD_TITLE)
        const testName = `${kittenModelCase.model} with --kitten-voice ${kittenModelCase.speaker} generates speech.wav`

        const result = await runCommand(
          [
            'src/cli/create-cli.ts',
            'tts',
            STABLE_TTS_MD_PATH,
            '--kitten',
            kittenModelCase.model,
            '--kitten-voice',
            kittenModelCase.speaker
          ],
          { testName }
        )

        expect(result.exitCode).toBe(0)

        const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
        expect(outputDir).not.toBeNull()

        if (outputDir) {
          const audioExists = await fileExists(`${outputDir}/speech.wav`)
          expect(audioExists).toBe(true)

          const audioFile = Bun.file(`${outputDir}/speech.wav`)
          expect(audioFile.size).toBeGreaterThan(0)

          const metadata = await readRunMetadata(outputDir) as {
            tts?: Array<{ ttsService?: string; ttsModel?: string; chunkCount?: number; audioFileName?: string; speaker?: string }>
          }
          expect(metadata.tts?.[0]?.ttsService).toBe('kitten')
          expect(metadata.tts?.[0]?.ttsModel).toBe(kittenModelCase.model)
          expect(metadata.tts?.[0]?.chunkCount).toBeGreaterThan(0)
          expect(metadata.tts?.[0]?.audioFileName).toBe('speech.wav')
          expect(metadata.tts?.[0]?.speaker).toBe(kittenModelCase.speaker)
        }
      }, E2E_TEST_TIMEOUT_MS)
    }

    budgetedTest(['tts-kitten-mini', 'tts-openai-gpt-4o-mini-tts'], 'multi-provider run succeeds when one local and one API target are both available', async () => {
      if (!await hasOpenAiTtsEnv()) {
        console.log('Skipping: OPENAI_API_KEY is required for multi-provider TTS success coverage')
        return
      }

      await cleanupTestOutput(STABLE_TTS_MD_TITLE)

      const result = await runCommand([
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        '--kitten',
        'kitten-tts-mini',
        '--kitten-voice',
        'Luna',
        '--openai',
        'gpt-4o-mini-tts'
      ])

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        expect(await fileExists(`${outputDir}/speech-kitten-kitten-tts-mini.wav`)).toBe(true)
        expect(await fileExists(`${outputDir}/speech-openai-gpt-4o-mini-tts.wav`)).toBe(true)

        const metadata = await readRunMetadata(outputDir)
        const ttsEntries = toRecordArray(metadata['tts'])
        expect(ttsEntries).toHaveLength(2)
        expect(ttsEntries[0]?.['ttsService']).toBe('kitten')
        expect(ttsEntries[0]?.['ttsModel']).toBe('kitten-tts-mini')
        expect(ttsEntries[0]?.['audioFileName']).toBe('speech-kitten-kitten-tts-mini.wav')
        expect(ttsEntries[1]?.['ttsService']).toBe('openai')
        expect(ttsEntries[1]?.['ttsModel']).toBe('gpt-4o-mini-tts')
        expect(ttsEntries[1]?.['audioFileName']).toBe('speech-openai-gpt-4o-mini-tts.wav')

        const cost = isRecord(metadata['cost']) ? metadata['cost'] : null
        const actualCost = cost && isRecord(cost['actual']) ? cost['actual'] : null
        const timing = isRecord(metadata['timing']) ? metadata['timing'] : null
        const actualTiming = timing && isRecord(timing['actual']) ? timing['actual'] : null
        const actualCostSteps = actualCost ? toRecordArray(actualCost['steps']) : []
        const actualTimingSteps = actualTiming ? toRecordArray(actualTiming['steps']) : []
        expect(actualCostSteps.filter((step) => step['step'] === 'tts')).toHaveLength(2)
        expect(actualTimingSteps.filter((step) => step['step'] === 'tts')).toHaveLength(2)
      }
    }, E2E_TEST_TIMEOUT_MS)

    budgetedTest('tts-kitten-mini', 'multi-provider run stays successful when one selected target fails', async () => {
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)

      const result = await runCommand(
        [
          'src/cli/create-cli.ts',
          'tts',
          STABLE_TTS_MD_PATH,
          '--kitten',
          'kitten-tts-mini',
          '--openai',
          'gpt-4o-mini-tts'
        ],
        {
          env: {
            OPENAI_API_KEY: ''
          }
        }
      )

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        expect(await fileExists(`${outputDir}/speech-kitten-kitten-tts-mini.wav`)).toBe(true)
        expect(await fileExists(`${outputDir}/speech-openai-gpt-4o-mini-tts.wav`)).toBe(false)

        const metadata = await readRunMetadata(outputDir)
        const ttsEntries = toRecordArray(metadata['tts'])
        expect(ttsEntries).toHaveLength(1)
        expect(ttsEntries[0]?.['ttsService']).toBe('kitten')
        expect(ttsEntries[0]?.['audioFileName']).toBe('speech-kitten-kitten-tts-mini.wav')
      }
    }, E2E_TEST_TIMEOUT_MS)

    test('multi-provider run fails when every selected target fails', async () => {
      const result = await runCommand(
        [
          'src/cli/create-cli.ts',
          'tts',
          STABLE_TTS_MD_PATH,
          '--openai',
          'gpt-4o-mini-tts',
          '--gemini',
          'gemini-3.1-flash-tts-preview'
        ],
        {
          env: {
            OPENAI_API_KEY: '',
            GEMINI_API_KEY: ''
          }
        }
      )

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr + result.stdout).toContain('No TTS outputs were generated')
    })
  })

  describe('validation', () => {
    test('rejects invalid kitten model', async () => {
      const result = await runCommand(
        ['src/cli/create-cli.ts', 'tts', STABLE_TTS_MD_PATH, '--kitten', 'invalid-model'],
      )

      expect(result.exitCode).not.toBe(0)
    })

    test('rejects invalid kitten speaker', async () => {
      const result = await runCommand(
        ['src/cli/create-cli.ts', 'tts', STABLE_TTS_MD_PATH, '--kitten', 'kitten-tts-mini', '--kitten-voice', 'InvalidVoice'],
      )

      expect(result.exitCode).not.toBe(0)
    })
  })
})
