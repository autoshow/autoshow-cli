import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { defineImageServicePriceTests } from '../../test-utils/define-image-service-test'
import { runCommand } from '../../test-utils/test-helpers'

defineImageServicePriceTests({
  models: [
    { model: 'gpt-image-1.5', prompt: 'a watercolor landscape with a lighthouse' },
    { model: 'gpt-image-2', prompt: 'a simple green triangle on white background', extraArgs: ['--size', '1024x1024', '--quality', 'low'] },
  ],
  provider: 'openai',
  imageService: 'openai',
})

defineImageServicePriceTests({
  models: [
    { model: 'gemini-3.1-flash-image-preview', prompt: 'a simple green square on white background' },
  ],
  provider: 'gemini',
  imageService: 'gemini',
})

defineImageServicePriceTests({
  imageService: 'grok',
  provider: 'grok',
  models: [
    {
      model: 'grok-imagine-image',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--aspect-ratio', '1:1', '--size', '1K']
    }
  ]
})

defineImageServicePriceTests({
  imageService: 'bfl',
  provider: 'bfl',
  models: [
    {
      model: 'flux-2-pro',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--size', '1024x1024']
    }
  ]
})

test('--price allows multiple image providers and reports each image step', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'openai=gpt-image-1.5', '--provider', 'grok=grok-imagine-image', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('openai')
  expect(output).toContain('grok')
  expect(output).toContain('generated-image-openai-gpt-image-1.5.png')
  expect(output).toContain('generated-image-grok-grok-imagine-image.jpg')
})

test('--price allows Gemini with another image provider', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'gemini=gemini-3.1-flash-image-preview', '--provider', 'openai=gpt-image-1.5', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('gemini')
  expect(output).toContain('openai')
  expect(output).toContain('generated-image-gemini-gemini-3.1-flash-image-preview.png')
  expect(output).toContain('generated-image-openai-gpt-image-1.5.png')
})

test('image --out in price mode reports explicit output directory without creating it', async () => {
  const outputDir = 'output/test-image'
  const existedBefore = existsSync(outputDir)

  try {
    expect(existedBefore).toBe(false)

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'image', 'a sunset over a lake', '--provider', 'openai=gpt-image-1.5', '--output-dir', outputDir, '--price'],
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
