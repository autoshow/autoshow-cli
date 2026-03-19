import { test, expect } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

test('process failure handlers exit non-zero and redact fatal payloads', async () => {
  const result = await runCommand([
    'test/test-cases/validation/fixtures/failure-fixture.ts'
  ])

  expect(result.exitCode).toBe(1)
  const combined = `${result.stdout}\n${result.stderr}`
  expect(combined.includes('fatal-secret-value-987')).toBe(false)
})
