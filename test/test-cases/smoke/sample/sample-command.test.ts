import { test, expect } from 'bun:test'
import { runCommand, fileExists } from '../../../test-utils/test-helpers'

// ─── Help ────────────────────────────────────────────────────────────────────

test('sample --help exits 0 and contains expected flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--sample')
  expect(result.stdout).toContain('--out')
  expect(result.stdout).toContain('--refresh')
  expect(result.stdout).toContain('--verify-only')
  expect(result.stdout).toContain('--valid-only')
})

test('sample command is removed in favor of setup --sample', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'sample'])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unknown command "sample"')
})

// ─── verify-only with no manifest ────────────────────────────────────────────

test('sample --verify-only fails when manifest does not exist', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts', 'setup',
    '--sample',
    '--out', 'output/sample-verify-only-nonexistent-test',
    '--verify-only'
  ])

  expect(result.exitCode).not.toBe(0)
})

// ─── verify-only against preflight-generated manifest ────────────────────────

test('sample --verify-only passes when input/samples manifest is valid', async () => {
  const manifestExists = await fileExists('input/samples/manifest.json')
  if (!manifestExists) {
    // Preflight did not generate fixtures; skip
    return
  }

  const result = await runCommand([
    'src/cli/create-cli.ts', 'setup',
    '--sample',
    '--out', 'input/samples',
    '--verify-only'
  ])

  expect(result.exitCode).toBe(0)
})

// ─── manifest structure ───────────────────────────────────────────────────────

test('manifest.json has expected schema when present', async () => {
  const manifestExists = await fileExists('input/samples/manifest.json')
  if (!manifestExists) {
    return
  }

  const manifest = await Bun.file('input/samples/manifest.json').json() as Record<string, unknown>

  expect(typeof manifest['schemaVersion']).toBe('number')
  expect(manifest['schemaVersion']).toBe(1)
  expect(typeof manifest['generatedAt']).toBe('string')
  expect(Array.isArray(manifest['fixtures'])).toBe(true)
  expect(Array.isArray(manifest['skipped'])).toBe(true)
  expect(typeof manifest['summary']).toBe('object')
})

test('manifest fixtures contain required fields', async () => {
  const manifestExists = await fileExists('input/samples/manifest.json')
  if (!manifestExists) {
    return
  }

  const manifest = await Bun.file('input/samples/manifest.json').json() as { fixtures: Record<string, unknown>[] }

  for (const fixture of manifest.fixtures) {
    expect(typeof fixture['path']).toBe('string')
    expect(typeof fixture['format']).toBe('string')
    expect(fixture['supportLevel'] === 'current' || fixture['supportLevel'] === 'planned').toBe(true)
    expect(fixture['validity'] === 'valid' || fixture['validity'] === 'invalid').toBe(true)
    expect(Array.isArray(fixture['requiredTools'])).toBe(true)
    expect(typeof fixture['verified']).toBe('boolean')
  }
})

test('manifest contains invalid fixtures tagged with invalidReason', async () => {
  const manifestExists = await fileExists('input/samples/manifest.json')
  if (!manifestExists) {
    return
  }

  const manifest = await Bun.file('input/samples/manifest.json').json() as { fixtures: Record<string, unknown>[] }
  const invalid = manifest.fixtures.filter(f => f['validity'] === 'invalid')

  expect(invalid.length).toBeGreaterThan(0)
  for (const fixture of invalid) {
    expect(typeof fixture['invalidReason']).toBe('string')
    expect((fixture['invalidReason'] as string).length).toBeGreaterThan(0)
  }
})

test('valid fixtures exist on disk when manifest says verified', async () => {
  const manifestExists = await fileExists('input/samples/manifest.json')
  if (!manifestExists) {
    return
  }

  const manifest = await Bun.file('input/samples/manifest.json').json() as { fixtures: Record<string, unknown>[] }
  const verifiedValid = manifest.fixtures.filter(f => f['validity'] === 'valid' && f['verified'] === true)

  // Check at least some verified valid fixtures exist on disk
  let foundCount = 0
  for (const fixture of verifiedValid.slice(0, 5)) {
    const exists = await fileExists(`input/samples/${fixture['path'] as string}`)
    if (exists) foundCount++
  }

  expect(foundCount).toBeGreaterThan(0)
})
