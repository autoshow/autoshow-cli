import {
  EXCLUDED_SERVICES,
  OUTPUT_PATH,
  STEP_DEFINITIONS,
  TOP_PICK_BUCKET_DISPLAY_ORDER,
  TOP_PICK_TARGET_COUNT
} from './bench-rank-config'
import { relativeToProject } from './bench-rank-io'
import {
  rankingRows,
  selectTopBenchmarkPicks,
  sourceKindSummary,
  verifyNoExcludedProvidersInRankings
} from './bench-rank-rankings'
import {
  createStats,
  dashboardFilesFromIndex,
  processDashboardReport,
  processRawReport,
  rawReportFiles,
  reconcileRawReports
} from './bench-rank-sources'
import type {
  DashboardFile,
  ProviderAggregate,
  RankingRow,
  RawReportFile,
  ReportStats,
  StepKey,
  TopBenchmarkPick,
  TopBenchmarkPickSelection
} from './bench-rank-types'

export {
  buildEstimatedCostCentsByProviderModel,
  isExcludedService,
  resolveRawCostUsd
} from './bench-rank-sources'
export { selectTopBenchmarkPicks } from './bench-rank-rankings'

const escapeCell = (value: string): string => value.replaceAll('|', '\\|')

const formatCost = (value: number): string => value.toFixed(6)

const formatSeconds = (value: number): string => value.toFixed(3)

const formatQuality = (value: number): string => value.toFixed(2)

const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`

const formatTopPickMetric = (pick: TopBenchmarkPick): string => {
  if (pick.metric === 'price') {
    return `$${formatCost(pick.metricValue)} ${pick.metricName}`
  }
  if (pick.metric === 'speed') {
    return `${formatSeconds(pick.metricValue)} ${pick.metricName}`
  }
  return `${formatQuality(pick.metricValue)} ${pick.metricName}`
}

const topPickLabel = (): string => `Top ${TOP_PICK_TARGET_COUNT}`

const markdownList = (paths: readonly string[]): string => {
  if (paths.length === 0) {
    return '- None'
  }
  return paths.map((path) => `- \`${path}\``).join('\n')
}

const markdownInlineList = (values: readonly string[]): string => {
  if (values.length === 0) {
    return ''
  }
  if (values.length === 1) {
    return `\`${values[0]}\``
  }

  const quoted = values.map((value) => `\`${value}\``)
  return `${quoted.slice(0, -1).join(', ')}, and ${quoted[quoted.length - 1]}`
}

const excludedServicesFootnoteList = (): string =>
  markdownInlineList([...EXCLUDED_SERVICES])

const metricTable = (rows: readonly RankingRow[], metric: 'price' | 'speed' | 'quality'): string => {
  if (rows.length === 0) {
    if (metric === 'price') {
      return 'No measurable third-party price rows.'
    }
    if (metric === 'speed') {
      return 'No measurable third-party speed rows.'
    }
    return 'No pure quality metric rows.'
  }

  if (metric === 'quality') {
    const lines = [
      '| Rank | Provider/model | Average quality score | Quality samples | Metric |',
      '| ---: | --- | ---: | ---: | --- |'
    ]
    for (const row of rows) {
      lines.push(`| ${row.rank} | ${escapeCell(row.key)} | ${formatQuality(row.average)} | ${row.count} | ${escapeCell(row.metricName ?? 'quality score')} |`)
    }
    return lines.join('\n')
  }

  const valueHeader = metric === 'price' ? 'Average cost (USD)' : 'Average seconds'
  const lines = [
    `| Rank | Provider/model | ${valueHeader} | Samples |`,
    '| ---: | --- | ---: | ---: |'
  ]

  for (const row of rows) {
    const value = metric === 'price' ? formatCost(row.average) : formatSeconds(row.average)
    lines.push(`| ${row.rank} | ${escapeCell(row.key)} | ${value} | ${row.count} |`)
  }

  return lines.join('\n')
}

const topPicksTable = (selection: TopBenchmarkPickSelection): string => {
  if (selection.rows.length === 0) {
    return `No ${topPickLabel()} picks are available because this step has no measurable third-party rankings.`
  }

  const lines = [
    '| Bucket | Provider/model | Metric | Original rank | Samples | Selection note |',
    '| --- | --- | --- | ---: | ---: | --- |'
  ]

  for (const bucket of TOP_PICK_BUCKET_DISPLAY_ORDER) {
    for (const pick of selection.rows.filter((row) => row.bucket === bucket)) {
      lines.push(`| ${pick.bucket} | ${escapeCell(pick.key)} | ${escapeCell(formatTopPickMetric(pick))} | ${pick.originalRank} | ${pick.samples} | ${escapeCell(pick.selectionNote)} |`)
    }
  }

  if (selection.note) {
    lines.push('')
    lines.push(selection.note)
  }

  return lines.join('\n')
}

const buildReport = (
  aggregates: Map<StepKey, Map<string, ProviderAggregate>>,
  stats: ReportStats,
  rawReports: readonly RawReportFile[],
  dashboardReports: readonly DashboardFile[]
): string => {
  const lines: string[] = []
  const contributedSources = [...stats.contributedSources].sort()
  const dashboardSourcePaths = dashboardReports.map((report) => report.relPath).sort()
  const rawSourcePaths = rawReports.map((report) => report.relPath).sort()

  lines.push('# Benchmark Ranking Report')
  lines.push('')
  lines.push('This report averages available benchmark rows into per-step third-party provider/model rankings. It intentionally does not compute a combined overall score.')
  lines.push('')
  lines.push('## Source Summary')
  lines.push('')
  lines.push(`- Reconciled \`project/reports/results/index.json\` with ${stats.indexFiles} listed dashboard report files.`)
  lines.push(`- Used ${stats.rawReportsRead} raw comparison reports and ${stats.dashboardReportsRead} test-run dashboard reports.`)
  lines.push(`- Skipped ${stats.benchmarkDashboardsSkipped} benchmark dashboard reports because matching raw comparison reports are canonical for those runs.`)
  lines.push(`- Saw ${plural(stats.totalRowsSeen, 'provider/test row')}: included ${stats.includedRows}, excluded ${plural(stats.excludedNonThirdPartyRows, 'local or non-third-party row')}, omitted ${plural(stats.omittedFailedRows, 'failed row')}, skipped ${plural(stats.unsupportedCategoryRows, 'unsupported-category row')}, and skipped ${plural(stats.noMetricRows, 'row')} with no measurable metrics.`)
  lines.push(`- Filled ${plural(stats.priceRowsFilledFromRunEstimates, 'raw price row')} from sibling run estimates where raw comparison costs were zero or missing.`)
  lines.push(`- Missing metrics among otherwise included rows: price ${stats.missingPriceRows}, speed ${stats.missingSpeedRows}, quality ${stats.missingQualityRows} in quality-ranked steps.`)
  lines.push(`- ${sourceKindSummary(aggregates)}`)
  lines.push('')
  lines.push('Contributed raw comparison reports:')
  lines.push('')
  lines.push(markdownList(rawSourcePaths.filter((path) => contributedSources.includes(path))))
  lines.push('')
  lines.push('Contributed test-run dashboard reports:')
  lines.push('')
  lines.push(markdownList(dashboardSourcePaths.filter((path) => contributedSources.includes(path))))
  lines.push('')

  for (const definition of STEP_DEFINITIONS) {
    const stepAggregates = aggregates.get(definition.key) ?? new Map<string, ProviderAggregate>()
    const priceRows = rankingRows(stepAggregates, 'price')
    const speedRows = rankingRows(stepAggregates, 'speed')
    const qualityRows = rankingRows(stepAggregates, 'quality')

    lines.push(`## ${definition.title}`)
    lines.push('')

    if (definition.key === 'download' && priceRows.length === 0 && speedRows.length === 0 && qualityRows.length === 0) {
      lines.push('No measurable third-party download rows were present in the reconciled benchmark inputs.')
      lines.push('')
      continue
    }

    lines.push(`### ${topPickLabel()} Picks`)
    lines.push('')
    lines.push(topPicksTable(selectTopBenchmarkPicks({ priceRows, speedRows, qualityRows })))
    lines.push('')
    lines.push('### Price')
    lines.push('')
    lines.push(metricTable(priceRows, 'price'))
    lines.push('')
    lines.push('### Speed')
    lines.push('')
    lines.push(metricTable(speedRows, 'speed'))
    lines.push('')

    if (qualityRows.length > 0) {
      lines.push('### Quality')
      lines.push('')
      lines.push(metricTable(qualityRows, 'quality'))
      lines.push('')
    } else {
      lines.push(`Quality: ${definition.noQualityNote}`)
      lines.push('')
    }
  }

  lines.push('## Footnotes')
  lines.push('')
  lines.push('- Price averages use USD per successful measurable row. Raw comparison rows use positive actual costs first, then positive reported costs, then positive sibling `run.json` `metadata.cost.estimated.steps` estimates when raw costs are zero or missing; raw cents are converted to USD and dashboard costs already reported in USD are used as-is.')
  lines.push('- Speed averages use actual processing time where present, converted from milliseconds to seconds.')
  lines.push('- Quality rankings are shown only for pure quality metrics: OCR WER-derived accuracy, URL extraction accuracy, and STT speaker-aware WER scores. Dashboard smoke/e2e rows do not contain pure quality metrics and therefore contribute only price and speed.')
  lines.push(`- Zero-cost third-party rows remain in price rankings. Local and non-third-party services are excluded, including ${excludedServicesFootnoteList()}.`)
  lines.push(`- Omitted ${plural(stats.omittedFailedRows, 'failed row')}. Missing metric counts are reported in the source summary and those missing values were omitted only from the affected metric average.`)
  lines.push('')

  return `${lines.join('\n')}\n`
}

export const runBenchmarkRankingReport = async (): Promise<number> => {
  const stats = createStats()
  const aggregates = new Map<StepKey, Map<string, ProviderAggregate>>()
  const dashboards = await dashboardFilesFromIndex(stats)
  const rawReports = await rawReportFiles()

  reconcileRawReports(rawReports, stats)

  for (const report of rawReports) {
    await processRawReport(report, aggregates, stats)
  }

  for (const report of dashboards) {
    await processDashboardReport(report, aggregates, stats)
  }

  verifyNoExcludedProvidersInRankings(aggregates)

  const report = buildReport(aggregates, stats, rawReports, dashboards)
  await Bun.write(OUTPUT_PATH, report)
  console.log(`Wrote ${relativeToProject(OUTPUT_PATH)}`)
  return 0
}

if (import.meta.main) {
  process.exit(await runBenchmarkRankingReport())
}
