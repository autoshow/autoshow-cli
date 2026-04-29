import { test, expect } from 'bun:test'
import { defineVideoServiceTest } from '../../../test-utils/define-video-service-test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../test-utils/budget'
import {
  cleanupTestOutput,
  fileExists,
  findLatestDirectory,
  hasConfiguredEnvVar,
  runCommand
} from '../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../test-utils/manifest-helpers'

const VIDEO_GEN_TITLE = 'video-gen'

defineVideoServiceTest({
  models: [
    { model: 'veo-3.1-fast-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-lite-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
  ],
  cliFlag: '--gemini-video',
  videoService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'MiniMax-Hailuo-2.3', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'MiniMax-Hailuo-02', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01-Director', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
  ],
  cliFlag: '--minimax-video',
  videoService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'Ltxv_13B_0_9_8_Distilled_FP8', extraArgs: ['--video-duration', '2', '--video-size', '256x256'], expectedDuration: 2 },
  ],
  cliFlag: '--deapi-video',
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

test('Gemini video rejects unsupported 4k resolution', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-lite-generate-preview', '--video-resolution', '4k', '--price'],
  )
  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Expected 720p or 1080p')
})

test('allows multiple providers with --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-generate-preview', '--minimax-video', 'MiniMax-Hailuo-2.3', '--glm-video', 'cogvideox-3', '--grok-video', 'grok-imagine-video', '--runway-video', 'gen4.5', '--deapi-video', 'Ltxv_13B_0_9_8_Distilled_FP8', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('gemini')
  expect(output).toContain('minimax')
  expect(output).toContain('glm')
  expect(output).toContain('grok')
  expect(output).toContain('runway')
  expect(output).toContain('deapi')
  expect(output).toContain('generated-video-gemini-veo-3.1-generate-preview.mp4')
  expect(output).toContain('generated-video-minimax-MiniMax-Hailuo-2.3.mp4')
  expect(output).toContain('generated-video-glm-cogvideox-3.mp4')
  expect(output).toContain('generated-video-grok-grok-imagine-video.mp4')
  expect(output).toContain('generated-video-runway-gen4.5.mp4')
  expect(output).toContain('generated-video-deapi-Ltxv_13B_0_9_8_Distilled_FP8.mp4')
})

test('new video providers print price estimates', async () => {
  const providers = [
    ['--glm-video', 'cogvideox-3', '20.00000¢'],
    ['--glm-video', 'viduq1-text', '40.00000¢'],
    ['--grok-video', 'grok-imagine-video', '25.00000¢'],
    ['--runway-video', 'gen4.5', '60.00000¢'],
    ['--deapi-video', 'Ltxv_13B_0_9_8_Distilled_FP8', '0.34740¢']
  ] as const

  for (const [flag, model, expectedCost] of providers) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'a cinematic mountain sunrise',
      flag,
      model,
      '--video-duration',
      '5',
      '--price'
    ])
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain(model)
    expect(output).toContain(expectedCost)
  }
})

test('Gemini video price estimates use current per-second pricing', async () => {
  const cases = [
    ['veo-3.1-lite-generate-preview', '720p', '4', '20.00000¢'],
    ['veo-3.1-lite-generate-preview', '1080p', '4', '64.00000¢'],
    ['veo-3.1-fast-generate-preview', '720p', '4', '40.00000¢'],
    ['veo-3.1-fast-generate-preview', '1080p', '4', '96.00000¢'],
    ['veo-3.1-generate-preview', '720p', '4', '160.00000¢'],
    ['veo-3.1-generate-preview', '1080p', '4', '320.00000¢']
  ] as const

  for (const [model, resolution, duration, expectedCost] of cases) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'a cinematic mountain sunrise',
      '--gemini-video',
      model,
      '--video-resolution',
      resolution,
      '--video-duration',
      duration,
      '--price'
    ])
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain(model)
    expect(output).toContain(expectedCost)
  }
})

budgetedTest(['video-gemini-veo-3.1-fast-generate-preview', 'video-minimax-T2V-01'], 'live multi-provider run writes provider-specific video artifacts', async () => {
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
}, E2E_TEST_TIMEOUT_MS)
