import { defineCliCommand } from '~/cli/native'
import { resumeFlags } from '~/cli/flags'
import { dispatchResume } from './resume-dispatch'

const outputDirParameter = [{
  key: '<outputDir>',
  description: 'Existing run or batch output directory (contains run.json or batch.json)'
}] as const

export const resumeCommand = defineCliCommand({
  name: 'resume',
  description: 'Resume missing provider outputs in an existing run or batch directory',
  parameters: outputDirParameter,
  flags: resumeFlags,
  help: {
    examples: [
      ['bun as resume ./output/2026-04-22_12-00-00-000_item', 'Resume a single run directory in place'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch', 'Resume a batch directory in place'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch --deepinfra-stt', 'Retry or add DeepInfra STT outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch --glm-ocr glm-ocr', 'Retry or add GLM OCR outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_run --elevenlabs-tts eleven_v3', 'Retry or add ElevenLabs TTS outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_run --gemini-image gemini-3.1-flash-image-preview', 'Retry or add Gemini image outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_run --runway-video gen4.5', 'Retry or add Runway video outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_run --minimax-music music-2.6', 'Retry or add MiniMax music outputs']
    ]
  }
}, async (ctx) => {
  await dispatchResume(ctx.parameters.outputDir, ctx.flags, ctx.rawParsed.doubleDash, ctx.argv)
})
