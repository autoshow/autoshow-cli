import { expect, test } from 'bun:test'
import { defineVideoServicePriceTests } from '../../test-utils/define-video-service-test'
import { runCommand } from '../../test-utils/test-helpers'

defineVideoServicePriceTests({
  models: [
    { model: 'veo-3.1-fast-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-lite-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
  ],
  cliFlag: '--gemini-video',
  videoService: 'gemini',
})

defineVideoServicePriceTests({
  models: [
    { model: 'MiniMax-Hailuo-2.3', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'MiniMax-Hailuo-02', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01-Director', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
  ],
  cliFlag: '--minimax-video',
  videoService: 'minimax',
})

defineVideoServicePriceTests({
  models: [
    { model: 'Ltxv_13B_0_9_8_Distilled_FP8', extraArgs: ['--video-duration', '2', '--video-size', '256x256'], expectedDuration: 2 },
  ],
  cliFlag: '--deapi-video',
  videoService: 'deapi',
})

test('Gemini video rejects unsupported 4k resolution with --price', async () => {
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
