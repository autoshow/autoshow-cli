import { l, err } from '../../logging.ts'
import { processScriptWithElevenLabs } from '../tts-services/elevenlabs.ts'
import { processScriptWithCoqui } from '../tts-services/coqui.ts'
import { processScriptWithPolly } from '../tts-services/polly.ts'
import type { TtsEngine } from './engine-utils.ts'

const scriptProcessors = {
  elevenlabs: processScriptWithElevenLabs,
  coqui: async (s: string, o: string, opts: any) => {
    l.dim('Processing script with Coqui')
    return processScriptWithCoqui(s, o, { model: opts.coquiModel, language: opts.language, speed: opts.speed })
  },
  polly: async (s: string, o: string, opts: any) => {
    l.dim('Processing script with Polly')
    return processScriptWithPolly(s, o, { voice: opts.voice, format: opts.pollyFormat, sampleRate: opts.pollySampleRate, engine: opts.pollyEngine, languageCode: opts.language })
  }
}

export const processScriptWithEngine = async (engine: TtsEngine, scriptPath: string, outDir: string, options: any): Promise<void> => {
  l.dim(`Processing script with ${engine} engine`)
  const processor = scriptProcessors[engine]
  if (!processor) err(`Unknown engine: ${engine}`)
  await processor(scriptPath, outDir, options)
}