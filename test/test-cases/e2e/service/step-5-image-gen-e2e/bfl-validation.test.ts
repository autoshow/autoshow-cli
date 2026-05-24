import { expect, test } from 'bun:test'
import { runCommand } from '../../../../test-utils/test-helpers'

test('rejects unsupported BFL shared image flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    'bfl=flux-2-pro',
    '--aspect-ratio',
    '1:1'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('--image-aspect-ratio is not supported by BFL/flux-2-pro')
})

test('rejects invalid BFL image size values', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    'bfl=flux-2-pro',
    '--size',
    '1024'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('Invalid --image-size value "1024" for BFL')
})

