import type {
  PriceCommandSpec,
  PriceCommandResult,
} from '../../src/types/tests-dir-types'
import type { BudgetPreflightSummary } from './reports'

export type PriceCommandObservation = {
  name: string
  key: string
  args: string[]
  exitCode: number
  durationMs: number
  costCents: number | null
  failureMessage: string | null
  budgetSkippable: boolean
}

export type PriceCommandKeySummary = {
  key: string
  budgetSkippable: boolean
  variantCount: number
  variantCostsCents: number[]
  failedVariantCount: number
  selectedCostCents: number | null
  overBudget: boolean
}

export type BudgetSkippedEntry = {
  key: string
  selectedCostCents: number
}

type KeyedEntry = {
  key: string
}

export type GroupedCommandEntries<T extends KeyedEntry> = {
  key: string
  variants: T[]
}

const isSuccessfulObservation = (observation: PriceCommandObservation): boolean => {
  return observation.exitCode === 0 && observation.costCents !== null
}

export const groupCommandsByKey = <T extends KeyedEntry>(commands: T[]): GroupedCommandEntries<T>[] => {
  const grouped = new Map<string, T[]>()

  for (const command of commands) {
    const existing = grouped.get(command.key)
    if (existing) {
      existing.push(command)
    } else {
      grouped.set(command.key, [command])
    }
  }

  return Array.from(grouped.entries()).map(([key, variants]) => ({ key, variants }))
}

export const evaluatePriceObservationGroup = (
  key: string,
  observations: PriceCommandObservation[],
  budgetCents?: number
): PriceCommandKeySummary => {
  const variantCostsCents = observations
    .map(observation => isSuccessfulObservation(observation) ? observation.costCents : null)
    .filter((value): value is number => value !== null)

  const failedVariantCount = observations.filter(observation => !isSuccessfulObservation(observation)).length
  const selectedCostCents = variantCostsCents.length > 0 ? Math.max(...variantCostsCents) : null
  const budgetSkippable = observations.some(observation => observation.budgetSkippable)
  const overBudget = budgetCents !== undefined
    && budgetSkippable
    && selectedCostCents !== null
    && selectedCostCents > budgetCents

  return {
    key,
    budgetSkippable,
    variantCount: observations.length,
    variantCostsCents,
    failedVariantCount,
    selectedCostCents,
    overBudget,
  }
}

export const evaluatePriceObservations = (
  suiteName: string,
  observations: PriceCommandObservation[],
  budgetCents?: number
): {
  commandResults: PriceCommandResult[]
  keySummaries: PriceCommandKeySummary[]
  budgetSummary: BudgetPreflightSummary | undefined
  failedCommands: number
  totalEstimatedCostCents: number
} => {
  const grouped = groupCommandsByKey(observations)
  const keySummaries = grouped.map(group => evaluatePriceObservationGroup(group.key, group.variants, budgetCents))
  const budgetEligibleSummaries = keySummaries.filter(summary => summary.budgetSkippable)
  const overBudgetKeys = new Set(
    budgetEligibleSummaries
      .filter(summary => summary.overBudget)
      .map(summary => summary.key)
  )

  const failedCommands = keySummaries.reduce((sum, summary) => sum + summary.failedVariantCount, 0)
  const budgetFailedCommands = budgetEligibleSummaries.reduce((sum, summary) => sum + summary.failedVariantCount, 0)
  const skippedEntries: BudgetSkippedEntry[] = budgetEligibleSummaries
    .filter((summary): summary is PriceCommandKeySummary & { selectedCostCents: number } => {
      return summary.overBudget && summary.selectedCostCents !== null
    })
    .map(summary => ({
      key: summary.key,
      selectedCostCents: summary.selectedCostCents,
    }))
    .sort((a, b) => {
      if (b.selectedCostCents !== a.selectedCostCents) {
        return b.selectedCostCents - a.selectedCostCents
      }
      return a.key.localeCompare(b.key)
    })

  const budgetSummary = budgetCents === undefined
    ? undefined
    : {
        suiteName,
        budgetCents,
        commandsChecked: budgetEligibleSummaries.length,
        commandsRunnable: budgetEligibleSummaries.filter(summary => summary.selectedCostCents !== null && !summary.overBudget).length,
        commandsSkipped: skippedEntries.length,
        commandsFailed: budgetFailedCommands,
        runnableEstimatedCostCents: budgetEligibleSummaries
          .filter(summary => summary.selectedCostCents !== null && !summary.overBudget)
          .reduce((sum, summary) => sum + (summary.selectedCostCents ?? 0), 0),
        skipKeys: skippedEntries.map(summary => summary.key),
        skippedEntries,
      }

  const commandResults = observations.map(observation => {
    const successful = isSuccessfulObservation(observation)
    const status = !successful
      ? 'failed'
      : observation.budgetSkippable && overBudgetKeys.has(observation.key)
        ? 'skipped'
        : 'passed'

    return {
      name: observation.name,
      key: observation.key,
      args: observation.args,
      status,
      exitCode: observation.exitCode,
      durationMs: observation.durationMs,
      costCents: observation.costCents,
      failureMessage: observation.failureMessage,
    } satisfies PriceCommandResult
  })

  const totalEstimatedCostCents = commandResults
    .filter(result => result.status === 'passed')
    .map(result => result.costCents)
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0)

  return {
    commandResults,
    keySummaries,
    budgetSummary,
    failedCommands,
    totalEstimatedCostCents,
  }
}

export const toObservation = (
  command: PriceCommandSpec,
  executed: {
    exitCode: number
    durationMs: number
    parsedCost: number | null
  }
): PriceCommandObservation => {
  const failureMessage = executed.exitCode !== 0
    ? `command failed with exit code ${executed.exitCode}`
    : executed.parsedCost === null
      ? 'could not parse estimated cost from command output'
      : null

  return {
    name: command.name,
    key: command.key,
    args: command.args,
    exitCode: executed.exitCode,
    durationMs: executed.durationMs,
    costCents: executed.parsedCost,
    failureMessage,
    budgetSkippable: command.budgetSkippable,
  }
}
