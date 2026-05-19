import { expect, test } from 'bun:test'
import {
  fileExists,
  cleanupTestOutput,
  runCommand,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
} from './test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineInvalidModelTest,
  runCommandAndExpectOutputDir,
  shouldSkipMissingEnv,
  withOutputLifecycle
} from './service-test-kit'
import { readRunMetadata } from './manifest-helpers'

export const defineSTTServiceTest = ({
  models,
  cliFlag,
  sttService,
  envVarKey,
  envVarDescription,
  extraEnvVarKeys,
  extraArgs,
  shouldSkipReadiness,
  timeoutMs = E2E_TEST_TIMEOUT_MS,
}: {
  models: readonly string[]
  cliFlag: string
  sttService: string
  envVarKey: string
  envVarDescription: string
  extraEnvVarKeys?: string[]
  extraArgs?: string[]
  shouldSkipReadiness?: () => Promise<boolean>
  timeoutMs?: number
}): void => {
  withOutputLifecycle(STABLE_LOCAL_AUDIO_TITLE)

  defineInvalidModelTest(`rejects invalid ${sttService} model`, [
    'src/cli/create-cli.ts',
    'extract',
    STABLE_LOCAL_AUDIO_PATH,
    cliFlag,
    'invalid-model'
  ])

  for (const model of models) {
    const budgetKey = `transcribe-${sttService}-${model}`

    budgetedTest(budgetKey, `${sttService} ${model} transcribes local audio`, async () => {
      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} is required for ${envVarDescription}`)) {
        return
      }
      for (const extraEnvVarKey of extraEnvVarKeys ?? []) {
        if (await shouldSkipMissingEnv(extraEnvVarKey, `${extraEnvVarKey} is required for ${envVarDescription}`)) {
          return
        }
      }

      if (shouldSkipReadiness && await shouldSkipReadiness()) {
        return
      }

      await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

      const outputDir = await runCommandAndExpectOutputDir(STABLE_LOCAL_AUDIO_TITLE, [
        'src/cli/create-cli.ts',
        'extract',
        STABLE_LOCAL_AUDIO_PATH,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      if (outputDir) {
        const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
        expect(transcriptExists).toBe(true)

        const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
        expect(transcriptContent.length).toBeGreaterThan(0)
        expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

        expect(await fileExists(`${outputDir}/result.json`)).toBe(true)
        expect(await fileExists(`${outputDir}/transcription.evidence.json`)).toBe(false)
        expect(await fileExists(`${outputDir}/transcription.raw.json`)).toBe(false)

        const metadata = await readRunMetadata(outputDir) as {
          step2?: { transcriptionService?: string, transcriptionModel?: string }
        }
        expect(metadata.step2?.transcriptionService).toBe(sttService)
        expect(metadata.step2?.transcriptionModel).toBe(model)

        const promptExists = await fileExists(`${outputDir}/prompt.md`)
        expect(promptExists).toBe(true)

        const summaryExists = await fileExists(`${outputDir}/text.json`)
        expect(summaryExists).toBe(false)
      }
    }, timeoutMs)
  }
}

export const defineSTTServicePriceTests = ({
  models,
  cliFlag,
  sttService,
}: {
  models: readonly string[]
  cliFlag: string
  sttService: string
}): void => {
  for (const model of models) {
    test(`${sttService} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'extract',
        STABLE_LOCAL_AUDIO_PATH,
        cliFlag,
        model,
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
