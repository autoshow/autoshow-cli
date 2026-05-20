import { expect, test } from 'bun:test'
import {
  fileExists,
  cleanupTestOutput,
  runCommand,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
} from './test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineInvalidModelTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
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
  inputPath = STABLE_EXAMPLE_AUDIO_URL,
  inputTitle = STABLE_EXAMPLE_AUDIO_TITLE,
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
  inputPath?: string
  inputTitle?: string
  timeoutMs?: number
}): void => {
  withOutputLifecycle(inputTitle)

  defineInvalidModelTest(`rejects invalid ${sttService} model`, [
    'src/cli/create-cli.ts',
    'extract',
    inputPath,
    cliFlag,
    'invalid-model'
  ])

  for (const model of models) {
    const budgetKey = `transcribe-${sttService}-${model}`

    budgetedTest(budgetKey, `${sttService} ${model} transcribes local audio`, async () => {
      await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)
      for (const extraEnvVarKey of extraEnvVarKeys ?? []) {
        await requireConfiguredEnvVar(extraEnvVarKey, `${extraEnvVarKey} is required for ${envVarDescription}`)
      }

      if (shouldSkipReadiness && await shouldSkipReadiness()) {
        throw new Error(`${sttService} ${model} readiness prerequisite failed`)
      }

      await cleanupTestOutput(inputTitle)

      const outputDir = await runCommandAndExpectOutputDir(inputTitle, [
        'src/cli/create-cli.ts',
        'extract',
        inputPath,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

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
        STABLE_EXAMPLE_AUDIO_URL,
        cliFlag,
        model,
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
