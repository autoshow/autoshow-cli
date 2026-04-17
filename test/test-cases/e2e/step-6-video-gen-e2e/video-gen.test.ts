import { test, expect } from 'bun:test'
import { defineVideoServiceTest } from '../../../test-utils/define-video-service-test'
import { budgetedTest } from '../../../test-utils/budget'
import {
  cleanupTestOutput,
  fileExists,
  findLatestDirectory,
  hasConfiguredEnvVar,
  runCommand
} from '../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../test-utils/manifest-helpers'

const VIDEO_GEN_TITLE = 'video-gen'
const LIVE_VIDEO_TIMEOUT_MS = 16 * 60_000

defineVideoServiceTest({
  models: [
    { model: 'veo-3.1-fast-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
  ],
  cliFlag: '--gemini-video',
  videoService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini video generation',
})

test('requires a provider flag', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise'],
  )
  expect(result.exitCode).not.toBe(0)
})

test('allows multiple providers with --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-generate-preview', '--minimax-video', 'MiniMax-Hailuo-2.3', '--price'],
  )
  expect(result.exitCode).toBe(0)
})

budgetedTest('video-multi-provider-gemini-minimax', 'live multi-provider run writes provider-specific video artifacts', async () => {
  const hasGemini = await hasConfiguredEnvVar('GEMINI_API_KEY')
  const hasMinimax = await hasConfiguredEnvVar('MINIMAX_API_KEY')
  if (!hasGemini || !hasMinimax) {
    console.log('Skipping: GEMINI_API_KEY and MINIMAX_API_KEY are required for multi-provider video coverage')
    return
  }

  await cleanupTestOutput(VIDEO_GEN_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'video',
    'a static shot of a tiny red dot on white background',
    '--gemini-video',
    'veo-3.1-fast-generate-preview',
    '--minimax-video',
    'T2V-01',
    '--video-duration',
    '4',
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(VIDEO_GEN_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/generated-video-gemini-veo-3.1-fast-generate-preview.mp4`)).toBe(true)
    expect(await fileExists(`${outputDir}/generated-video-minimax-T2V-01.mp4`)).toBe(true)

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
      && entry.videoGenModel === 'veo-3.1-fast-generate-preview'
      && entry.videoFileName === 'generated-video-gemini-veo-3.1-fast-generate-preview.mp4'
    )).toBe(true)
    expect(videoEntries.some((entry) =>
      entry.videoGenService === 'minimax'
      && entry.videoGenModel === 'T2V-01'
      && entry.videoFileName === 'generated-video-minimax-T2V-01.mp4'
    )).toBe(true)
  }
}, LIVE_VIDEO_TIMEOUT_MS)
