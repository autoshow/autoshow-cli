import { test, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  hasConfiguredEnvVar
} from './test-helpers'
import { budgetedTest } from './budget'

export const defineSTTServiceTest = ({
  models,
  cliFlag,
  sttService,
  envVarKey,
  envVarDescription,
  extraArgs,
}: {
  models: readonly string[]
  cliFlag: string
  sttService: string
  envVarKey: string
  envVarDescription: string
  extraArgs?: string[]
}): void => {
  beforeAll(async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  afterAll(async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  test(`rejects invalid ${sttService} model`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'transcribe',
      STABLE_LOCAL_AUDIO_PATH,
      cliFlag,
      'invalid-model'
    ])
    expect(result.exitCode).not.toBe(0)
  })

  for (const model of models) {
    const budgetKey = `transcribe-${sttService}-${model}`

    budgetedTest(budgetKey, `${sttService} ${model} transcribes local audio`, async () => {
      if (!await hasConfiguredEnvVar(envVarKey)) {
        console.log(`Skipping: ${envVarKey} is required for ${envVarDescription}`)
        return
      }

      await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

      const result = await runCommand([
        'src/cli/create-cli.ts',
        'transcribe',
        STABLE_LOCAL_AUDIO_PATH,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      expect(result.exitCode).toBe(0)

      const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
        expect(transcriptExists).toBe(true)

        const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
        expect(transcriptContent.length).toBeGreaterThan(0)
        expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

        const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
          step2?: { transcriptionService?: string, transcriptionModel?: string }
        }
        expect(metadata.step2?.transcriptionService).toBe(sttService)
        expect(metadata.step2?.transcriptionModel).toBe(model)

        const promptExists = await fileExists(`${outputDir}/prompt.md`)
        expect(promptExists).toBe(true)

        const summaryExists = await fileExists(`${outputDir}/text.md`)
        expect(summaryExists).toBe(false)
      }
    })

    budgetedTest(budgetKey, `${sttService} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'transcribe',
        STABLE_LOCAL_AUDIO_PATH,
        cliFlag,
        model,
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    })
  }
}
