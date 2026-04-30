import { expect, test } from 'bun:test'
import { defineImageServicePriceTests } from '../../test-utils/define-image-service-test'
import { runCommand } from '../../test-utils/test-helpers'

defineImageServicePriceTests({
  models: [
    { model: 'gpt-image-1', prompt: 'a simple red circle on white background' },
    { model: 'gpt-image-1-mini', prompt: 'a simple blue square on white background' },
    { model: 'gpt-image-1.5', prompt: 'a watercolor landscape with a lighthouse' },
    { model: 'gpt-image-2', prompt: 'a simple green triangle on white background', extraArgs: ['--image-size', '1024x1024', '--image-quality', 'low'] },
  ],
  cliFlag: '--openai-image',
  imageService: 'openai',
})

defineImageServicePriceTests({
  models: [
    { model: 'gemini-3-pro-image-preview', prompt: 'a simple red circle on white background' },
    { model: 'imagen-4.0-ultra-generate-001', prompt: 'a simple green square on white background' },
    { model: 'imagen-4.0-fast-generate-001', prompt: 'a simple yellow star on white background' },
    { model: 'imagen-4.0-generate-001', prompt: 'a simple blue triangle on white background', extraArgs: ['--imagen-count', '1', '--image-aspect-ratio', '1:1'] },
  ],
  cliFlag: '--gemini-image',
  imageService: 'gemini',
})

defineImageServicePriceTests({
  models: [
    { model: 'image-01', prompt: 'a simple red circle on white background' },
  ],
  cliFlag: '--minimax-image',
  imageService: 'minimax',
})

defineImageServicePriceTests({
  imageService: 'glm',
  cliFlag: '--glm-image',
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
  cliFlag: '--grok-image',
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
  cliFlag: '--runway-image',
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
  cliFlag: '--bfl-image',
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
  cliFlag: '--deapi-image',
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
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1-mini', '--minimax-image', 'image-01', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('openai')
  expect(output).toContain('minimax')
  expect(output).toContain('generated-image-openai-gpt-image-1-mini.png')
  expect(output).toContain('generated-image-minimax-image-01.jpeg')
})

test('--price allows Gemini with another image provider', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-generate-001', '--openai-image', 'gpt-image-1-mini', '--imagen-count', '2', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('gemini')
  expect(output).toContain('openai')
  expect(output).toContain('generated-image-gemini-imagen-4.0-generate-001.png')
  expect(output).toContain('generated-image-gemini-imagen-4.0-generate-001-2.png')
  expect(output).toContain('generated-image-openai-gpt-image-1-mini.png')
})
