import { createSingleRowTable } from '~/utils/logger/human-table'
import type { HumanLogTable, LogLevel, ResumeItemSummary, ResumeTableLogger, ResumeTotals } from '~/types'

export const buildResumeItemTable = (
  summary: ResumeItemSummary
): HumanLogTable =>
  createSingleRowTable(summary, ['item', 'status', 'outputDir', 'providers', 'detail'])

export const logResumeItem = (
  logger: ResumeTableLogger,
  summary: ResumeItemSummary,
  level: LogLevel
): void => {
  logger.write(level, 'Resume Item', {
    category: 'pipeline',
    humanTable: buildResumeItemTable(summary),
    metadata: summary
  })
}

export const buildResumeSummaryTable = (
  totals: ResumeTotals
): HumanLogTable =>
  createSingleRowTable(totals, ['full', 'incomplete', 'failed'])

export const logResumeSummary = (
  logger: ResumeTableLogger,
  totals: ResumeTotals,
  level: LogLevel = totals.incomplete > 0 || totals.failed > 0 ? 'warn' : 'info'
): void => {
  logger.write(level, 'Resume Summary', {
    category: 'pipeline',
    humanTable: buildResumeSummaryTable(totals),
    metadata: totals
  })
}
