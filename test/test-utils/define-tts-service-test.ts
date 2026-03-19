import { test, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
  hasConfiguredEnvVar
} from './test-helpers'
import { budgetedTest } from './budget'

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
  beforeAll(async () => {
    await cleanupTestOutput(STABLE_TTS_MD_TITLE)
  })

  afterAll(async () => {
    await cleanupTestOutput(STABLE_TTS_MD_TITLE)
  })

  test(`rejects invalid ${ttsService} model`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      STABLE_TTS_MD_PATH,
      cliFlag,
      'invalid-model'
    ])
    expect(result.exitCode).not.toBe(0)
  })

  for (const model of models) {
    const budgetKey = `tts-${ttsService}-${model}`

    budgetedTest(budgetKey, `${model} generates speech.wav`, async () => {
      if (!await hasConfiguredEnvVar(envVarKey)) {
        console.log(`Skipping: ${envVarKey} is required for ${envVarDescription}`)
        return
      }

      await cleanupTestOutput(STABLE_TTS_MD_TITLE)

      const result = await runCommand([
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      expect(result.exitCode).toBe(0)

      const outputDir = await findLatestDirectory(STABLE_TTS_MD_TITLE)
      expect(outputDir).not.toBeNull()

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

    budgetedTest(budgetKey, `--price prints estimate for ${model}`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        cliFlag,
        model,
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    })
  }
}
