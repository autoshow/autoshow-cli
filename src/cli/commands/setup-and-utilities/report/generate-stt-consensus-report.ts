import { analyzeAndWriteConsensusReports } from '~/cli/commands/process-steps/step-2-stt/report'

const targetPath = process.argv[2]

if (!targetPath) {
  throw new Error('Usage: bun src/scripts/generate-stt-consensus-report.ts <output-dir>')
}

await analyzeAndWriteConsensusReports(targetPath)
