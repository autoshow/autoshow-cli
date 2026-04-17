import { defineCommand } from 'clerc'
import * as l from '~/logger'
import { analyzeAndWriteOcrConsensusReports } from './ocr-consensus-report'
import { detectReportTarget } from './report-target-detection'
import { analyzeAndWriteConsensusReports } from './stt-consensus-report'
import { CLIUsageError } from '~/utils/error-handler'

const outputDirParameter = [{
  key: '<outputDir>',
  description: 'STT or OCR run directory, or a batch root containing reportable run directories'
}] as const

export const reportCommand = defineCommand({
  name: 'report',
  description: 'Generate consensus report artifacts for STT or OCR run outputs',
  parameters: outputDirParameter,
  help: {
    examples: [
      ['bun as report ./output/2026-04-15_episode', 'Generate report artifacts for one STT or OCR run'],
      ['bun as report ./output/ocr-batch', 'Generate per-run reports plus a batch aggregate report']
    ]
  }
}, async (ctx) => {
  const outputDir = String(ctx.parameters.outputDir || '').trim()
  if (outputDir.length === 0) {
    throw CLIUsageError('Missing report target directory. Run: bun as help report')
  }

  const target = await detectReportTarget(outputDir)
  const result = target.kind === 'stt'
    ? await analyzeAndWriteConsensusReports(target.targetDir)
    : await analyzeAndWriteOcrConsensusReports(target.targetDir)

  l.success(`Generated ${target.kind.toUpperCase()} report artifacts for ${result.runArtifacts.length} run(s)`)
  for (const artifact of result.runArtifacts) {
    l.info(`Run: ${artifact.runDir}`)
    l.info(`Consensus: ${artifact.consensusPath}`)
    l.info(`Report: ${artifact.reportPath}`)
    l.info(`JSON: ${artifact.jsonPath}`)
    l.info(`Review: ${artifact.reviewPath}`)
  }

  if (result.aggregateReportPath) {
    l.info(`Aggregate report: ${result.aggregateReportPath}`)
  }
})
