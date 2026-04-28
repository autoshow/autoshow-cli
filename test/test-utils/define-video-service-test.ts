import { expect } from 'bun:test'
import {
  fileExists,
  cleanupTestOutput,
} from './test-helpers'
import { budgetedTest } from './budget'
import {
  defineInvalidModelTest,
  definePriceEstimateTest,
  runCommandAndExpectOutputDir,
  shouldSkipMissingEnv,
  withOutputLifecycle
} from './service-test-kit'
import { readRunMetadata } from './manifest-helpers'

const VIDEO_GEN_TITLE = 'video-gen'
const PRICE_PROMPT = 'a cinematic mountain sunrise'
const DEFAULT_LIVE_PROMPT = 'a static shot of a tiny red dot on white background'
const DEFAULT_TIMEOUT_MS = 16 * 60_000

export const defineVideoServiceTest = ({
  models,
  cliFlag,
  videoService,
  envVarKey,
  envVarDescription,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  models: Array<{ model: string, extraArgs?: string[], expectedDuration?: number, prompt?: string }>
  cliFlag: string
  videoService: 'gemini' | 'minimax' | 'deapi'
  envVarKey: string
  envVarDescription: string
  timeoutMs?: number
}): void => {
  defineInvalidModelTest(`rejects invalid model for ${cliFlag}`, [
    'src/cli/create-cli.ts',
    'video',
    PRICE_PROMPT,
    cliFlag,
    'invalid-model'
  ])

  for (const { model } of models) {
    const budgetKey = `video-${videoService}-${model}`
    definePriceEstimateTest(budgetKey, `${model} --price prints estimate`, [
      'src/cli/create-cli.ts',
      'video',
      PRICE_PROMPT,
      cliFlag,
      model,
      '--price'
    ])
  }

  withOutputLifecycle(VIDEO_GEN_TITLE)

  for (const { model, extraArgs, expectedDuration, prompt } of models) {
    const budgetKey = `video-${videoService}-${model}`
    budgetedTest(budgetKey, `${videoService} ${model} generates video and metadata`, async () => {
      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} is required for ${envVarDescription}`)) {
        return
      }

      await cleanupTestOutput(VIDEO_GEN_TITLE)

      const outputDir = await runCommandAndExpectOutputDir(VIDEO_GEN_TITLE, [
        'src/cli/create-cli.ts',
        'video',
        prompt ?? DEFAULT_LIVE_PROMPT,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      if (outputDir) {
        const videoExists = await fileExists(`${outputDir}/generated-video.mp4`)
        expect(videoExists).toBe(true)

        const videoFile = Bun.file(`${outputDir}/generated-video.mp4`)
        expect(videoFile.size).toBeGreaterThan(0)

        const metadata = await readRunMetadata(outputDir) as {
          video?: Array<{
            videoGenService?: string
            videoGenModel?: string
            videoFileName?: string
            videoFileSize?: number
            videoDuration?: number
          }>
        }
        expect(metadata.video?.[0]?.videoGenService).toBe(videoService)
        expect(metadata.video?.[0]?.videoGenModel).toBe(model)
        expect(metadata.video?.[0]?.videoFileName).toBe('generated-video.mp4')
        expect(metadata.video?.[0]?.videoFileSize).toBe(videoFile.size)
        if (expectedDuration !== undefined) {
          expect(metadata.video?.[0]?.videoDuration).toBe(expectedDuration)
        }
      }
    }, timeoutMs)
  }
}
