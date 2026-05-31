import { expect, test } from 'bun:test'
import {
  fileExists,
  runCommand,
} from './test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineInvalidModelTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'
import { readRunMetadata } from './manifest-helpers'

const MUSIC_GEN_TITLE = 'music-gen'
type ExpectedLyricsSource = 'provided' | 'generated' | 'none'
type MusicServiceModelCase = {
  model: string
  prompt: string
  extraArgs?: string[]
  expectedLyricsSource?: ExpectedLyricsSource
  commandTimeoutMs?: number
  testTimeoutMs?: number
}

export const defineMusicServiceTest = ({
  models,
  provider,
  musicService,
  envVarKey,
}: {
  models: MusicServiceModelCase[]
  provider: string
  musicService: string
  envVarKey: string
}): void => {
  defineInvalidModelTest(`rejects invalid ${musicService} music model`, [
    'src/cli/create-cli.ts',
    'music',
    'an ambient piano song',
    '--provider',
    `${provider}=invalid-model`
  ])

  withOutputLifecycle(MUSIC_GEN_TITLE)

  for (const { model, prompt, extraArgs, expectedLyricsSource, commandTimeoutMs, testTimeoutMs } of models) {
    const budgetKey = `music-${musicService}-${model}`
    budgetedTest(budgetKey, `${musicService} ${model} generates music and metadata`, async () => {
      await requireConfiguredEnvVar(envVarKey, `${envVarKey} not configured`)

      const outputDir = await runCommandAndExpectOutputDir(
        MUSIC_GEN_TITLE,
        [
          'src/cli/create-cli.ts',
          'music',
          prompt,
          '--provider',
          `${provider}=${model}`,
          ...(extraArgs ?? [])
        ],
        commandTimeoutMs === undefined ? undefined : { timeoutMs: commandTimeoutMs }
      )

      const musicExists = await fileExists(`${outputDir}/generated-music.mp3`)
      expect(musicExists).toBe(true)
      const musicFile = Bun.file(`${outputDir}/generated-music.mp3`)
      expect(musicFile.size).toBeGreaterThan(0)

      const metadata = await readRunMetadata(outputDir) as {
        music?: Array<{ musicService?: string; musicModel?: string; musicFileName?: string; lyricsSource?: ExpectedLyricsSource }>
      }
      expect(metadata.music?.[0]?.musicService).toBe(musicService)
      expect(metadata.music?.[0]?.musicModel).toBe(model)
      expect(metadata.music?.[0]?.musicFileName).toBe('generated-music.mp3')
      if (expectedLyricsSource) {
        expect(metadata.music?.[0]?.lyricsSource).toBe(expectedLyricsSource)
      }
    }, testTimeoutMs ?? E2E_TEST_TIMEOUT_MS)
  }
}

export const defineMusicServicePriceTests = ({
  models,
  provider,
  musicService,
}: {
  models: MusicServiceModelCase[]
  provider: string
  musicService: string
}): void => {
  for (const { model } of models) {
    test(`${musicService} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'music',
        'an ambient piano song',
        '--provider',
        `${provider}=${model}`,
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
