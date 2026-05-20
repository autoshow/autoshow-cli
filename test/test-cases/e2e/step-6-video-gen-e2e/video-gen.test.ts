import { test, expect } from 'bun:test'
import { defineVideoServiceTest } from '../../../test-utils/define-video-service-test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../test-utils/budget'
import {
  cleanupTestOutput,
  fileExists,
  findLatestDirectory,
  runCommand
} from '../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVars } from '../../../test-utils/service-test-kit'

const VIDEO_GEN_TITLE = 'video-gen'

defineVideoServiceTest({
  models: [
    { model: 'veo-3.1-fast-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
  ],
  cliFlag: '--gemini',
  videoService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'MiniMax-Hailuo-2.3', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'MiniMax-Hailuo-2.3-Fast', extraArgs: ['--video-mode', 'image-to-video', '--video-input-image', 'input/examples/document/1-document.jpg', '--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'MiniMax-Hailuo-02', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01-Director', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
  ],
  cliFlag: '--minimax',
  videoService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'cogvideox-3', extraArgs: ['--video-duration', '5'], expectedDuration: 5 },
    { model: 'viduq1-text', extraArgs: ['--video-duration', '5'], expectedDuration: 5 },
  ],
  cliFlag: '--glm',
  videoService: 'glm',
  envVarKey: 'GLM_API_KEY',
  envVarDescription: 'GLM video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'grok-imagine-video', extraArgs: ['--video-duration', '1', '--video-resolution', '480p'] },
  ],
  cliFlag: '--grok',
  videoService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'Grok video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'gen4.5', extraArgs: ['--video-duration', '5'], expectedDuration: 5, prompt: 'A serene mountain landscape at sunrise with mist rolling through the valleys' },
  ],
  cliFlag: '--runway',
  videoService: 'runway',
  envVarKey: 'RUNWAYML_API_SECRET',
  envVarDescription: 'Runway video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'Ltx2_19B_Dist_FP8', extraArgs: ['--video-duration', '1', '--video-size', '512x512'] },
    { model: 'Ltx2_3_22B_Dist_INT8', extraArgs: ['--video-duration', '1', '--video-size', '512x512'] },
  ],
  cliFlag: '--deapi',
  videoService: 'deapi',
  envVarKey: 'DEAPI_API_KEY',
  envVarDescription: 'deAPI video generation',
})

test('requires a provider flag', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise'],
  )
  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Specify a video generation provider')
})

budgetedTest('video-multi-gemini-lite-deapi-ltxv', 'live multi-provider run writes provider-specific video artifacts', async () => {
  await requireConfiguredEnvVars(['GEMINI_API_KEY', 'DEAPI_API_KEY'], 'GEMINI_API_KEY and DEAPI_API_KEY are required for multi-provider video coverage')

  await cleanupTestOutput(VIDEO_GEN_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'video',
    'a static shot of a tiny red dot on white background',
    '--gemini',
    'veo-3.1-lite-generate-preview',
    '--deapi',
    'Ltxv_13B_0_9_8_Distilled_FP8',
    '--video-duration',
    '1',
    '--video-size',
    '256x256',
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(VIDEO_GEN_TITLE)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${VIDEO_GEN_TITLE}`)
  }

  expect(await fileExists(`${outputDir}/generated-video-gemini-veo-3.1-lite-generate-preview.mp4`)).toBe(true)
  expect(await fileExists(`${outputDir}/generated-video-deapi-Ltxv_13B_0_9_8_Distilled_FP8.mp4`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    video?: Array<{
      videoGenService?: string
      videoGenModel?: string
      videoFileName?: string
    }>
  }
  const videoEntries = metadata.video ?? []
  expect(videoEntries).toHaveLength(2)
  expect(videoEntries.some((entry) =>
    entry.videoGenService === 'gemini'
    && entry.videoGenModel === 'veo-3.1-lite-generate-preview'
    && entry.videoFileName === 'generated-video-gemini-veo-3.1-lite-generate-preview.mp4'
  )).toBe(true)
  expect(videoEntries.some((entry) =>
    entry.videoGenService === 'deapi'
    && entry.videoGenModel === 'Ltxv_13B_0_9_8_Distilled_FP8'
    && entry.videoFileName === 'generated-video-deapi-Ltxv_13B_0_9_8_Distilled_FP8.mp4'
  )).toBe(true)
}, E2E_TEST_TIMEOUT_MS)
