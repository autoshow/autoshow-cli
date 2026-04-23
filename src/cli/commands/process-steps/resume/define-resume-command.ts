import { defineCommand } from 'clerc'
import { resumeFlags } from '~/cli/flags'
import { dispatchResume } from './resume-dispatch'

const outputDirParameter = [{
  key: '[outputDir]',
  description: 'Existing run or batch output directory (contains run.json or batch.json)'
}] as const

export const resumeCommand = defineCommand({
  name: 'resume',
  description: 'Resume missing STT or OCR provider outputs in an existing run or batch directory',
  parameters: outputDirParameter,
  flags: resumeFlags,
  help: {
    examples: [
      ['bun as resume', 'Resume the newest incomplete STT or OCR output under ./output'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_item', 'Resume a single run directory in place'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch', 'Resume a batch directory in place'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch --deepinfra-stt', 'Resume only missing DeepInfra STT outputs in that target'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch --tesseract-ocr', 'Resume only missing Tesseract OCR outputs in that target'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch --glm-ocr glm-ocr', 'Resume only missing GLM OCR outputs in that target']
    ]
  }
}, async (ctx) => {
  await dispatchResume(ctx.parameters.outputDir, ctx.flags, ctx.rawParsed.doubleDash)
})
