import { test, expect } from 'bun:test'
import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'
import { runCommand } from '../../../test-utils/test-helpers'

defineImageServiceTest({
  models: [
    { model: 'imagen-4.0-ultra-generate-001', prompt: 'a simple green square on white background' },
    { model: 'imagen-4.0-fast-generate-001', prompt: 'a simple yellow star on white background' },
    { model: 'imagen-4.0-generate-001', prompt: 'a simple blue triangle on white background', extraArgs: ['--image-count', '1', '--image-aspect-ratio', '1:1'] },
  ],
  cliFlag: '--gemini-image',
  imageService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
})

test('rejects --image-size for imagen-4.0-fast-generate-001', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-fast-generate-001', '--image-size', '2K'],
  )
  expect(result.exitCode).not.toBe(0)
})
