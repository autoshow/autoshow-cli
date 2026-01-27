import { l, err, success } from '@/logging'
import { 
  ensureDir, readFile, writeFile, join, dirname
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils/audio-utils'
import {
  checkElevenLabsInstalled, installNpmPackage
} from '../tts-utils/setup-utils'
import type { VoiceSettings } from '../tts-types'

export const DEFAULT_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
}

const ensureElevenLabsInstalled = () => {
  if (!checkElevenLabsInstalled()) {
    l('ElevenLabs package not installed, attempting automatic installation')
    const installed = installNpmPackage('elevenlabs')
    if (!installed) {
      err('Failed to install ElevenLabs. Please run: npm install elevenlabs')
    }
  }
}

export async function synthesizeWithElevenLabs(
  text: string, 
  outputPath: string,
  voiceId: string,
  settings: VoiceSettings = DEFAULT_SETTINGS,
  retries: number = 3
): Promise<string> {
  if (!process.env['ELEVENLABS_API_KEY']) err(`ELEVENLABS_API_KEY not set`)
  
  ensureElevenLabsInstalled()
  
  const delays = [1000, 2000, 4000]
  
  const attemptSynthesis = async (attempt: number): Promise<string> => {
    try {
      const { ElevenLabsClient } = await import('elevenlabs')
      
      const audioStream = await new ElevenLabsClient({ apiKey: process.env['ELEVENLABS_API_KEY']! }).generate({
        voice: voiceId,
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: settings
      })
      
      const chunks: Uint8Array[] = []
      for await (const chunk of audioStream) chunks.push(chunk)
      
      await ensureDir(dirname(outputPath))
      await writeFile(outputPath, Buffer.concat(chunks))
      return outputPath
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') err('Install: npm install elevenlabs')
      if (error.message?.includes('429') || error.statusCode === 429) {
        l('Rate limit hit', { attempt: attempt + 1 })
        if (attempt < retries) {
          const delay = delays[attempt] || 4000
          l('Waiting before retry', { delayMs: delay })
          await new Promise(resolve => setTimeout(resolve, delay))
          return attemptSynthesis(attempt + 1)
        }
      }
      throw error
    }
  }
  
  return attemptSynthesis(0)
}

export async function processScriptWithElevenLabs(
  scriptFile: string,
  outDir: string
): Promise<void> {
  try {
    ensureElevenLabsInstalled()
    
    const script = JSON.parse(await readFile(scriptFile, 'utf8'))
    await ensureDir(outDir)
    await ensureSilenceFile(outDir)
    
    const voiceMapping: Record<string, string> = {
      DUCO: process.env['VOICE_ID_DUCO'] || 'ryn3WBvkCsp4dPZksMIf',
      SEAMUS: process.env['VOICE_ID_SEAMUS'] || '21m00Tcm4TlvDq8ikWAM'
    }
    
    const uniqueSpeakers = [...new Set(script.map((e: {speaker: string}) => e.speaker))]
    const missingVoices = uniqueSpeakers.filter(s => !voiceMapping[s as string] || voiceMapping[s as string]?.length === 0)
    if (missingVoices.length > 0) err('Missing voice IDs', { speakers: missingVoices.join(', ') })
    
    l('Processing lines with ElevenLabs', { lineCount: script.length })
    
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const wavOut = join(outDir, `${base}.wav`)
      const pcmOut = join(outDir, `${base}.pcm`)
      
      await synthesizeWithElevenLabs(text, wavOut, voiceMapping[speaker]!)
      await writeFile(pcmOut, (await readFile(wavOut)).slice(44))
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 1000))
    }))
    
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    success('Conversation saved', { outputFile: join(outDir, 'full_conversation.wav') })
  } catch (error) {
    err('Error processing ElevenLabs script', { error })
  }
}