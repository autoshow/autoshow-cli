import { err } from '@/logging'
import { processScriptWithElevenLabs } from '../tts-services/elevenlabs'
import { processScriptWithCoqui } from '../tts-local/coqui'
import { processScriptWithPolly } from '../tts-services/polly'
import { processScriptWithKitten } from '../tts-local/kitten'
import { processScriptWithQwen3 } from '../tts-local/qwen3'
import { processScriptWithChatterbox } from '../tts-local/chatterbox'
import { processScriptWithFishAudio } from '../tts-local/fish-audio'
import { processScriptWithCosyVoice } from '../tts-local/cosyvoice'
import type { TtsEngine } from '../tts-types'

const scriptProcessors: Record<TtsEngine, (s: string, o: string, opts: any) => Promise<void>> = {
  elevenlabs: processScriptWithElevenLabs,
  coqui: async (s: string, o: string, opts: any) => {
    return processScriptWithCoqui(s, o, { model: opts.coquiModel, language: opts.language, speed: opts.speed })
  },
  polly: async (s: string, o: string, opts: any) => {
    return processScriptWithPolly(s, o, { voice: opts.voice, format: opts.pollyFormat, sampleRate: opts.pollySampleRate, engine: opts.pollyEngine, languageCode: opts.language })
  },
  kitten: async (s: string, o: string, opts: any) => {
    return processScriptWithKitten(s, o, { model: opts.kittenModel, speed: opts.speed })
  },
  qwen3: async (s: string, o: string, opts: any) => {
    return processScriptWithQwen3(s, o, { 
      model: opts.qwen3Model, 
      speaker: opts.qwen3Speaker, 
      language: opts.qwen3Language,
      instruct: opts.qwen3Instruct,
      mode: opts.qwen3Mode,
      refAudio: opts.refAudio,
      refText: opts.refText,
      speed: opts.speed,
      maxChunk: opts.qwen3MaxChunk
    })
  },
  chatterbox: async (s: string, o: string, opts: any) => {
    return processScriptWithChatterbox(s, o, { 
      model: opts.chatterboxModel,
      refAudio: opts.refAudio,
      languageId: opts.chatterboxLanguage,
      device: opts.chatterboxDevice,
      dtype: opts.chatterboxDtype,
      exaggeration: opts.chatterboxExaggeration,
      cfgWeight: opts.chatterboxCfg
    })
  },
  fishaudio: async (s: string, o: string, opts: any) => {
    return processScriptWithFishAudio(s, o, {
      language: opts.fishLanguage,
      apiUrl: opts.fishApiUrl || process.env['FISHAUDIO_API_URL'],
      refAudio: opts.refAudio,
      refText: opts.refText,
      emotion: opts.fishEmotion,
      device: opts.fishDevice
    })
  },
  cosyvoice: async (s: string, o: string, opts: any) => {
    return processScriptWithCosyVoice(s, o, {
      mode: opts.cosyMode,
      language: opts.cosyLanguage,
      apiUrl: opts.cosyApiUrl || process.env['COSYVOICE_API_URL'],
      refAudio: opts.refAudio,
      refText: opts.refText,
      instruct: opts.cosyInstruct,
      stream: opts.cosyStream
    })
  }
}

export const processScriptWithEngine = async (engine: TtsEngine, scriptPath: string, outDir: string, options: any): Promise<void> => {
  const processor = scriptProcessors[engine]
  if (!processor) err(`Unknown engine: ${engine}`)
  await processor(scriptPath, outDir, options)
}
