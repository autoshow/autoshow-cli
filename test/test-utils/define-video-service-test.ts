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

const VIDEO_GEN_TITLE = 'video-gen'
const PRICE_PROMPT = 'a cinematic mountain sunrise'
const DEFAULT_LIVE_PROMPT = 'a static shot of a tiny red dot on white background'
type VideoTestService = 'gemini' | 'minimax' | 'glm' | 'grok' | 'runway'

export const defineVideoServiceTest = ({
  models,
  provider,
  videoService,
  envVarKey,
  envVarDescription,
  timeoutMs = E2E_TEST_TIMEOUT_MS,
}: {
  models: Array<{ model: string, extraArgs?: string[], expectedDuration?: number, prompt?: string }>
  provider: string
  videoService: VideoTestService
  envVarKey: string
  envVarDescription: string
  timeoutMs?: number
}): void => {
  defineInvalidModelTest(`rejects invalid model for ${provider}`, [
    'src/cli/create-cli.ts',
    'video',
    PRICE_PROMPT,
    '--provider',
    `${provider}=invalid-model`
  ])

  withOutputLifecycle(VIDEO_GEN_TITLE)

  for (const { model, extraArgs, expectedDuration, prompt } of models) {
    const budgetKey = `video-${videoService}-${model}`
    budgetedTest(budgetKey, `${videoService} ${model} generates video and metadata`, async () => {
      await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)

      const outputDir = await runCommandAndExpectOutputDir(VIDEO_GEN_TITLE, [
        'src/cli/create-cli.ts',
        'video',
        prompt ?? DEFAULT_LIVE_PROMPT,
        '--provider',
        `${provider}=${model}`,
        ...(extraArgs ?? [])
      ])

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
    }, timeoutMs)
  }
}

export const defineVideoServicePriceTests = ({
  models,
  provider,
  videoService,
}: {
  models: Array<{ model: string, extraArgs?: string[], expectedDuration?: number, prompt?: string }>
  provider: string
  videoService: VideoTestService
}): void => {
  for (const { model } of models) {
    test(`${videoService} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'video',
        PRICE_PROMPT,
        '--provider',
        `${provider}=${model}`,
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
