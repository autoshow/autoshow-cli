import type { AggregatedPriceEstimate, StepEstimate } from '~/utils/pricing/aggregate-pricing'
import { assertNever } from '~/utils/validate/assert-never'
import { formatCost, formatDuration } from '~/logger/formatters'
import { emitResult } from '~/logger/result-emitter'
import type { Logger } from '~/logger/types'

export type StepTimingCost = {
  label: string
  providerModel?: string
  processingTime: number
  cost: number
}

export type CompleteOptions = {
  metrics?: Record<string, string>
  steps?: StepTimingCost[]
  totalTimeMs?: number
  totalCost?: number
}

export type Reporter = {
  expectedOutput: (outputDir: string, files: string[]) => void
  estimate: (estimate: AggregatedPriceEstimate) => void
  complete: (outputDir: string, files: Record<string, string>, options?: CompleteOptions) => void
}

const formatSttProvider = (provider: string): string => {
  return provider === 'whisper' ? 'whisper.cpp' : provider
}

type EstimateMode = 'human' | 'raw'

const costField = (mode: EstimateMode, cents: number): string | number =>
  mode === 'human' ? formatCost(cents) : cents

const costKey = (mode: EstimateMode): string =>
  mode === 'human' ? 'cost' : 'totalCostCents'

const mapStepEstimate = (estimate: StepEstimate, mode: EstimateMode): Record<string, string | number> => {
  const base = { step: estimate.step, provider: estimate.provider, model: estimate.model }

  switch (estimate.step) {
    case 'stt':
      return { ...base, provider: formatSttProvider(estimate.provider), [costKey(mode)]: costField(mode, estimate.totalCost) }
    case 'llm': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') {
        entry['inputRate'] = `${estimate.inputCostPer1MCents.toFixed(2)}¢/1M`
        entry['outputRate'] = `${estimate.outputCostPer1MCents.toFixed(2)}¢/1M`
      } else {
        entry['inputCostPer1MCents'] = estimate.inputCostPer1MCents
        entry['outputCostPer1MCents'] = estimate.outputCostPer1MCents
      }
      if (typeof estimate.estimatedInputTokens === 'number') entry['estInputTokens'] = estimate.estimatedInputTokens
      if (typeof estimate.estimatedOutputTokens === 'number') entry['estOutputTokens'] = estimate.estimatedOutputTokens
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      return entry
    }
    case 'extract': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') entry['rate'] = `${estimate.costPer1kPagesCents.toFixed(4)}¢/1K pages`
      if (typeof estimate.pageCount === 'number') entry['pages'] = estimate.pageCount
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      return entry
    }
    case 'tts': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') {
        if (typeof estimate.inputCostPer1MCharactersCents === 'number' && typeof estimate.outputCostPer1MCharactersCents === 'number') {
          entry['inputRate'] = `${estimate.inputCostPer1MCharactersCents.toFixed(2)}¢/1M chars`
          entry['outputRate'] = `${estimate.outputCostPer1MCharactersCents.toFixed(2)}¢/1M chars`
        } else if (typeof estimate.costPer1kCharactersCents === 'number') {
          entry['rate'] = `${estimate.costPer1kCharactersCents.toFixed(4)}¢/1K chars`
        }
      }
      if (typeof estimate.characterCount === 'number') entry['characters'] = estimate.characterCount
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      return entry
    }
    case 'image':
      return { ...base, [costKey(mode)]: costField(mode, estimate.totalCost) }
    case 'video':
      return { ...base, [costKey(mode)]: costField(mode, estimate.totalCost) }
    case 'music': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') entry['lyrics'] = estimate.lyricsSource
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      if (mode === 'human' && estimate.note) entry['note'] = estimate.note
      return entry
    }
    default:
      assertNever(estimate)
  }
}

type StepSummaryEntry = {
  label: string
  providerModel?: string
  time: string
  cost: string
}

const HUMAN_PRIMARY_ARTIFACT_KEYS = ['prompt', 'metadata', 'audio', 'audio-wav', 'transcript'] as const

const formatStepSummary = (steps: StepTimingCost[], totalTimeMs: number, totalCost: number) => {
  const entries: StepSummaryEntry[] = steps.map(step => ({
    label: step.label,
    ...(step.providerModel ? { providerModel: step.providerModel } : {}),
    time: formatDuration(step.processingTime),
    cost: formatCost(step.cost)
  }))
  return {
    steps: entries,
    total: { time: formatDuration(totalTimeMs), cost: formatCost(totalCost) }
  }
}

const buildHumanArtifactSummary = (outputDir: string, files: Record<string, string>): Record<string, unknown> => {
  const artifacts = Object.fromEntries(
    HUMAN_PRIMARY_ARTIFACT_KEYS
      .flatMap((key) => {
        const file = files[key]
        return file ? [[key, `${outputDir}/${file}`] as const] : []
      })
  )

  const providerFiles = Object.entries(files).filter(([, file]) => file.startsWith('providers/'))
  const providerTranscripts = providerFiles.filter(([key]) => key.startsWith('transcript-')).length
  const providerMetadata = providerFiles.filter(([key]) => key.startsWith('metadata-')).length

  const summary: Record<string, unknown> = {}
  if (Object.keys(artifacts).length > 0) {
    summary['artifacts'] = artifacts
  }
  if (providerFiles.length > 0) {
    summary['providers'] = {
      dir: `${outputDir}/providers`,
      transcripts: providerTranscripts,
      metadata: providerMetadata
    }
  }

  return summary
}

export const createReporter = (logger: Logger): Reporter => {
  return {
    expectedOutput: (outputDir, files) => {
      logger.write('info', `Expected output directory: ${outputDir}`, { category: 'command' })
      logger.write('info', 'Expected files:', { category: 'command' })
      for (const file of files) {
        logger.write('info', `  - ${file}`, { category: 'command' })
      }
    },
    estimate: (estimate) => {
      const obj = {
        steps: estimate.steps.map(s => mapStepEstimate(s, 'human')),
        totalEstimatedCost: formatCost(estimate.totalEstimatedCost),
        ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
      }
      logger.write('info', `Cost Estimate:\n${JSON.stringify(obj, null, 2)}`, { category: 'pricing' })

      emitResult({
        dryRun: true,
        estimate: {
          steps: estimate.steps.map(s => mapStepEstimate(s, 'raw')),
          totalEstimatedCostCents: estimate.totalEstimatedCost,
          ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
        }
      })
    },
    complete: (outputDir, files, options) => {
      logger.write('info', `Output directory: ${outputDir}`, { category: 'artifact' })
      logger.write('success', 'Complete!', { category: 'artifact' })
      const result: Record<string, unknown> = buildHumanArtifactSummary(outputDir, files)
      if (options?.metrics !== undefined) {
        result['metrics'] = options.metrics
      }
      if (options?.steps !== undefined && options.totalTimeMs !== undefined && options.totalCost !== undefined) {
        const { steps: summarySteps, total } = formatStepSummary(options.steps, options.totalTimeMs, options.totalCost)
        result['steps'] = summarySteps
        result['total'] = total
      }
      logger.write('info', JSON.stringify(result, null, 2), { category: 'artifact' })

      const resultData: Record<string, unknown> = {
        dryRun: false,
        outputDir,
        files: Object.fromEntries(
          Object.entries(files).map(([key, name]) => [key, `${outputDir}/${name}`])
        )
      }
      if (options?.steps !== undefined && options.totalTimeMs !== undefined && options.totalCost !== undefined) {
        resultData['timing'] = {
          totalMs: options.totalTimeMs,
          steps: options.steps.map(s => ({
            label: s.label,
            ...(s.providerModel ? { providerModel: s.providerModel } : {}),
            processingTimeMs: s.processingTime,
            costCents: s.cost
          })),
          totalCostCents: options.totalCost
        }
      }
      if (options?.metrics !== undefined) {
        resultData['metrics'] = options.metrics
      }
      emitResult(resultData)
    }
  }
}
