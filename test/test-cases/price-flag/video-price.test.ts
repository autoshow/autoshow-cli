import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineVideoServicePriceTests } from '../../test-utils/define-video-service-test'
import { runCommand } from '../../test-utils/test-helpers'

const withTempImage = async <T,>(fn: (path: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-video-price-image-'))
  try {
    const imagePath = join(dir, 'input.png')
    await writeFile(imagePath, new Uint8Array([1, 2, 3]))
    return await fn(imagePath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

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

test('positional image input defaults to compatible image-to-video targets with --price', async () => {
  await withTempImage(async (imagePath) => {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'video', imagePath, '--price'],
    )
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)

    for (const expected of [
      'generated-video-gemini-veo-3.1-fast-generate-preview.mp4',
      'generated-video-gemini-veo-3.1-generate-preview.mp4',
      'generated-video-gemini-veo-3.1-lite-generate-preview.mp4',
      'generated-video-minimax-MiniMax-Hailuo-2.3.mp4',
      'generated-video-minimax-MiniMax-Hailuo-2.3-Fast.mp4',
      'generated-video-minimax-I2V-01-Director.mp4',
      'generated-video-minimax-I2V-01-live.mp4',
      'generated-video-minimax-I2V-01.mp4',
      'generated-video-glm-cogvideox-3.mp4',
      'generated-video-glm-vidu2-image.mp4',
      'generated-video-grok-grok-imagine-video.mp4'
    ]) {
      expect(output).toContain(expected)
    }

    for (const unsupported of [
      'generated-video-runway-gen4.5.mp4',
      'generated-video-minimax-T2V-01.mp4',
      'generated-video-minimax-T2V-01-Director.mp4',
      'generated-video-minimax-S2V-01.mp4',
      'generated-video-glm-viduq1-text.mp4',
      'generated-video-glm-vidu2-start-end.mp4',
      'generated-video-glm-vidu2-reference.mp4'
    ]) {
      expect(output).not.toContain(unsupported)
    }
  })
})

test('positional text input defaults to cheapest text-to-video target with --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('minimax')
  expect(output).toContain('T2V-01')
  expect(output).toContain('generated-video.mp4')
  expect(output).not.toContain('generated-video-gemini')
  expect(output).not.toContain('generated-video-glm')
  expect(output).not.toContain('generated-video-grok')
  expect(output).not.toContain('generated-video-runway')
})

test('positional image and text inputs allow explicit providers with --price', async () => {
  await withTempImage(async (imagePath) => {
    const imageResult = await runCommand(
      ['src/cli/create-cli.ts', 'video', imagePath, '--provider', 'gemini=veo-3.1-fast-generate-preview', '--price'],
    )
    const imageOutput = `${imageResult.stdout}\n${imageResult.stderr}`
    expect(imageResult.exitCode).toBe(0)
    expect(imageOutput).toContain('gemini')
    expect(imageOutput).toContain('veo-3.1-fast-generate-preview')
    expect(imageOutput).toContain('generated-video.mp4')
  })

  const textResult = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'runway=gen4.5', '--price'],
  )
  const textOutput = `${textResult.stdout}\n${textResult.stderr}`
  expect(textResult.exitCode).toBe(0)
  expect(textOutput).toContain('runway')
  expect(textOutput).toContain('gen4.5')
  expect(textOutput).toContain('generated-video.mp4')
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

test('MiniMax Hailuo 2.3 Fast uses published duration and resolution prices', async () => {
  const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
  const cases = [
    ['6', undefined, '19.00¢'],
    ['10', undefined, '32.00¢'],
    ['6', '1080p', '33.00¢']
  ] as const

  for (const [duration, resolution, expectedCost] of cases) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'animate image',
      '--provider',
      'minimax=MiniMax-Hailuo-2.3-Fast',
      '--mode',
      'image-to-video',
      '--input-image',
      imageDataUrl,
      '--duration',
      duration,
      ...(resolution ? ['--resolution', resolution] : []),
      '--price'
    ])
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain('MiniMax-Hailuo-2.3-Fast')
    expect(output).toContain(expectedCost)
  }
})

test('Grok video prices supported resolutions and input image fees', async () => {
  const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
  const cases = [
    ['480p', [], '25.00¢'],
    ['720p', [], '35.00¢'],
    ['480p', ['--mode', 'image-to-video', '--input-image', imageDataUrl], '25.20¢']
  ] as const

  for (const [resolution, mediaArgs, expectedCost] of cases) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'a cinematic mountain sunrise',
      '--provider',
      'grok=grok-imagine-video',
      '--resolution',
      resolution,
      '--duration',
      '5',
      ...mediaArgs,
      '--price'
    ])
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain('grok-imagine-video')
    expect(output).toContain(expectedCost)
  }
})

test('Grok video rejects 1080p resolution with --price', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'video',
    'a cinematic mountain sunrise',
    '--provider',
    'grok=grok-imagine-video',
    '--resolution',
    '1080p',
    '--price'
  ])
  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Expected 480p or 720p')
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
    ['veo-3.1-fast-generate-preview', '4k', '4', '$2.40'],
    ['veo-3.1-generate-preview', '720p', '4', '$1.60'],
    ['veo-3.1-generate-preview', '1080p', '4', '$3.20'],
    ['veo-3.1-generate-preview', '4k', '4', '$4.80']
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
