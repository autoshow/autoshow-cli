import { err } from '@/logging'
import { processScriptWithElevenLabs } from '../tts-services/elevenlabs.ts'
import { processScriptWithCoqui } from '../tts-services/coqui.ts'
import { processScriptWithPolly } from '../tts-services/polly.ts'
import { processScriptWithKitten } from '../tts-services/kitten.ts'
import type { TtsEngine } from '../tts-types'

const scriptProcessors = {
  elevenlabs: processScriptWithElevenLabs,
  coqui: async (s: string, o: string, opts: any) => {
    return processScriptWithCoqui(s, o, { model: opts.coquiModel, language: opts.language, speed: opts.speed })
  },
  polly: async (s: string, o: string, opts: any) => {
    return processScriptWithPolly(s, o, { voice: opts.voice, format: opts.pollyFormat, sampleRate: opts.pollySampleRate, engine: opts.pollyEngine, languageCode: opts.language })
  },
  kitten: async (s: string, o: string, opts: any) => {
    return processScriptWithKitten(s, o, { model: opts.kittenModel, speed: opts.speed })
  }
}

export const processScriptWithEngine = async (engine: TtsEngine, scriptPath: string, outDir: string, options: any): Promise<void> => {
  const processor = scriptProcessors[engine]
  if (!processor) err(`Unknown engine: ${engine}`)
  await processor(scriptPath, outDir, options)
}