import { test, expect } from 'bun:test'
import {
  runCommand
} from '../../../../test-utils/test-helpers'

test('requires a provider flag', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise'],
  )
  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Specify a video generation provider')
})

