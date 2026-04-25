import * as l from '~/utils/logger'
import { readRunManifest, writeRunManifest } from './manifest-utils'
import { getGenerationTargetKey } from './generation-command-utils'
import { logResumeItem, logResumeSummary } from './resume/resume-logging'
import { CLIUsageError } from '~/utils/error-handler'
import type { ResumeTarget, RunManifestKind, RuntimeOptions } from '~/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type GenerationResumeConfig<TTarget extends { service: string, model: string }, TMetadata> = {
  kind: RunManifestKind
  metadataKey: string
  stepLabel: string
  getSuccessKey: (entry: TMetadata) => string
  collectTargets: (opts: RuntimeOptions) => TTarget[]
  runMissingTargets: (
    targets: TTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => Promise<TMetadata[]>
}

const parseGenerationManifest = (
  metadata: Record<string, unknown>,
  metadataKey: string
): {
  input: string
  requestedProviders: Array<{ service: string, model: string }>
  existingEntries: unknown[]
} | undefined => {
  const input = typeof metadata['input'] === 'string' ? metadata['input'] : undefined
  const requestedProviders = Array.isArray(metadata['requestedProviders'])
    ? metadata['requestedProviders'].filter(
        (entry): entry is { service: string, model: string } =>
          isRecord(entry)
          && typeof entry['service'] === 'string'
          && typeof entry['model'] === 'string'
      )
    : undefined

  if (!input || !requestedProviders || requestedProviders.length === 0) {
    return undefined
  }

  const existingEntries = Array.isArray(metadata[metadataKey]) ? metadata[metadataKey] : []

  return { input, requestedProviders, existingEntries }
}

export const hasResumableGenerationWork = async <TTarget extends { service: string, model: string }, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions
): Promise<boolean> => {
  const manifest = await readRunManifest(target.dir, config.kind)
  if (!manifest) {
    return false
  }

  const parsed = parseGenerationManifest(manifest.metadata, config.metadataKey)
  if (!parsed) {
    return false
  }

  const successKeys = new Set(
    (parsed.existingEntries as TMetadata[]).map(config.getSuccessKey)
  )

  const selectedTargets = config.collectTargets(opts)
  const selectedKeys = selectedTargets.length > 0
    ? new Set(selectedTargets.map((t) => getGenerationTargetKey(t.service, t.model)))
    : undefined

  for (const provider of parsed.requestedProviders) {
    const key = getGenerationTargetKey(provider.service, provider.model)
    if (successKeys.has(key)) {
      continue
    }
    if (selectedKeys && !selectedKeys.has(key)) {
      continue
    }
    return true
  }

  return false
}

export const resumeGenerationTarget = async <TTarget extends { service: string, model: string }, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions
): Promise<void> => {
  const manifest = await readRunManifest(target.dir, config.kind)
  if (!manifest) {
    throw CLIUsageError(`Invalid ${config.stepLabel} manifest at ${target.dir}/run.json`)
  }

  const parsed = parseGenerationManifest(manifest.metadata, config.metadataKey)
  if (!parsed) {
    throw CLIUsageError(
      `This ${config.stepLabel} run.json does not contain resume metadata (input/requestedProviders). `
      + 'Re-run the original command to produce a resumable manifest.'
    )
  }

  const successKeys = new Set(
    (parsed.existingEntries as TMetadata[]).map(config.getSuccessKey)
  )

  const allTargets = config.collectTargets(opts)
  const selectedKeys = allTargets.length > 0
    ? new Set(allTargets.map((t) => getGenerationTargetKey(t.service, t.model)))
    : undefined

  if (selectedKeys) {
    const requestedKeys = new Set(
      parsed.requestedProviders.map((p) => getGenerationTargetKey(p.service, p.model))
    )
    const unexpected = [...selectedKeys].filter((key) => !requestedKeys.has(key))
    if (unexpected.length > 0) {
      throw CLIUsageError(
        `Requested resume providers are not a subset of the original providers: ${unexpected.join(', ')}`
      )
    }
  }

  const missingProviders = parsed.requestedProviders.filter((provider) => {
    const key = getGenerationTargetKey(provider.service, provider.model)
    if (successKeys.has(key)) {
      return false
    }
    if (selectedKeys && !selectedKeys.has(key)) {
      return false
    }
    return true
  })

  if (missingProviders.length === 0) {
    logResumeItem(l, {
      item: '1/1',
      status: 'full',
      outputDir: target.dir,
      providers: 'none',
      detail: 'all providers already complete'
    }, 'success')
    logResumeSummary(l, { full: 1, incomplete: 0, failed: 0 })
    return
  }

  const missingKeys = new Set(
    missingProviders.map((p) => getGenerationTargetKey(p.service, p.model))
  )
  const targetsToRun = allTargets.filter((t) =>
    missingKeys.has(getGenerationTargetKey(t.service, t.model))
  )

  if (targetsToRun.length === 0) {
    throw CLIUsageError(
      `Could not reconstruct targets for missing providers: ${missingProviders.map((p) => `${p.service}/${p.model}`).join(', ')}. `
      + 'Pass explicit provider flags matching the original models.'
    )
  }

  const providerLabels = targetsToRun.map((t) => `${t.service}/${t.model}`)
  logResumeItem(l, {
    item: '1/1',
    status: 'processing',
    outputDir: target.dir,
    providers: providerLabels,
    detail: 'resuming missing providers'
  }, 'info')

  let newMetadata: TMetadata[]
  try {
    newMetadata = await config.runMissingTargets(targetsToRun, parsed.input, target.dir, opts)
  } catch (error) {
    logResumeItem(l, {
      item: '1/1',
      status: 'failed',
      outputDir: target.dir,
      providers: providerLabels,
      detail: error instanceof Error ? error.message : String(error)
    }, 'error')
    logResumeSummary(l, { full: 0, incomplete: 0, failed: 1 })
    const exitError = new Error(
      `${config.stepLabel} resume still has failed providers: ${providerLabels.join(', ')}`
    )
    ;(exitError as Error & { exitCode?: number }).exitCode = 2
    throw exitError
  }

  const mergedMetadata = [...(parsed.existingEntries as TMetadata[]), ...newMetadata]

  const mergedSuccessKeys = new Set(mergedMetadata.map(config.getSuccessKey))
  const stillMissing = parsed.requestedProviders.filter(
    (p) => !mergedSuccessKeys.has(getGenerationTargetKey(p.service, p.model))
  )

  await writeRunManifest(target.dir, config.kind, {
    ...manifest.metadata,
    [config.metadataKey]: mergedMetadata
  })

  if (stillMissing.length > 0) {
    logResumeItem(l, {
      item: '1/1',
      status: 'incomplete',
      outputDir: target.dir,
      providers: providerLabels,
      detail: `${stillMissing.length} provider(s) still missing`
    }, 'warn')
    logResumeSummary(l, { full: 0, incomplete: 1, failed: 0 })
    const exitError = new Error(
      `${config.stepLabel} resume still has ${stillMissing.length} incomplete provider(s)`
    )
    ;(exitError as Error & { exitCode?: number }).exitCode = 2
    throw exitError
  }

  logResumeItem(l, {
    item: '1/1',
    status: 'full',
    outputDir: target.dir,
    providers: providerLabels,
    detail: 'resume complete'
  }, 'success')
  logResumeSummary(l, { full: 1, incomplete: 0, failed: 0 })
}
