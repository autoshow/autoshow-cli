import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { analyzeOcrRunDirectory } from './analysis'
import type { OcrRunConsensusAnalysis } from './types'
import { detectReportTarget } from '~/cli/commands/setup-and-utilities/report/report-target-detection'

const formatCents = (value: number | null): string =>
  value === null ? 'n/a' : `$${(value / 100).toFixed(2)}`

const formatDurationMs = (value: number | null): string => {
  if (value === null) {
    return 'n/a'
  }

  if (value < 1000) {
    return `${Math.round(value)}ms`
  }

  const totalSeconds = Math.round(value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

const buildRunConsensusReportMarkdown = (analysis: OcrRunConsensusAnalysis): string => {
  const lines: string[] = []
  lines.push('# OCR Consensus Report')
  lines.push('')
  lines.push(`Source run: \`${analysis.runLabel}\``)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Title: ${analysis.metadata.title ?? 'n/a'}`)
  lines.push(`- Author: ${analysis.metadata.author ?? 'n/a'}`)
  lines.push(`- Format: ${analysis.metadata.format ?? 'n/a'}`)
  lines.push(`- Completion status: ${analysis.metadata.completionStatus ?? 'n/a'}`)
  lines.push(`- Providers analyzed: ${analysis.providers.length}`)
  lines.push(`- Pages analyzed: ${new Set(analysis.rows.map((row) => row.pageNumber)).size}`)
  lines.push(`- Windows analyzed: ${analysis.rows.length}`)
  lines.push(`- Average similarity: ${analysis.averageSimilarity.toFixed(2)}/100`)
  lines.push(`- Review rows: ${analysis.reviewRows.length}`)
  lines.push(`- Missing providers: ${analysis.missingProviders.length === 0 ? 'none' : analysis.missingProviders.map((provider) => provider.label).join(', ')}`)
  lines.push(`- Provider page counts differ: ${analysis.pageCountMismatch ? 'yes' : 'no'}`)
  lines.push(`- Actual cost: ${formatCents(analysis.metadata.actualTotalCostCents)}`)
  lines.push(`- Wall time: ${formatDurationMs(analysis.metadata.wallTimeMs)}`)
  lines.push('')
  lines.push('## Missing Providers')
  lines.push('')

  if (analysis.missingProviders.length === 0) {
    lines.push('- No missing providers were recorded.')
  } else {
    lines.push('| Provider | Status | Retryable | Last Error |')
    lines.push('|---|---|---|---|')
    for (const provider of analysis.missingProviders) {
      lines.push(`| ${provider.label} | ${provider.status} | ${provider.retryable ? 'yes' : 'no'} | ${provider.lastError ?? 'n/a'} |`)
    }
  }

  lines.push('')
  lines.push('## Providers')
  lines.push('')
  lines.push('| Provider | Similarity | Pages | Rows | Total Pages | Prompt Tokens | Completion Tokens | Actual Cost | Time |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const provider of analysis.providerSummary) {
    lines.push(`| ${provider.label} | ${provider.similarity.toFixed(2)} | ${provider.pageCoverage} | ${provider.rowCoverage} | ${provider.totalPages} | ${provider.promptTokens ?? 0} | ${provider.completionTokens ?? 0} | ${formatCents(provider.actualCostCents)} | ${formatDurationMs(provider.actualProcessingTimeMs)} |`)
  }

  lines.push('')
  lines.push('## Comparison')
  lines.push('')

  if (analysis.rows.length === 0) {
    lines.push('- No comparison rows were generated from the available OCR artifacts.')
  } else {
    for (const row of analysis.rows) {
      lines.push(`### Page ${row.pageNumber} / Window ${row.windowIndex}`)
      lines.push('')
      lines.push(`- Consensus: ${row.consensusText.length > 0 ? row.consensusText : '(empty)'}`)
      lines.push(`- Confidence: ${row.confidence.toFixed(2)}/100`)
      lines.push(`- Average similarity: ${row.averageSimilarity.toFixed(2)}/100`)
      lines.push(`- Review: ${row.reviewReasons.length === 0 ? 'no' : row.reviewReasons.join('; ')}`)
      for (const variant of row.variants) {
        lines.push(`- ${variant.label}: ${variant.text.length > 0 ? variant.text : '(empty)'} (${variant.similarity.toFixed(2)}/100${variant.confidence !== null ? `, confidence ${variant.confidence.toFixed(2)}/100` : ''})`)
      }
      lines.push('')
    }
  }

  lines.push('## Artifacts')
  lines.push('')
  lines.push('- `consensus-extraction.txt` is the merged best-guess extraction assembled page by page.')
  lines.push('- `consensus-review.md` lists only flagged pages and windows.')
  lines.push('- `consensus-report.json` contains the structured rows, provider summaries, and missing-provider state.')

  return lines.join('\n')
}

const buildRunReviewMarkdown = (analysis: OcrRunConsensusAnalysis): string => {
  const lines: string[] = []
  lines.push('# OCR Consensus Review')
  lines.push('')
  lines.push(`Source run: \`${analysis.runLabel}\``)
  lines.push('')

  if (analysis.reviewRows.length === 0) {
    lines.push('- No review rows were flagged.')
    return lines.join('\n')
  }

  for (const row of analysis.reviewRows) {
    lines.push(`## Page ${row.pageNumber} / Window ${row.windowIndex}`)
    lines.push('')
    lines.push(`- Consensus: ${row.consensusText.length > 0 ? row.consensusText : '(empty)'}`)
    lines.push(`- Confidence: ${row.confidence.toFixed(2)}/100`)
    lines.push(`- Reasons: ${row.reviewReasons.join('; ')}`)
    lines.push('')
  }

  return lines.join('\n')
}

const toStructuredRunSummary = (analysis: OcrRunConsensusAnalysis): Record<string, unknown> => ({
  runDir: analysis.runDir,
  runLabel: analysis.runLabel,
  metadata: analysis.metadata,
  missingProviders: analysis.missingProviders,
  rows: analysis.rows,
  reviewRows: analysis.reviewRows,
  providerSummary: analysis.providerSummary,
  averageSimilarity: analysis.averageSimilarity,
  pageCountMismatch: analysis.pageCountMismatch
})

export const writeOcrRunConsensusArtifacts = async (analysis: OcrRunConsensusAnalysis): Promise<{
  consensusPath: string
  reportPath: string
  jsonPath: string
  reviewPath: string
}> => {
  const consensusPath = join(analysis.runDir, 'consensus-extraction.txt')
  const reportPath = join(analysis.runDir, 'consensus-report.md')
  const jsonPath = join(analysis.runDir, 'consensus-report.json')
  const reviewPath = join(analysis.runDir, 'consensus-review.md')

  await Promise.all([
    writeFile(consensusPath, `${analysis.consensusText}\n`, 'utf8'),
    writeFile(reportPath, `${buildRunConsensusReportMarkdown(analysis)}\n`, 'utf8'),
    writeFile(jsonPath, `${JSON.stringify(toStructuredRunSummary(analysis), null, 2)}\n`, 'utf8'),
    writeFile(reviewPath, `${buildRunReviewMarkdown(analysis)}\n`, 'utf8')
  ])

  return { consensusPath, reportPath, jsonPath, reviewPath }
}

export const buildAggregateOcrConsensusReportMarkdown = (
  targetDir: string,
  analyses: OcrRunConsensusAnalysis[]
): string => {
  const lines: string[] = []
  lines.push('# OCR Consensus Batch Report')
  lines.push('')
  lines.push(`Target directory: \`${targetDir}\``)
  lines.push('')
  lines.push('## Runs')
  lines.push('')
  lines.push('| Run | Providers | Pages | Windows | Review Rows | Best Similarity | Missing Providers | Actual Cost | Wall Time |')
  lines.push('|---|---:|---:|---:|---:|---:|---|---:|---:|')

  for (const analysis of analyses) {
    const bestProvider = analysis.providerSummary[0]
    lines.push(`| ${analysis.runLabel} | ${analysis.providers.length} | ${new Set(analysis.rows.map((row) => row.pageNumber)).size} | ${analysis.rows.length} | ${analysis.reviewRows.length} | ${bestProvider ? bestProvider.similarity.toFixed(2) : 'n/a'} | ${analysis.missingProviders.length === 0 ? 'none' : analysis.missingProviders.map((provider) => provider.label).join(', ')} | ${formatCents(analysis.metadata.actualTotalCostCents)} | ${formatDurationMs(analysis.metadata.wallTimeMs)} |`)
  }

  lines.push('')
  lines.push('Each run directory also contains `consensus-extraction.txt`, `consensus-report.md`, `consensus-review.md`, and `consensus-report.json`.')
  return lines.join('\n')
}

export const analyzeAndWriteOcrConsensusReports = async (targetPath: string): Promise<{
  targetDir: string
  runArtifacts: Array<{
    runDir: string
    consensusPath: string
    reportPath: string
    jsonPath: string
    reviewPath: string
  }>
  aggregateReportPath: string | null
}> => {
  const detectedTarget = await detectReportTarget(targetPath)
  if (detectedTarget.kind !== 'ocr') {
    throw new Error(`Report target resolves to ${detectedTarget.kind.toUpperCase()} artifacts, not OCR: ${detectedTarget.targetDir}`)
  }

  const analyses = await Promise.all(detectedTarget.runDirectories.map((runDir) => analyzeOcrRunDirectory(runDir)))
  const runArtifacts = await Promise.all(analyses.map(async (analysis) => ({
    runDir: analysis.runDir,
    ...(await writeOcrRunConsensusArtifacts(analysis))
  })))

  if (detectedTarget.runDirectories.length === 1) {
    return {
      targetDir: detectedTarget.targetDir,
      runArtifacts,
      aggregateReportPath: null
    }
  }

  const aggregateReportPath = join(detectedTarget.targetDir, 'consensus-report.md')
  await writeFile(
    aggregateReportPath,
    `${buildAggregateOcrConsensusReportMarkdown(detectedTarget.targetDir, analyses)}\n`,
    'utf8'
  )

  return {
    targetDir: detectedTarget.targetDir,
    runArtifacts,
    aggregateReportPath
  }
}
