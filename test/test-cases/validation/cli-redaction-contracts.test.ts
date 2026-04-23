import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

const failureFixturePath = new URL('./fixtures/failure-fixture.ts', import.meta.url).pathname

test('usage-error output redacts password flag values', async () => {
  const secret = 'supersecret-password-123'
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    '--openai',
    'definitely-not-a-model',
    '--password',
    secret
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).not.toContain(secret)
})

test('usage-error output redacts sensitive URL query values', async () => {
  const token = 'token-value-abc123'
  const result = await runCommand([
    'src/cli/create-cli.ts',
    '--openai',
    'gpt-5.4',
    'write',
    `https://example.com/audio.mp3?token=${token}`
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).not.toContain(token)
})

test('fatal process handlers redact unhandled rejection payloads', async () => {
  const result = await runCommand([
    failureFixturePath
  ])

  expect(result.exitCode).toBe(1)
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('fatal-secret-value-987')
})
