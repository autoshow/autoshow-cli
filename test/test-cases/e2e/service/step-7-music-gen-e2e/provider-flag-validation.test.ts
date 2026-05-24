import { test, expect } from 'bun:test'
import {
  runCommand,
} from '../../../../test-utils/test-helpers'

test('requires a music provider flag', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'an ambient piano song'],
  )
  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Specify a music generation provider')
})

