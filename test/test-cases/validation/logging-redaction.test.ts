import { test, expect } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

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
  const combined = `${result.stdout}\n${result.stderr}`
  expect(combined.includes(secret)).toBe(false)
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
  const combined = `${result.stdout}\n${result.stderr}`
  expect(combined.includes(token)).toBe(false)
})
