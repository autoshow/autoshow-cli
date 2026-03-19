/**
 * Report type helpers for loading mixed legacy and current report formats.
 */

import { REPORT_SCHEMA_VERSION } from '../types.ts'
import type { AnyReport, LegacyRunReport, ReportType, RuntimeReport, SetupOnlyReport } from '../types.ts'

export function inferReportType(raw: Record<string, unknown>): ReportType {
  const reportType = raw['reportType']
  if (reportType === 'run' || reportType === 'setup' || reportType === 'runtime') {
    return reportType
  }

  if (raw['warmupRun']) return 'runtime'
  if (raw['modelPreparation'] || raw['readinessKey']) return 'setup'
  return 'run'
}

export function normalizeReport(raw: unknown): AnyReport {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const reportType = inferReportType(record)
  const schemaVersion = typeof record['schemaVersion'] === 'number' ? record['schemaVersion'] : REPORT_SCHEMA_VERSION

  if (reportType === 'runtime') {
    return {
      ...(record as RuntimeReport),
      reportType: 'runtime',
      schemaVersion,
    }
  }

  if (reportType === 'setup') {
    return {
      ...(record as SetupOnlyReport),
      reportType: 'setup',
      schemaVersion,
    }
  }

  return {
    ...(record as LegacyRunReport),
    reportType: 'run',
    schemaVersion,
  }
}

export function isRuntimeReport(report: AnyReport): report is RuntimeReport {
  return report.reportType === 'runtime'
}

export function isSetupReport(report: AnyReport): report is SetupOnlyReport {
  return report.reportType === 'setup'
}

export function isLegacyRunReport(report: AnyReport): report is LegacyRunReport {
  return report.reportType === 'run'
}
