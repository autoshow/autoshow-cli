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
  expect(result.stdout).toContain('--whisper-stt')
  expect(result.stdout).toContain('--tesseract-ocr')
})

test('resume provider filter validation rejects invalid provider models', async () => {
  const missingDir = join(tmpdir(), `autoshow-missing-resume-${Date.now()}`)
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    missingDir,
    '--deepgram-stt',
    'not-a-deepgram-model'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --deepgram-stt model "not-a-deepgram-model"')
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
