import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { SampleManifest, SampleFixtureEntry, SampleSkippedEntry } from '~/types'

export const MANIFEST_SCHEMA_VERSION = 1

export const readManifest = async (outDir: string): Promise<SampleManifest | null> => {
  const manifestPath = join(outDir, 'manifest.json')
  const file = Bun.file(manifestPath)
  if (!(await file.exists())) return null

  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as SampleManifest
  } catch {
    return null
  }
}

export const writeManifest = async (
  outDir: string,
  fixtures: SampleFixtureEntry[],
  skipped: SampleSkippedEntry[]
): Promise<void> => {
  await mkdir(outDir, { recursive: true })
  const manifest: SampleManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode: skipped.length > 0 ? 'partial' : 'full',
    fixtures,
    skipped,
    summary: {
      total: fixtures.length + skipped.length,
      generated: fixtures.length,
      skipped: skipped.length,
      verified: fixtures.filter(f => f.verified).length
    }
  }

  const manifestPath = join(outDir, 'manifest.json')
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2))
}

export const isManifestValid = (manifest: SampleManifest, _outDir: string): boolean => {
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) return false
  return manifest.fixtures.every(f => f.verified)
}
