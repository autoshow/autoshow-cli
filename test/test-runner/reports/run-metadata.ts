import type { BudgetPreflightSummary } from './types'

export const buildBudgetRunFields = (budgetSummary?: BudgetPreflightSummary): Record<string, unknown> => {
  if (!budgetSummary) {
    return {}
  }

  return {
    budgetCents: budgetSummary.budgetCents,
    budgetPreflightSuite: budgetSummary.suiteName,
    budgetPreflightChecked: budgetSummary.commandsChecked,
    budgetPreflightRunnable: budgetSummary.commandsRunnable,
    budgetPreflightSkipped: budgetSummary.commandsSkipped,
    budgetPreflightFailed: budgetSummary.commandsFailed,
    budgetRunnableEstimatedCostCents: budgetSummary.runnableEstimatedCostCents,
    budgetSkipKeys: budgetSummary.skipKeys,
    budgetSkippedEntries: budgetSummary.skippedEntries,
  }
}
