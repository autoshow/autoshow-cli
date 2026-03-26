import type { AggregatedPriceEstimate, StepEstimate } from '~/utils/pricing/aggregate-pricing'
import { assertNever } from '~/utils/validate/assert-never'
import { formatCost, formatDuration } from '~/logger/formatters'
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

const formatStepEstimate = (estimate: StepEstimate): Record<string, string | number> => {
  const base = { step: estimate.step, provider: estimate.provider, model: estimate.model }

  switch (estimate.step) {
    case 'stt':
      return { ...base, provider: formatSttProvider(estimate.provider), cost: formatCost(estimate.totalCost) }
    case 'llm': {
      const entry: Record<string, string | number> = {
        ...base,
        inputRate: `${estimate.inputCostPer1MCents.toFixed(2)}¢/1M`,
        outputRate: `${estimate.outputCostPer1MCents.toFixed(2)}¢/1M`,
        cost: formatCost(estimate.totalCost)
      }
      if (typeof estimate.estimatedInputTokens === 'number') entry['estInputTokens'] = estimate.estimatedInputTokens
      if (typeof estimate.estimatedOutputTokens === 'number') entry['estOutputTokens'] = estimate.estimatedOutputTokens
      return entry
    }
    case 'extract': {
      const entry: Record<string, string | number> = {
        ...base,
        rate: `${estimate.costPer1kPagesCents.toFixed(4)}¢/1K pages`,
        cost: formatCost(estimate.totalCost)
      }
      if (typeof estimate.pageCount === 'number') entry['pages'] = estimate.pageCount
      return entry
    }
    case 'tts': {
      const entry: Record<string, string | number> = { ...base }
      if (typeof estimate.inputCostPer1MCharactersCents === 'number' && typeof estimate.outputCostPer1MCharactersCents === 'number') {
        entry['inputRate'] = `${estimate.inputCostPer1MCharactersCents.toFixed(2)}¢/1M chars`
        entry['outputRate'] = `${estimate.outputCostPer1MCharactersCents.toFixed(2)}¢/1M chars`
      } else if (typeof estimate.costPer1kCharactersCents === 'number') {
        entry['rate'] = `${estimate.costPer1kCharactersCents.toFixed(4)}¢/1K chars`
      }
      if (typeof estimate.characterCount === 'number') entry['characters'] = estimate.characterCount
      entry['cost'] = formatCost(estimate.totalCost)
      return entry
    }
    case 'image':
      return { ...base, cost: formatCost(estimate.totalCost) }
    case 'video':
      return { ...base, cost: formatCost(estimate.totalCost) }
    case 'music': {
      const entry: Record<string, string | number> = { ...base, lyrics: estimate.lyricsSource }
      entry['cost'] = formatCost(estimate.totalCost)
      if (estimate.note) entry['note'] = estimate.note
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
        steps: estimate.steps.map(formatStepEstimate),
        totalEstimatedCost: formatCost(estimate.totalEstimatedCost),
        ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
      }
      logger.write('info', `Cost Estimate:\n${JSON.stringify(obj, null, 2)}`, { category: 'pricing' })
    },
    complete: (outputDir, files, options) => {
      logger.write('info', `Output directory: ${outputDir}`, { category: 'artifact' })
      logger.write('success', 'Complete!', { category: 'artifact' })
      const result: Record<string, unknown> = {
        files: Object.fromEntries(
          Object.entries(files).map(([key, name]) => [key, `${outputDir}/${name}`])
        )
      }
      if (options?.metrics !== undefined) {
        result['metrics'] = options.metrics
      }
      if (options?.steps !== undefined && options.totalTimeMs !== undefined && options.totalCost !== undefined) {
        const { steps: summarySteps, total } = formatStepSummary(options.steps, options.totalTimeMs, options.totalCost)
        result['steps'] = summarySteps
        result['total'] = total
      }
      logger.write('info', JSON.stringify(result, null, 2), { category: 'artifact' })
    }
  }
}
