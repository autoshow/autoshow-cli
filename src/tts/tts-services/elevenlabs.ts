import { l, err } from '@/logging'
import { 
  ensureDir, fs, path
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils'
import {
  checkElevenLabsInstalled, installNpmPackage
} from '../tts-utils/setup-utils'
import type { VoiceSettings } from '../tts-types'

const p = '[tts/tts-services/elevenlabs]'

export const DEFAULT_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
}

const ensureElevenLabsInstalled = () => {
  if (!checkElevenLabsInstalled()) {
    l.dim(`${p} ElevenLabs package not installed, attempting automatic installation...`)
    const installed = installNpmPackage('elevenlabs')
    if (!installed) {
      err(`${p} Failed to install ElevenLabs. Please run: npm install elevenlabs`)
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
  if (!process.env['ELEVENLABS_API_KEY']) err(`${p} ELEVENLABS_API_KEY not set`)
  
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
      
      await ensureDir(path.dirname(outputPath))
      await fs.writeFile(outputPath, Buffer.concat(chunks))
      return outputPath
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') err(`${p} Install: npm install elevenlabs`)
      if (error.message?.includes('429') || error.statusCode === 429) {
        l.dim(`${p} Rate limit hit, attempt ${attempt + 1} failed`)
        if (attempt < retries) {
          const delay = delays[attempt] || 4000
          l.dim(`${p} Waiting ${delay}ms before retry`)
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
    
    const script = JSON.parse(await fs.readFile(scriptFile, 'utf8'))
    await ensureDir(outDir)
    await ensureSilenceFile(outDir)
    
    const voiceMapping: Record<string, string> = {
      DUCO: process.env['VOICE_ID_DUCO'] || 'ryn3WBvkCsp4dPZksMIf',
      SEAMUS: process.env['VOICE_ID_SEAMUS'] || '21m00Tcm4TlvDq8ikWAM'
    }
    
    const uniqueSpeakers = [...new Set(script.map((e: {speaker: string}) => e.speaker))]
    const missingVoices = uniqueSpeakers.filter(s => !voiceMapping[s as string] || voiceMapping[s as string]?.length === 0)
    if (missingVoices.length > 0) err(`${p} Missing voice IDs for: ${missingVoices.join(', ')}`)
    
    l.opts(`${p} Processing ${script.length} lines with ElevenLabs`)
    
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const wavOut = path.join(outDir, `${base}.wav`)
      const pcmOut = path.join(outDir, `${base}.pcm`)
      
      await synthesizeWithElevenLabs(text, wavOut, voiceMapping[speaker]!)
      await fs.writeFile(pcmOut, (await fs.readFile(wavOut)).slice(44))
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 1000))
    }))
    
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    l.success(`${p} Conversation saved to ${path.join(outDir, 'full_conversation.wav')} 🔊`)
  } catch (error) {
    err(`${p} Error processing ElevenLabs script: ${error}`)
  }
}