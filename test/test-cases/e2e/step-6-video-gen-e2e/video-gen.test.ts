import { test, expect } from 'bun:test'
import { defineVideoServiceTest } from '../../../test-utils/define-video-service-test'
import { runCommand } from '../../../test-utils/test-helpers'

defineVideoServiceTest({
  models: ['veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview'],
  cliFlag: '--gemini-video',
})

test('requires a provider flag', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise'],
  )
  expect(result.exitCode).not.toBe(0)
})

test('rejects multiple providers', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-generate-preview', '--minimax-video', 'MiniMax-Hailuo-2.3'],
  )
  expect(result.exitCode).not.toBe(0)
})
