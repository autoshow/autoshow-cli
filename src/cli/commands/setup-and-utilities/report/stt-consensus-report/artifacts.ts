import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { analyzeSttRunDirectory } from './analysis'
import { discoverAnalyzableRunDirectories } from './discovery'
import type { RunConsensusAnalysis } from './types'

const formatCents = (value: number | null): string => value === null ? 'n/a' : `${value.toFixed(4)}¢ ($${(value / 100).toFixed(4)})`

const formatDurationMs = (value: number | null): string => {
  if (value === null) {
    return 'n/a'
  }
  if (value < 1000) {
    return `${value} ms`
  }
  const totalSeconds = value / 1000
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(2)} s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toFixed(2)}s`
}

const buildMissingProviderSummary = (analysis: RunConsensusAnalysis): string[] => {
  const produced = new Set(analysis.metadata.producedProviderKeys)
  const missing = analysis.metadata.requestedProviderKeys.filter((providerKey) => !produced.has(providerKey))
  return missing.length === 0
    ? ['- Missing requested providers: none']
    : [`- Missing requested providers: ${missing.map((provider) => `\`${provider}\``).join(', ')}`]
}

const buildRunConsensusReportMarkdown = (analysis: RunConsensusAnalysis): string => {
  const lines: string[] = []
  lines.push('# STT Consensus Report')
  lines.push('')
  lines.push(`Source run: \`${analysis.runLabel}\``)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Title: ${analysis.metadata.title ? `\`${analysis.metadata.title}\`` : 'n/a'}`)
  lines.push(`- Duration: ${analysis.metadata.duration ? `\`${analysis.metadata.duration}\`` : 'n/a'}`)
  lines.push(`- Completion status: ${analysis.metadata.completionStatus ? `\`${analysis.metadata.completionStatus}\`` : 'n/a'}`)
  lines.push(`- Requested providers: ${analysis.metadata.requestedProviderKeys.length}`)
  lines.push(`- Produced transcripts: ${analysis.providers.length}`)
  lines.push(`- Comparison rows: ${analysis.rows.length}`)
  lines.push(`- Review windows: ${analysis.reviewWindows.length}`)
  lines.push(`- Actual total cost: ${formatCents(analysis.metadata.actualTotalCostCents)}`)
  lines.push(`- Actual total provider processing time: ${formatDurationMs(analysis.metadata.actualTotalProcessingTimeMs)}`)
  lines.push(`- Wall time: ${formatDurationMs(analysis.metadata.wallTimeMs)}`)
  lines.push(...buildMissingProviderSummary(analysis))
  lines.push(`- Audio grounding: provider-native evidence only${analysis.audioPath ? ' with review clip extraction' : ' (audio file unavailable for clip extraction)'}`)
  lines.push('')
  lines.push('## Provider Summary')
  lines.push('')
  lines.push('| Provider | Similarity | Coverage | Timing | Native Words | Confidence | Speakers | Actual Cost | Actual Time |')
  lines.push('|---|---:|---:|---|---:|---:|---:|---:|---:|')
  analysis.providerSummary.forEach((provider) => {
    lines.push(`| ${provider.label} | ${provider.similarity.toFixed(2)} | ${provider.rowCoverage}/${analysis.rows.length} | ${provider.timingQuality} | ${provider.capabilities.hasNativeWordTiming ? 'yes' : 'no'} | ${provider.capabilities.hasConfidence ? 'yes' : 'no'} | ${provider.capabilities.hasSpeakerLabels ? 'yes' : 'no'} | ${formatCents(provider.actualCostCents)} | ${formatDurationMs(provider.actualProcessingTimeMs)} |`)
  })
  lines.push('')
  lines.push('## Comparison')
  lines.push('')

  if (analysis.rows.length === 0) {
    lines.push('- No comparison rows were generated from the available evidence.')
  } else {
    analysis.rows.forEach((row) => {
      const speakerSuffix = row.speaker ? ` [${row.speaker}]` : ''
      lines.push(`### ${row.startTimestamp} - ${row.endTimestamp}${speakerSuffix}`)
      lines.push('')
      lines.push(`- Consensus: ${row.consensusText}`)
      lines.push(`- Confidence: ${row.confidence.toFixed(2)}/100`)
      lines.push(`- Average similarity: ${row.averageSimilarity.toFixed(2)}/100`)
      lines.push(`- Review: ${row.reviewReasons.length === 0 ? 'no' : row.reviewReasons.join('; ')}`)
      row.variants.forEach((variant) => {
        const speakerNote = variant.speaker ? ` [${variant.speaker}]` : ''
        lines.push(`- ${variant.label}${speakerNote}: ${variant.text.length > 0 ? variant.text : '(no aligned words)'} (${variant.similarity.toFixed(2)}/100)`)
      })
      lines.push('')
    })
  }

  lines.push('## Artifacts')
  lines.push('')
  lines.push('- `consensus-transcription.txt` is the clean best-guess transcript built from the merged provider windows.')
  lines.push('- `consensus-review.md` lists only the low-confidence windows.')
  lines.push('- `consensus-report.json` contains the structured rows and provider summary.')
  if (analysis.reviewWindows.some((window) => window.clipPath !== null)) {
    lines.push('- `review-clips/` contains extracted mp3 clips for review windows.')
  }

  return lines.join('\n')
}

const buildRunReviewMarkdown = (analysis: RunConsensusAnalysis): string => {
  const lines: string[] = []
  lines.push('# STT Consensus Review')
  lines.push('')
  lines.push(`Source run: \`${analysis.runLabel}\``)
  lines.push('')

  if (analysis.reviewWindows.length === 0) {
    lines.push('- No review windows were flagged.')
    return lines.join('\n')
  }

  analysis.reviewWindows.forEach((window) => {
    const speakerSuffix = window.speaker ? ` [${window.speaker}]` : ''
    lines.push(`## ${window.startTimestamp} - ${window.endTimestamp}${speakerSuffix}`)
    lines.push('')
    lines.push(`- Consensus: ${window.consensusText}`)
    lines.push(`- Confidence: ${window.confidence.toFixed(2)}/100`)
    lines.push(`- Reasons: ${window.reasons.join('; ')}`)
    lines.push(`- Clip: ${window.clipPath ? `\`${window.clipPath}\`` : 'not available'}`)
    lines.push('')
  })

  return lines.join('\n')
}

const toStructuredRunSummary = (analysis: RunConsensusAnalysis): Record<string, unknown> => ({
  runDir: analysis.runDir,
  runLabel: analysis.runLabel,
  metadata: analysis.metadata,
  rows: analysis.rows,
  reviewWindows: analysis.reviewWindows,
  providerSummary: analysis.providerSummary,
  audioPath: analysis.audioPath
})

export const writeRunConsensusArtifacts = async (analysis: RunConsensusAnalysis): Promise<{
  consensusPath: string
  reportPath: string
  jsonPath: string
  reviewPath: string
}> => {
  const consensusPath = join(analysis.runDir, 'consensus-transcription.txt')
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

export const buildAggregateConsensusReportMarkdown = (targetDir: string, analyses: RunConsensusAnalysis[]): string => {
  const lines: string[] = []
  lines.push('# STT Consensus Batch Report')
  lines.push('')
  lines.push(`Target directory: \`${targetDir}\``)
  lines.push('')
  lines.push('## Runs')
  lines.push('')
  lines.push('| Run | Produced Providers | Rows | Review Windows | Best Similarity | Missing Providers | Actual Cost | Wall Time |')
  lines.push('|---|---:|---:|---:|---:|---|---:|---:|')

  analyses.forEach((analysis) => {
    const bestProvider = analysis.providerSummary[0]
    const produced = new Set(analysis.metadata.producedProviderKeys)
    const missingProviders = analysis.metadata.requestedProviderKeys.filter((providerKey) => !produced.has(providerKey))
    lines.push(`| ${analysis.runLabel} | ${analysis.providers.length} | ${analysis.rows.length} | ${analysis.reviewWindows.length} | ${bestProvider ? bestProvider.similarity.toFixed(2) : 'n/a'} | ${missingProviders.length === 0 ? 'none' : missingProviders.join(', ')} | ${formatCents(analysis.metadata.actualTotalCostCents)} | ${formatDurationMs(analysis.metadata.wallTimeMs)} |`)
  })

  lines.push('')
  lines.push('Each run directory also contains `consensus-transcription.txt`, `consensus-report.md`, `consensus-review.md`, and `consensus-report.json`.')
  return lines.join('\n')
}

export const analyzeAndWriteConsensusReports = async (targetPath: string): Promise<{
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
  const runDirectories = await discoverAnalyzableRunDirectories(targetPath)
  const analyses = await Promise.all(runDirectories.map((runDir) => analyzeSttRunDirectory(runDir)))
  const runArtifacts = await Promise.all(analyses.map(async (analysis) => ({
    runDir: analysis.runDir,
    ...(await writeRunConsensusArtifacts(analysis))
  })))

  if (runDirectories.length === 1) {
    return {
      targetDir: resolve(targetPath),
      runArtifacts,
      aggregateReportPath: null
    }
  }

  const aggregateReportPath = join(resolve(targetPath), 'consensus-report.md')
  await writeFile(
    aggregateReportPath,
    `${buildAggregateConsensusReportMarkdown(resolve(targetPath), analyses)}\n`,
    'utf8'
  )

  return {
    targetDir: resolve(targetPath),
    runArtifacts,
    aggregateReportPath
  }
}
