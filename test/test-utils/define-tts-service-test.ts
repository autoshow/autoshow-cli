import { expect } from 'bun:test'
import {
  fileExists,
  cleanupTestOutput,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
} from './test-helpers'
import { budgetedTest } from './budget'
import {
  defineInvalidModelTest,
  definePriceEstimateTest,
  runCommandAndExpectOutputDir,
  shouldSkipMissingEnv,
  withOutputLifecycle
} from './service-test-kit'

export const defineTTSServiceTest = ({
  models,
  cliFlag,
  ttsService,
  envVarKey,
  envVarDescription,
  extraArgs,
  resolveExpectedSpeaker,
}: {
  models: readonly string[]
  cliFlag: string
  ttsService: string
  envVarKey: string
  envVarDescription: string
  extraArgs?: string[]
  resolveExpectedSpeaker?: () => Promise<string>
}): void => {
  withOutputLifecycle(STABLE_TTS_MD_TITLE)

  defineInvalidModelTest(`rejects invalid ${ttsService} model`, [
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    cliFlag,
    'invalid-model'
  ])

  for (const model of models) {
    const budgetKey = `tts-${ttsService}-${model}`

    definePriceEstimateTest(budgetKey, `--price prints estimate for ${model}`, [
      'src/cli/create-cli.ts',
      'tts',
      STABLE_TTS_MD_PATH,
      cliFlag,
      model,
      '--price'
    ])
  }

  for (const model of models) {
    const budgetKey = `tts-${ttsService}-${model}`

    budgetedTest(budgetKey, `${model} generates speech.wav`, async () => {
      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} is required for ${envVarDescription}`)) {
        return
      }

      await cleanupTestOutput(STABLE_TTS_MD_TITLE)

      const outputDir = await runCommandAndExpectOutputDir(STABLE_TTS_MD_TITLE, [
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      if (outputDir) {
        const audioExists = await fileExists(`${outputDir}/speech.wav`)
        expect(audioExists).toBe(true)

        const audioFile = Bun.file(`${outputDir}/speech.wav`)
        expect(audioFile.size).toBeGreaterThan(0)

        const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
          tts?: { ttsService?: string, ttsModel?: string, speaker?: string, audioFileName?: string }
        }
        expect(metadata.tts?.ttsService).toBe(ttsService)
        expect(metadata.tts?.ttsModel).toBe(model)
        if (resolveExpectedSpeaker) {
          const expectedSpeaker = await resolveExpectedSpeaker()
          expect(metadata.tts?.speaker).toBe(expectedSpeaker)
        }
        expect(metadata.tts?.audioFileName).toBe('speech.wav')
      }
    })
  }
}
