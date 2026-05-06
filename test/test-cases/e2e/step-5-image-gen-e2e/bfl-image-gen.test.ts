import { expect, test } from 'bun:test'
import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'
import { runCommand } from '../../../test-utils/test-helpers'

defineImageServiceTest({
  imageService: 'bfl',
  cliFlag: '--bfl-image',
  envVarKey: 'BFL_API_KEY',
  imageExtension: 'jpg',
  models: [
    {
      model: 'flux-2-pro-preview',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '1024x1024']
    }
  ]
})

test('rejects unsupported BFL shared image flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--bfl-image',
    'flux-2-pro-preview',
    '--image-aspect-ratio',
    '1:1'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('not supported by BFL image generation')
})

test('rejects invalid BFL image size values', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--bfl-image',
    'flux-2-pro-preview',
    '--image-size',
    '1024'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('Invalid --image-size value "1024" for BFL')
})
