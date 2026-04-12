import { test, expect } from 'bun:test'
import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'
import { runCommand } from '../../../test-utils/test-helpers'

defineImageServiceTest({
  models: [
    { model: 'gemini-3-pro-image-preview', prompt: 'a simple red circle on white background' },
    { model: 'imagen-4.0-ultra-generate-001', prompt: 'a simple green square on white background' },
    { model: 'imagen-4.0-fast-generate-001', prompt: 'a simple yellow star on white background' },
    { model: 'imagen-4.0-generate-001', prompt: 'a simple blue triangle on white background', extraArgs: ['--imagen-count', '1', '--image-aspect-ratio', '1:1'] },
  ],
  cliFlag: '--gemini-image',
  imageService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
})

test('--price allows Gemini with another image provider', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-generate-001', '--openai-image', 'gpt-image-1-mini', '--imagen-count', '2', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('"provider": "gemini"')
  expect(output).toContain('"provider": "openai"')
  expect(output).toContain('generated-image-gemini-imagen-4.0-generate-001.png')
  expect(output).toContain('generated-image-gemini-imagen-4.0-generate-001-2.png')
  expect(output).toContain('generated-image-openai-gpt-image-1-mini.png')
})

test('rejects --image-size for imagen-4.0-fast-generate-001', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-fast-generate-001', '--image-size', '2K'],
  )
  expect(result.exitCode).not.toBe(0)
})
