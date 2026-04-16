import { defineCommand } from 'clerc'
import { join, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import * as l from '~/logger'
import { sampleFlags } from '~/cli/flags'
import { ALL_FIXTURES } from './registry'
import { generateFixture } from './generate'
import { validateFixture } from './validate'
import { readManifest, writeManifest, isManifestValid } from './manifest'
import { checkAllTools } from './tools'
import type { SampleFixtureEntry, SampleSkippedEntry } from '~/types'
import type { ToolName } from './tools'

export const sampleCommand = defineCommand({
  name: 'sample',
  description: 'Generate and validate deterministic fixture files for all supported formats',
  flags: sampleFlags,
  help: {
    examples: [
      ['bun as sample', 'Generate all fixture files'],
      ['bun as sample --verify-only', 'Validate existing fixtures without regenerating']
    ]
  }
}, async (ctx) => {
  const outDir = resolve(ctx.flags.out as string)
  const refresh = ctx.flags.refresh as boolean
  const verifyOnly = ctx.flags['verify-only'] as boolean
  const validOnly = ctx.flags['valid-only'] as boolean

  await mkdir(outDir, { recursive: true })
  await mkdir(join(outDir, 'valid'), { recursive: true })
  await mkdir(join(outDir, 'invalid'), { recursive: true })

  // Check available tools
  const toolStatuses = checkAllTools()
  const availableTools = new Set<ToolName>(
    (Object.entries(toolStatuses) as [ToolName, { available: boolean }][])
      .filter(([, s]) => s.available)
      .map(([name]) => name)
  )

  // Log missing required tools
  const REQUIRED_TOOLS: ToolName[] = ['ffmpeg', 'ffprobe', 'libreoffice']
  for (const tool of REQUIRED_TOOLS) {
    if (!availableTools.has(tool)) {
      throw new Error(
        `Required tool '${tool}' is not installed. Run: bun as setup --step sample`
      )
    }
  }

  // Log missing optional tools
  const OPTIONAL_TOOLS: ToolName[] = ['calibre', 'imagemagick']
  for (const tool of OPTIONAL_TOOLS) {
    if (!availableTools.has(tool)) {
      l.warn(`Optional tool '${tool}' not installed - skipping ${tool}-dependent fixtures`)
    }
  }

  // Verify-only mode
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

    l.success(`All ${manifest.fixtures.length} fixtures verified`)
    return
  }

  // Check if manifest is already valid (skip regeneration unless --refresh)
  if (!refresh) {
    const manifest = await readManifest(outDir)
    if (manifest && isManifestValid(manifest, outDir)) {
      l.info('Manifest is valid - use --refresh to regenerate')
      return
    }
  }

  // Generation mode
  const fixtures: SampleFixtureEntry[] = []
  const skipped: SampleSkippedEntry[] = []

  const fixtureList = validOnly
    ? ALL_FIXTURES.filter(f => f.validity === 'valid')
    : ALL_FIXTURES

  for (const fixture of fixtureList) {
    // Check if all required tools are available
    const missingTools = fixture.requiredTools.filter(t => !availableTools.has(t))
    if (missingTools.length > 0) {
      skipped.push({
        path: fixture.path,
        reason: `missing tools: ${missingTools.join(', ')}`,
        requiredTools: missingTools
      })
      const log = fixture.supportLevel === 'current' ? l.warn : l.info
      log(`Skipping ${fixture.path} (missing: ${missingTools.join(', ')})`)
      continue
    }

    l.info(`Generating ${fixture.path}`)
    const result = await generateFixture(fixture, outDir, availableTools)

    if (!result.generated) {
      skipped.push({
        path: fixture.path,
        reason: result.reason ?? 'generation-failed',
        requiredTools: fixture.requiredTools
      })
      const log = fixture.supportLevel === 'current' ? l.warn : l.info
      log(`Skipping ${fixture.path} (${result.reason ?? 'generation-failed'})`)
      continue
    }

    // Validate the generated fixture
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

  const verified = fixtures.filter(f => f.verified).length
  l.success(`Generated ${fixtures.length} fixtures (${verified} verified, ${skipped.length} skipped)`)
})
