import { expect, test } from 'bun:test'
import { defineVideoServicePriceTests } from '../../test-utils/define-video-service-test'
import { runCommand } from '../../test-utils/test-helpers'

defineVideoServicePriceTests({
  models: [
    { model: 'veo-3.1-fast-generate-preview', extraArgs: ['--duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-generate-preview', extraArgs: ['--duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-lite-generate-preview', extraArgs: ['--duration', '4'], expectedDuration: 4 },
  ],
  provider: 'gemini',
  videoService: 'gemini',
})

defineVideoServicePriceTests({
  models: [
    { model: 'MiniMax-Hailuo-2.3', extraArgs: ['--duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01', extraArgs: ['--duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01-Director', extraArgs: ['--duration', '6'], expectedDuration: 6 },
  ],
  provider: 'minimax',
  videoService: 'minimax',
})

test('Gemini video rejects 4k resolution for Lite with --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'gemini=veo-3.1-lite-generate-preview', '--resolution', '4k', '--price'],
  )
  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Veo 3.1 Lite does not support --video-resolution 4k')
})

test('Gemini video allows 4k resolution for standard and Fast with approximate pricing', async () => {
  for (const model of ['veo-3.1-generate-preview', 'veo-3.1-fast-generate-preview'] as const) {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', `gemini=${model}`, '--resolution', '4k', '--duration', '4', '--price'],
    )
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain(model)
    expect(output).toContain('generated-video.mp4')
  }
})

test('allows multiple providers with --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'gemini=veo-3.1-generate-preview', '--provider', 'minimax=MiniMax-Hailuo-2.3', '--provider', 'glm=cogvideox-3', '--provider', 'grok=grok-imagine-video', '--provider', 'runway=gen4.5', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('gemini')
  expect(output).toContain('minimax')
  expect(output).toContain('glm')
  expect(output).toContain('grok')
  expect(output).toContain('runway')
  expect(output).toContain('generated-video-gemini-veo-3.1-generate-preview.mp4')
  expect(output).toContain('generated-video-minimax-MiniMax-Hailuo-2.3.mp4')
  expect(output).toContain('generated-video-glm-cogvideox-3.mp4')
  expect(output).toContain('generated-video-grok-grok-imagine-video.mp4')
  expect(output).toContain('generated-video-runway-gen4.5.mp4')
})

test('new video providers print price estimates', async () => {
  const providers = [
    ['glm', 'cogvideox-3', '20.00¢'],
    ['glm', 'viduq1-text', '40.00¢'],
    ['grok', 'grok-imagine-video', '25.00¢'],
    ['runway', 'gen4.5', '60.00¢']
  ] as const

  for (const [provider, model, expectedCost] of providers) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'a cinematic mountain sunrise',
      '--provider',
      `${provider}=${model}`,
      '--duration',
      '5',
      '--price'
    ])
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain(model)
    expect(output).toContain(expectedCost)
  }
})

test('GLM and MiniMax media video models accept --price in supported modes', async () => {
  const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
  const lastFrameDataUrl = `data:image/webp;base64,${Buffer.from([4, 5, 6]).toString('base64')}`
  const cases = [
    ['glm', 'vidu2-image', 'image-to-video', ['--input-image', imageDataUrl]],
    ['glm', 'vidu2-start-end', 'interpolate', ['--input-image', imageDataUrl, '--last-frame', lastFrameDataUrl]],
    ['glm', 'vidu2-reference', 'reference-to-video', ['--reference-image', imageDataUrl]],
    ['minimax', 'MiniMax-Hailuo-2.3-Fast', 'image-to-video', ['--input-image', imageDataUrl]],
    ['minimax', 'I2V-01-Director', 'image-to-video', ['--input-image', imageDataUrl]],
    ['minimax', 'I2V-01-live', 'image-to-video', ['--input-image', imageDataUrl]],
    ['minimax', 'I2V-01', 'image-to-video', ['--input-image', imageDataUrl]],
    ['minimax', 'S2V-01', 'reference-to-video', ['--reference-image', imageDataUrl]]
  ] as const

  for (const [provider, model, mode, mediaArgs] of cases) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'a cinematic mountain sunrise',
      '--provider',
      `${provider}=${model}`,
      '--mode',
      mode,
      ...mediaArgs,
      '--price'
    ])
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain(model)
  }
})

test('Gemini video price estimates use current per-second pricing', async () => {
  const cases = [
    ['veo-3.1-lite-generate-preview', '720p', '4', '20.00¢'],
    ['veo-3.1-lite-generate-preview', '1080p', '4', '64.00¢'],
    ['veo-3.1-fast-generate-preview', '720p', '4', '40.00¢'],
    ['veo-3.1-fast-generate-preview', '1080p', '4', '96.00¢'],
    ['veo-3.1-fast-generate-preview', '4k', '4', '96.00¢'],
    ['veo-3.1-generate-preview', '720p', '4', '$1.60'],
    ['veo-3.1-generate-preview', '1080p', '4', '$3.20'],
    ['veo-3.1-generate-preview', '4k', '4', '$3.20']
  ] as const

  for (const [model, resolution, duration, expectedCost] of cases) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'a cinematic mountain sunrise',
      '--provider',
      `gemini=${model}`,
      '--resolution',
      resolution,
      '--duration',
      duration,
      '--price'
    ])
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain(model)
    expect(output).toContain(expectedCost)
  }
})
