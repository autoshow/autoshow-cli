import type { PriceCommandResult, TestRunArtifacts } from '../../../src/types/tests-dir-types'
import { normalizeRepoPath } from '../utils'
import { buildBudgetRunFields } from './run-metadata'
import type { BudgetPreflightSummary } from './types'

export const buildPriceReportData = (
  results: PriceCommandResult[],
  suiteName: string,
  artifacts: TestRunArtifacts,
  endedAtIso: string,
  endedAtMs: number,
  argv: string[],
  budgetSummary?: BudgetPreflightSummary
): Record<string, unknown> => {
  const passed = results.filter(result => result.status === 'passed').length
  const failed = results.filter(result => result.status === 'failed').length
  const skipped = results.filter(result => result.status === 'skipped').length
  const totalCost = results
    .filter(result => result.status === 'passed')
    .map(result => result.costCents)
    .filter((value): value is number => typeof value === 'number')
    .reduce((sum, value) => sum + value, 0)

  const runDurationMs = Math.max(0, endedAtMs - artifacts.startedAtMs)

  return {
    run: {
      id: artifacts.runId,
      mode: 'price',
      suiteName,
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: runDurationMs,
      argv,
      artifactDir: normalizeRepoPath(artifacts.runDir),
      ...buildBudgetRunFields(budgetSummary),
    },
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      totalEstimatedCostCents: totalCost,
    },
    commands: results,
  }
}
