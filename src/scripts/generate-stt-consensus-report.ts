import { analyzeAndWriteConsensusReports } from '~/utils/stt-consensus-report'

const targetPath = process.argv[2]

if (!targetPath) {
  throw new Error('Usage: bun src/scripts/generate-stt-consensus-report.ts <output-dir>')
}

const result = await analyzeAndWriteConsensusReports(targetPath)

for (const artifact of result.runArtifacts) {
  console.log(`Run: ${artifact.runDir}`)
  console.log(`  consensus: ${artifact.consensusPath}`)
  console.log(`  report: ${artifact.reportPath}`)
  console.log(`  json: ${artifact.jsonPath}`)
  console.log(`  review: ${artifact.reviewPath}`)
}

if (result.aggregateReportPath) {
  console.log(`Aggregate report: ${result.aggregateReportPath}`)
}
