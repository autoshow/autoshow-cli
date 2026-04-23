import { join, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import * as l from '~/utils/logger'
import { ALL_FIXTURES } from './registry'
import { generateFixture } from './generate'
import { validateFixture } from './validate'
import { readManifest, writeManifest, isManifestValid } from './manifest'
import { checkAllTools } from './tools'
import type { SampleFixtureEntry, SampleSkippedEntry } from '~/types'
import type { ToolName } from './tools'

export type SampleFixtureOptions = {
  out?: string
  refresh?: boolean
  verifyOnly?: boolean
  validOnly?: boolean
}

export const runSampleFixtures = async (options: SampleFixtureOptions = {}): Promise<void> => {
  const outDir = resolve(options.out ?? 'input/samples')
  const refresh = options.refresh === true
  const verifyOnly = options.verifyOnly === true
  const validOnly = options.validOnly === true

  await mkdir(outDir, { recursive: true })
  await mkdir(join(outDir, 'valid'), { recursive: true })
  await mkdir(join(outDir, 'invalid'), { recursive: true })

  const toolStatuses = checkAllTools()
  const availableTools = new Set<ToolName>(
    (Object.entries(toolStatuses) as [ToolName, { available: boolean }][])
      .filter(([, status]) => status.available)
      .map(([name]) => name)
  )

  const REQUIRED_TOOLS: ToolName[] = ['ffmpeg', 'ffprobe', 'libreoffice']
  for (const tool of REQUIRED_TOOLS) {
    if (!availableTools.has(tool)) {
      throw new Error(`Required tool '${tool}' is not installed. Run: bun as setup --step sample`)
    }
  }

  const OPTIONAL_TOOLS: ToolName[] = ['calibre', 'imagemagick']
  for (const tool of OPTIONAL_TOOLS) {
    if (!availableTools.has(tool)) {
      l.warn(`Optional tool '${tool}' not installed - skipping ${tool}-dependent fixtures`)
    }
  }

  if (verifyOnly) {
    const manifest = await readManifest(outDir)
    if (!manifest) {
      throw new Error(`No manifest found at ${outDir}/manifest.json. Run without --verify-only to generate fixtures.`)
    }

    let allValid = true
    for (const fixture of manifest.fixtures) {
      const fixtureDef = {
        path: fixture.path,
        format: fixture.format,
        supportLevel: fixture.supportLevel,
        validity: fixture.validity,
        requiredTools: fixture.requiredTools as ToolName[],
        ...(fixture.invalidReason ? { invalidReason: fixture.invalidReason } : {})
      }
      const result = await validateFixture(outDir, fixtureDef)
      if (!result.valid) {
        l.error(`Validation failed for ${fixture.path}: ${result.reason}`)
        allValid = false
      }
    }

    if (!allValid) {
      throw new Error('Fixture validation failed. Run without --verify-only to regenerate.')
    }

    l.write('success', `All ${manifest.fixtures.length} fixtures verified`)
    return
  }

  if (!refresh) {
    const manifest = await readManifest(outDir)
    if (manifest && isManifestValid(manifest, outDir)) {
      l.write('info', 'Manifest is valid - use --refresh to regenerate')
      return
    }
  }

  const fixtures: SampleFixtureEntry[] = []
  const skipped: SampleSkippedEntry[] = []

  const fixtureList = validOnly
    ? ALL_FIXTURES.filter((fixture) => fixture.validity === 'valid')
    : ALL_FIXTURES

  for (const fixture of fixtureList) {
    const missingTools = fixture.requiredTools.filter((tool) => !availableTools.has(tool))
    if (missingTools.length > 0) {
      skipped.push({
        path: fixture.path,
        reason: `missing tools: ${missingTools.join(', ')}`,
        requiredTools: missingTools
      })
      const message = `Skipping ${fixture.path} (missing: ${missingTools.join(', ')})`
      if (fixture.supportLevel === 'current') {
        l.warn(message)
      } else {
        l.write('info', message)
      }
      continue
    }

    l.write('info', `Generating ${fixture.path}`)
    const result = await generateFixture(fixture, outDir, availableTools)

    if (!result.generated) {
      skipped.push({
        path: fixture.path,
        reason: result.reason ?? 'generation-failed',
        requiredTools: fixture.requiredTools
      })
      const message = `Skipping ${fixture.path} (${result.reason ?? 'generation-failed'})`
      if (fixture.supportLevel === 'current') {
        l.warn(message)
      } else {
        l.write('info', message)
      }
      continue
    }

    const validation = await validateFixture(outDir, fixture)

    fixtures.push({
      path: fixture.path,
      format: fixture.format,
      supportLevel: fixture.supportLevel,
      validity: fixture.validity,
      requiredTools: fixture.requiredTools,
      verified: validation.valid,
      ...(fixture.invalidReason ? { invalidReason: fixture.invalidReason } : {})
    })

    if (!validation.valid) {
      l.warn(`Fixture generated but validation failed: ${fixture.path}: ${validation.reason}`)
    }
  }

  await writeManifest(outDir, fixtures, skipped)

  const verified = fixtures.filter((fixture) => fixture.verified).length
  l.write('success', `Generated ${fixtures.length} fixtures (${verified} verified, ${skipped.length} skipped)`)
}
