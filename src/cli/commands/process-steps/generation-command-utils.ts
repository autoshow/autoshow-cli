import * as l from '~/logger'
import type { StepTimingCost } from '~/logger'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig, resolveMaxCents } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { writeRunManifest } from './manifest-utils'

type CostStep = {
  step: string
  cost: number
}

export const resolveMaxCentsFromFlags = async (flags: Record<string, unknown>): Promise<number | undefined> => {
  const configPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const configPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(configPath)
  return resolveMaxCents(config.pricing)
}

export const createGenerationOutputDir = async (label: string): Promise<string> => {
  const uniqueDirName = createUniqueDirectoryName(label)
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)
  return outputDir
}

export const writeGenerationMetadata = async <T,>(
  outputDir: string,
  metadataKey: string,
  metadata: T[],
  cost: unknown,
  timing: unknown
): Promise<void> => {
  await writeRunManifest(outputDir, metadataKey as 'tts' | 'image' | 'video' | 'music', {
    [metadataKey]: metadata,
    cost: cost as Record<string, unknown>,
    timing: timing as Record<string, unknown>
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
