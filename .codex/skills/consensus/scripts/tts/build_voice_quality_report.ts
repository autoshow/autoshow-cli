#!/usr/bin/env bun

import {
  parseVoiceQualityReportArgs,
  writeVoiceQualityReport,
} from '../../../../../src/cli/commands/setup-and-utilities/benchmark/tts-voice-quality-report.ts'

async function main(): Promise<number> {
  const args = parseVoiceQualityReportArgs(process.argv.slice(2))
  await writeVoiceQualityReport(args)
  return 0
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
