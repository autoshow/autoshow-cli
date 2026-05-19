import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { defineImageServicePriceTests } from '../../test-utils/define-image-service-test'
import { runCommand } from '../../test-utils/test-helpers'

defineImageServicePriceTests({
  models: [
    { model: 'gpt-image-1.5', prompt: 'a watercolor landscape with a lighthouse' },
    { model: 'gpt-image-2', prompt: 'a simple green triangle on white background', extraArgs: ['--image-size', '1024x1024', '--image-quality', 'low'] },
  ],
  cliFlag: '--openai',
  imageService: 'openai',
})

defineImageServicePriceTests({
  models: [
    { model: 'imagen-4.0-ultra-generate-001', prompt: 'a simple green square on white background' },
    { model: 'imagen-4.0-fast-generate-001', prompt: 'a simple yellow star on white background' },
    { model: 'imagen-4.0-generate-001', prompt: 'a simple blue triangle on white background', extraArgs: ['--image-count', '1', '--image-aspect-ratio', '1:1'] },
  ],
  cliFlag: '--gemini',
  imageService: 'gemini',
})

defineImageServicePriceTests({
  models: [
    { model: 'image-01', prompt: 'a simple red circle on white background' },
  ],
  cliFlag: '--minimax',
  imageService: 'minimax',
})

defineImageServicePriceTests({
  imageService: 'glm',
  cliFlag: '--glm',
  models: [
    {
      model: 'glm-image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '1024x1024']
    },
    {
      model: 'cogView-4-250304',
      prompt: 'A simple watercolor lighthouse at sunrise',
      extraArgs: ['--image-size', '1024x1024']
    }
  ]
})

defineImageServicePriceTests({
  imageService: 'grok',
  cliFlag: '--grok',
  models: [
    {
      model: 'grok-imagine-image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-aspect-ratio', '1:1', '--image-size', '1K']
    }
  ]
})

defineImageServicePriceTests({
  imageService: 'runway',
  cliFlag: '--runway',
  models: [
    {
      model: 'gen4_image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-aspect-ratio', '1:1', '--image-size', '720p']
    }
  ]
})

defineImageServicePriceTests({
  imageService: 'bfl',
  cliFlag: '--bfl',
  models: [
    {
      model: 'flux-2-pro-preview',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '1024x1024']
    }
  ]
})

defineImageServicePriceTests({
  imageService: 'deapi',
  cliFlag: '--deapi',
  models: [
    {
      model: 'Flux1schnell',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '512x512']
    },
    {
      model: 'ZImageTurbo_INT8',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '512x512']
    },
    {
      model: 'Flux_2_Klein_4B_BF16',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '512x512']
    }
  ]
})

test('--price allows multiple image providers and reports each image step', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai', 'gpt-image-1.5', '--minimax', 'image-01', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('openai')
  expect(output).toContain('minimax')
  expect(output).toContain('generated-image-openai-gpt-image-1.5.png')
  expect(output).toContain('generated-image-minimax-image-01.jpeg')
})

test('--price allows Gemini with another image provider', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini', 'imagen-4.0-generate-001', '--openai', 'gpt-image-1.5', '--image-count', '2', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('gemini')
  expect(output).toContain('openai')
  expect(output).toContain('generated-image-gemini-imagen-4.0-generate-001.png')
  expect(output).toContain('generated-image-gemini-imagen-4.0-generate-001-2.png')
  expect(output).toContain('generated-image-openai-gpt-image-1.5.png')
})

test('image --out in price mode reports explicit output directory without creating it', async () => {
  const outputDir = 'output/test-image'
  const existedBefore = existsSync(outputDir)

  try {
    expect(existedBefore).toBe(false)

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'image', 'a sunset over a lake', '--openai', 'gpt-image-1.5', '--out', outputDir, '--price'],
    )
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.exitCode).toBe(0)
    expect(result.outputDir).toBeNull()
    expect(output).toContain('Expected files')
    expect(output).toContain('output/test-image/')
    expect(existsSync(outputDir)).toBe(false)
  } finally {
    if (!existedBefore) {
      await rm(outputDir, { recursive: true, force: true })
    }
  }
})
