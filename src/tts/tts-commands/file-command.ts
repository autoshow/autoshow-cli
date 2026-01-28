import { err } from '@/logging'
import { basename, extname, join } from '@/node-utils'
import { synthesizeWithElevenLabs } from '../tts-services/elevenlabs'
import { synthesizeWithPolly } from '../tts-services/polly'
import { synthesizeWithQwen3 } from '../tts-local/qwen3'
import { synthesizeWithChatterbox } from '../tts-local/chatterbox'
import { synthesizeWithFishAudio } from '../tts-local/fish-audio'
import { synthesizeWithCosyVoice } from '../tts-local/cosyvoice'
import { stripMarkdown } from '../tts-utils/text-utils'
import type { TtsEngine } from '../tts-types'

const synthesizers: Record<TtsEngine, (plain: string, out: string, opts: any) => Promise<string | void>> = {
  elevenlabs: async (plain: string, out: string, opts: any) => {
    return synthesizeWithElevenLabs(plain, out, opts.voice || process.env['ELEVENLABS_DEFAULT_VOICE'] || 'onwK4e9ZLuTAKqWW03F9')
  },
  polly: async (plain: string, _: string, opts: any) => {
    return synthesizeWithPolly(plain, join(opts.outDir, basename(opts.filePath, extname(opts.filePath)) + '.' + (opts.pollyFormat || 'mp3')), 
      { voice: opts.voice, format: opts.pollyFormat || 'mp3', sampleRate: opts.pollySampleRate, engine: opts.pollyEngine, languageCode: opts.language })
  },
  qwen3: async (plain: string, out: string, opts: any) => {
    return synthesizeWithQwen3(plain, out, { 
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
  chatterbox: async (plain: string, out: string, opts: any) => {
    return synthesizeWithChatterbox(plain, out, { 
      model: opts.chatterboxModel,
      refAudio: opts.refAudio,
      languageId: opts.chatterboxLanguage,
      device: opts.chatterboxDevice,
      dtype: opts.chatterboxDtype,
      exaggeration: opts.chatterboxExaggeration,
      cfgWeight: opts.chatterboxCfg
    })
  },
  fishaudio: async (plain: string, out: string, opts: any) => {
    return synthesizeWithFishAudio(plain, out, {
      language: opts.fishLanguage,
      apiUrl: opts.fishApiUrl || process.env['FISHAUDIO_API_URL'],
      refAudio: opts.refAudio,
      refText: opts.refText,
      emotion: opts.fishEmotion,
      device: opts.fishDevice
    })
  },
  cosyvoice: async (plain: string, out: string, opts: any) => {
    return synthesizeWithCosyVoice(plain, out, {
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

export const processFileWithEngine = async (engine: TtsEngine, filePath: string, outDir: string, options: any): Promise<void> => {
  const plain = stripMarkdown(filePath)
  const wavOut = join(outDir, basename(filePath, extname(filePath)) + '.wav')
  const synth = synthesizers[engine]
  if (!synth) err(`Unknown engine: ${engine}`)
  await synth(plain, wavOut, { ...options, outDir, filePath })
}
