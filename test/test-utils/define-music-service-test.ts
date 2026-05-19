import { expect, test } from 'bun:test'
import {
  fileExists,
  cleanupTestOutput,
  runCommand,
} from './test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineInvalidModelTest,
  runCommandAndExpectOutputDir,
  shouldSkipMissingEnv,
  withOutputLifecycle
} from './service-test-kit'
import { readRunMetadata } from './manifest-helpers'

const MUSIC_GEN_TITLE = 'music-gen'

export const defineMusicServiceTest = ({
  models,
  cliFlag,
  musicService,
  envVarKey,
}: {
  models: Array<{ model: string, prompt: string, extraArgs?: string[] }>
  cliFlag: string
  musicService: string
  envVarKey: string
}): void => {
  defineInvalidModelTest(`rejects invalid ${musicService} music model`, [
    'src/cli/create-cli.ts',
    'music',
    'an ambient piano song',
    cliFlag,
    'invalid-model'
  ])

  withOutputLifecycle(MUSIC_GEN_TITLE)

  for (const { model, prompt, extraArgs } of models) {
    const budgetKey = `music-${musicService}-${model}`
    budgetedTest(budgetKey, `${musicService} ${model} generates music and metadata`, async () => {
      await cleanupTestOutput(MUSIC_GEN_TITLE)

      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} not configured`)) {
        return
      }

      const outputDir = await runCommandAndExpectOutputDir(MUSIC_GEN_TITLE, [
        'src/cli/create-cli.ts',
        'music',
        prompt,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      if (outputDir) {
        const musicExists = await fileExists(`${outputDir}/generated-music.mp3`)
        expect(musicExists).toBe(true)

        const metadata = await readRunMetadata(outputDir) as {
          music?: Array<{ musicService?: string; musicModel?: string; musicFileName?: string }>
        }
        expect(metadata.music?.[0]?.musicService).toBe(musicService)
        expect(metadata.music?.[0]?.musicModel).toBe(model)
        expect(metadata.music?.[0]?.musicFileName).toBe('generated-music.mp3')
      }
    }, E2E_TEST_TIMEOUT_MS)
  }
}

export const defineMusicServicePriceTests = ({
  models,
  cliFlag,
  musicService,
}: {
  models: Array<{ model: string, prompt: string, extraArgs?: string[] }>
  cliFlag: string
  musicService: string
}): void => {
  for (const { model } of models) {
    test(`${musicService} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'music',
        'an ambient piano song',
        cliFlag,
        model,
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
