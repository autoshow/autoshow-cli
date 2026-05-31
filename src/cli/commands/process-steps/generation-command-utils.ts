import * as l from '~/utils/logger'
import { mkdir, stat } from 'node:fs/promises'
import { createDetailTable } from '~/utils/logger/human-table'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig, resolveMaxCents } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { joinOutputRoot } from '~/cli/commands/process-steps/output-root'
import { writeRunManifest } from './manifest-utils'
import { CLIUsageError } from '~/utils/error-handler'
import type {
  CostStep,
  LogLevel,
  MediaGenerationStatus,
  StepTimingCost,
  TableLogger
} from '~/types'

const mediaLabels: Readonly<Record<MediaGenerationStatus['mediaType'], string>> = {
  tts: 'TTS',
  image: 'Image',
  video: 'Video',
  music: 'Music'
}

const outputCountLabels: Readonly<Record<MediaGenerationStatus['mediaType'], string>> = {
  tts: 'chunks',
  image: 'images',
  video: 'outputs',
  music: 'outputs'
}

const getMediaLogMessage = (summary: MediaGenerationStatus): string =>
  summary.status === 'completed'
    ? `${mediaLabels[summary.mediaType]} Result`
    : `${mediaLabels[summary.mediaType]} Status`

const buildMediaGenerationDetailEntries = (
  summary: MediaGenerationStatus
): Array<readonly [string, unknown]> => {
  const entries: Array<readonly [string, unknown]> = [
    ['providerModel', `${summary.provider}/${summary.model}`],
    ['status', summary.status]
  ]
  if (summary.processingTimeMs != null) entries.push(['processingTimeMs', summary.processingTimeMs])
  if (summary.outputCount != null) entries.push(['outputCount', summary.outputCount])
  if (summary.detail) entries.push(['detail', summary.detail])
  for (const artifact of summary.artifacts ?? []) {
    entries.push([artifact.artifact, artifact.path])
    if (artifact.detail !== undefined) {
      entries.push([`${artifact.artifact} detail`, artifact.detail])
    }
  }
  return entries
}

export const logMediaGenerationStatus = (
  logger: TableLogger,
  summary: MediaGenerationStatus,
  level: LogLevel = summary.status === 'completed' ? 'success' : 'info'
): void => {
  logger.write(level, getMediaLogMessage(summary), {
    category: 'pipeline',
    humanTable: createDetailTable(buildMediaGenerationDetailEntries(summary), {
      labels: {
        outputCount: outputCountLabels[summary.mediaType]
      }
    }),
    metadata: summary
  })
}

export const resolveMaxCentsFromFlags = async (flags: Record<string, unknown>): Promise<number | undefined> => {
  const configPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const configPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(configPath)
  return resolveMaxCents(config.pricing)
}

const ensureTrailingSlash = (path: string): string =>
  path.endsWith('/') ? path : `${path}/`

const readExplicitGenerationOutputDir = (flags: Record<string, unknown>): string | undefined => {
  const outputDir = typeof flags['output-dir'] === 'string' ? flags['output-dir'] : undefined

  if (outputDir !== undefined && outputDir.trim().length === 0) {
    throw CLIUsageError('Output directory cannot be empty.')
  }

  return outputDir
}

const ensureExplicitOutputDirectory = async (outputDir: string): Promise<void> => {
  try {
    const stats = await stat(outputDir)
    if (!stats.isDirectory()) {
      throw CLIUsageError(`Output path exists and is not a directory: ${outputDir}`)
    }
    return
  } catch (error) {
    if (error instanceof Error && error.name === 'CLIUsageError') {
      throw error
    }
    const code = error !== null && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
    if (code !== 'ENOENT') {
      throw error
    }
  }

  await mkdir(outputDir, { recursive: true })
}

export const getGenerationExpectedOutputDir = (
  flags: Record<string, unknown>,
  defaultOutputDir: string
): string => ensureTrailingSlash(readExplicitGenerationOutputDir(flags) ?? defaultOutputDir)

export const createGenerationOutputDir = async (
  label: string,
  flags: Record<string, unknown> = {}
): Promise<string> => {
  const explicitOutputDir = readExplicitGenerationOutputDir(flags)
  if (explicitOutputDir !== undefined) {
    await ensureExplicitOutputDirectory(explicitOutputDir)
    l.write('info', 'Run', {
      category: 'command',
      humanTable: createDetailTable([['outputDir', explicitOutputDir]])
    })
    return explicitOutputDir
  }

  const uniqueDirName = createUniqueDirectoryName(label)
  const outputDir = joinOutputRoot(uniqueDirName)
  await ensureDirectory(outputDir)
  l.write('info', 'Run', {
    category: 'command',
    humanTable: createDetailTable([['outputDir', outputDir]])
  })
  return outputDir
}

export const getGenerationTargetKey = (service: string, model: string): string =>
  `${service}:${model}`

export const writeGenerationMetadata = async <T,>(
  outputDir: string,
  metadataKey: string,
  metadata: T[],
  cost: unknown,
  timing: unknown,
  resumeContext?: {
    input: string
    requestedProviders: Array<{ service: string, model: string }>
  }
): Promise<void> => {
  await writeRunManifest(outputDir, metadataKey as 'tts' | 'image' | 'video' | 'music', {
    [metadataKey]: metadata,
    cost: cost as Record<string, unknown>,
    timing: timing as Record<string, unknown>,
    ...(resumeContext ? {
      input: resumeContext.input,
      requestedProviders: resumeContext.requestedProviders
    } : {})
  })
}

export const buildProviderStepSummaries = <T,>(
  label: string,
  stepName: string,
  metadata: T[],
  steps: readonly CostStep[],
  getProviderModel: (entry: T) => string,
  getProcessingTime: (entry: T) => number
): StepTimingCost[] => {
  const matchingSteps = steps.filter((step) => step.step === stepName)
  return metadata.map((entry, index) => ({
    label,
    providerModel: getProviderModel(entry),
    processingTime: getProcessingTime(entry),
    cost: matchingSteps[index]?.cost ?? 0
  }))
}
