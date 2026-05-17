import { defineCliCommand } from '~/cli/native'
import { resumeFlags } from '~/cli/flags'
import { dispatchResume } from './resume-dispatch'

const outputDirParameter = [{
  key: '[outputDir]',
  description: 'Existing run or batch output directory (contains run.json or batch.json)'
}] as const

export const resumeCommand = defineCliCommand({
  name: 'resume',
  description: 'Resume missing provider outputs in an existing run or batch directory',
  parameters: outputDirParameter,
  flags: resumeFlags,
  help: {
    examples: [
      ['bun as resume', 'Resume the newest incomplete output under ./output'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_item', 'Resume a single run directory in place'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch', 'Resume a batch directory in place'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch --deepinfra-stt', 'Resume only missing DeepInfra STT outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_batch --glm-ocr glm-ocr', 'Resume only missing GLM OCR outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_run --elevenlabs-tts eleven_v3', 'Resume only missing ElevenLabs TTS outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_run --gemini-image imagen-4.0-fast-generate-001', 'Resume only missing Gemini image outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_run --runway-video gen4.5', 'Resume only missing Runway video outputs'],
      ['bun as resume ./output/2026-04-22_12-00-00-000_run --minimax-music music-2.5', 'Resume only missing MiniMax music outputs']
    ]
  }
}, async (ctx) => {
  await dispatchResume(ctx.parameters.outputDir, ctx.flags, ctx.rawParsed.doubleDash)
})
