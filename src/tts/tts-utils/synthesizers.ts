import { l, err } from '@/logging'
import { basename, extname, join } from '@/node-utils'
import { synthesizeWithElevenLabs } from '../tts-services/elevenlabs.ts'
import { synthesizeWithCoqui } from '../tts-services/coqui.ts'
import { synthesizeWithPolly } from '../tts-services/polly.ts'
import { stripMarkdown } from './text-utils.ts'
import type { TtsEngine } from './engine-utils.ts'

const p = '[tts/tts-utils/synthesizers]'

const synthesizers = {
  elevenlabs: async (plain: string, out: string, opts: any) => {
    l.dim(`${p} Processing with ElevenLabs synthesizer`)
    return synthesizeWithElevenLabs(plain, out, opts.voice || process.env['ELEVENLABS_DEFAULT_VOICE'] || 'onwK4e9ZLuTAKqWW03F9')
  },
  coqui: async (plain: string, out: string, opts: any) => {
    l.dim(`${p} Processing with Coqui synthesizer`)
    return synthesizeWithCoqui(plain, out, { model: opts.coquiModel, speaker: opts.speaker, speakerWav: opts.voiceClone, language: opts.language, speed: opts.speed })
  },
  polly: async (plain: string, _: string, opts: any) => {
    l.dim(`${p} Processing with Polly synthesizer`)
    return synthesizeWithPolly(plain, join(opts.outDir, basename(opts.filePath, extname(opts.filePath)) + '.' + (opts.pollyFormat || 'mp3')), 
      { voice: opts.voice, format: opts.pollyFormat || 'mp3', sampleRate: opts.pollySampleRate, engine: opts.pollyEngine, languageCode: opts.language })
  }
}

export const processFileWithEngine = async (engine: TtsEngine, filePath: string, outDir: string, options: any): Promise<void> => {
  l.dim(`${p} Processing file with ${engine} engine`)
  const plain = stripMarkdown(filePath)
  const wavOut = join(outDir, basename(filePath, extname(filePath)) + '.wav')
  const synth = synthesizers[engine]
  if (!synth) err(`${p} Unknown engine: ${engine}`)
  l.dim(`${p} Synthesising → ${engine === 'polly' ? outDir : wavOut}`)
  await synth(plain, wavOut, { ...options, outDir, filePath })
}