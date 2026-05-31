import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runCommand } from '../../test-utils/test-helpers'

test('resume surface is reachable through help', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'resume', '--help'], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('bun as resume')
  expect(result.stdout).toContain('<outputDir>')
  expect(result.stdout).toContain('--provider')
  expect(result.stdout).toContain('--tts-voice')
})

test('resume requires an explicit output directory', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'resume'], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Missing required parameter: outputDir')
})

test('resume rejects a missing output directory before reaching provider validation', async () => {
  const missingDir = join(tmpdir(), `autoshow-missing-resume-${Date.now()}`)
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    missingDir,
    '--provider',
    'deepgram=not-a-deepgram-model'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Could not find')
})

test('cache command rejects unknown actions with a usage error', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'cache', 'rotate'])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unknown cache action "rotate"')
})

test('setup focused model downloads cannot be combined with targeted steps', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--models', 'base', '--step', 'uv'])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--models cannot be combined with --step')
})
