import { test, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar
} from './test-helpers'
import { budgetedTest } from './budget'

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
  test(`rejects invalid ${musicService} music model`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'music',
      'an ambient piano song',
      cliFlag,
      'invalid-model'
    ])
    expect(result.exitCode).not.toBe(0)
  })

  for (const { model } of models) {
    const budgetKey = `music-${musicService}-${model}`
    budgetedTest(budgetKey, `--price prints estimate for ${musicService} ${model}`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'music',
        'an ambient piano song',
        cliFlag,
        model,
        '--price'
      ])
      expect(result.exitCode).toBe(0)
    })
  }

  beforeAll(async () => {
    await cleanupTestOutput(MUSIC_GEN_TITLE)
  })

  afterAll(async () => {
    await cleanupTestOutput(MUSIC_GEN_TITLE)
  })

  for (const { model, prompt, extraArgs } of models) {
    const budgetKey = `music-${musicService}-${model}`
    budgetedTest(budgetKey, `${musicService} ${model} generates music and metadata`, async () => {
      await cleanupTestOutput(MUSIC_GEN_TITLE)

      const hasApiKey = await hasConfiguredEnvVar(envVarKey)
      if (!hasApiKey) {
        console.log(`Skipping: ${envVarKey} not configured`)
        return
      }

      const result = await runCommand([
        'src/cli/create-cli.ts',
        'music',
        prompt,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      expect(result.exitCode).toBe(0)

      const outputDir = await findLatestDirectory(MUSIC_GEN_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const musicExists = await fileExists(`${outputDir}/generated-music.mp3`)
        expect(musicExists).toBe(true)

        const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
          music?: { musicService?: string; musicModel?: string; musicFileName?: string }
        }
        expect(metadata.music?.musicService).toBe(musicService)
        expect(metadata.music?.musicModel).toBe(model)
        expect(metadata.music?.musicFileName).toBe('generated-music.mp3')
      }
    })
  }
}
