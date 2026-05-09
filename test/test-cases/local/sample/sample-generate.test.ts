import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { rm } from 'node:fs/promises'
import { runCommand, fileExists, OUTPUT_DIR } from '../../../test-utils/test-helpers'

const TEST_OUT = `${OUTPUT_DIR}/test-sample-fixture-gen`

type ManifestFixture = {
  path: string
  format: string
  supportLevel: 'current' | 'planned'
  validity: 'valid' | 'invalid'
  requiredTools: string[]
  verified: boolean
  invalidReason?: string
}

type ManifestSummary = {
  total: number
  generated: number
  skipped: number
  verified: number
}

type Manifest = {
  schemaVersion: number
  generatedAt: string
  mode: 'full' | 'partial'
  fixtures: ManifestFixture[]
  skipped: { path: string, reason: string, requiredTools: string[] }[]
  summary: ManifestSummary
}

describe('sample generate', () => {
  beforeAll(async () => {
    await rm(TEST_OUT, { recursive: true, force: true })
  })

  afterAll(async () => {
    await rm(TEST_OUT, { recursive: true, force: true })
  })

  test('sample generates manifest.json and valid/invalid fixture directories', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts', 'setup',
      '--sample',
      '--out', TEST_OUT
    ])

    expect(result.exitCode).toBe(0)
    expect(await fileExists(`${TEST_OUT}/manifest.json`)).toBe(true)
    expect(await fileExists(`${TEST_OUT}/valid`)).toBe(true)
    expect(await fileExists(`${TEST_OUT}/invalid`)).toBe(true)
  })

  test('manifest.json has correct schemaVersion and structure', async () => {
    const manifest = await Bun.file(`${TEST_OUT}/manifest.json`).json() as Manifest

    expect(manifest.schemaVersion).toBe(1)
    expect(typeof manifest.generatedAt).toBe('string')
    expect(Array.isArray(manifest.fixtures)).toBe(true)
    expect(Array.isArray(manifest.skipped)).toBe(true)
    expect(typeof manifest.summary).toBe('object')
    expect(typeof manifest.summary.generated).toBe('number')
    expect(manifest.summary.generated).toBeGreaterThan(0)
  })

  test('manifest summary counts are consistent', async () => {
    const manifest = await Bun.file(`${TEST_OUT}/manifest.json`).json() as Manifest

    expect(manifest.summary.generated).toBe(manifest.fixtures.length)
    expect(manifest.summary.total).toBe(manifest.fixtures.length + manifest.skipped.length)
    expect(manifest.summary.verified).toBeLessThanOrEqual(manifest.summary.generated)
  })

  test('current-support valid fixtures are generated and verified', async () => {
    const manifest = await Bun.file(`${TEST_OUT}/manifest.json`).json() as Manifest

    const currentValid = manifest.fixtures.filter(f => f.supportLevel === 'current' && f.validity === 'valid')
    expect(currentValid.length).toBeGreaterThan(0)

    for (const fixture of currentValid) {
      expect(fixture.verified).toBe(true)
      expect(await fileExists(`${TEST_OUT}/${fixture.path}`)).toBe(true)
    }
  })

  test('invalid fixtures are generated and tagged with invalidReason', async () => {
    const manifest = await Bun.file(`${TEST_OUT}/manifest.json`).json() as Manifest

    const invalid = manifest.fixtures.filter(f => f.validity === 'invalid')
    expect(invalid.length).toBeGreaterThan(0)

    for (const fixture of invalid) {
      expect(typeof fixture.invalidReason).toBe('string')
      expect(fixture.invalidReason!.length).toBeGreaterThan(0)
      expect(await fileExists(`${TEST_OUT}/${fixture.path}`)).toBe(true)
    }
  })

  test('sample --verify-only passes after successful generation', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts', 'setup',
      '--sample',
      '--out', TEST_OUT,
      '--verify-only'
    ])

    expect(result.exitCode).toBe(0)
  })

  test('sample --refresh regenerates and produces a valid manifest', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts', 'setup',
      '--sample',
      '--out', TEST_OUT,
      '--refresh'
    ])

    expect(result.exitCode).toBe(0)

    const manifest = await Bun.file(`${TEST_OUT}/manifest.json`).json() as Manifest
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.summary.generated).toBeGreaterThan(0)
  })

  test('sample --valid-only skips invalid fixture generation', async () => {
    const validOnlyOut = `${TEST_OUT}-valid-only`
    await rm(validOnlyOut, { recursive: true, force: true })

    try {
      const result = await runCommand([
        'src/cli/create-cli.ts', 'setup',
        '--sample',
        '--out', validOnlyOut,
        '--valid-only'
      ])

      expect(result.exitCode).toBe(0)

      const manifest = await Bun.file(`${validOnlyOut}/manifest.json`).json() as Manifest
      const invalid = manifest.fixtures.filter(f => f.validity === 'invalid')
      expect(invalid.length).toBe(0)
    } finally {
      await rm(validOnlyOut, { recursive: true, force: true })
    }
  })
})

describe('sample extract commands on generated fixtures', () => {
  test('invalid corrupt.pdf fixture causes extract to fail', async () => {
    const corruptPdf = `${TEST_OUT}/invalid/corrupt.pdf`
    const exists = await fileExists(corruptPdf)
    if (!exists) return

    const result = await runCommand([
      'src/cli/create-cli.ts', 'extract', corruptPdf
    ])

    // Corrupt PDF should fail during extraction
    expect(result.exitCode).not.toBe(0)
  })

  test('valid PDF fixture extracts successfully', async () => {
    const validPdf = `${TEST_OUT}/valid/1-document.pdf`
    const exists = await fileExists(validPdf)
    if (!exists) return

    const result = await runCommand([
      'src/cli/create-cli.ts', 'extract', validPdf
    ])

    expect(result.exitCode).toBe(0)
  })

  test('valid CSV fixture extracts as raw text', async () => {
    const validCsv = `${TEST_OUT}/valid/1-document.csv`
    const exists = await fileExists(validCsv)
    if (!exists) return

    const result = await runCommand([
      'src/cli/create-cli.ts', 'extract', validCsv
    ])

    expect(result.exitCode).toBe(0)
  })

  test('binary.csv invalid fixture is rejected as non-text content', async () => {
    const binaryCsv = `${TEST_OUT}/invalid/binary.csv`
    const exists = await fileExists(binaryCsv)
    if (!exists) return

    const result = await runCommand([
      'src/cli/create-cli.ts', 'extract', binaryCsv
    ])

    expect(result.exitCode).not.toBe(0)
  })
})
