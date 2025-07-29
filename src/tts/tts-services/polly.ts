import { l, err } from '../../text/utils/logging.ts'
import { 
  ensureDir, fs, path, spawnSync
} from '../../text/utils/node-utils.ts'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils.ts'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import type { OutputFormat, VoiceId, Engine, LanguageCode } from '@aws-sdk/client-polly'

const VOICE_TYPES = {
  neural: ['Ivy', 'Joanna', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Justin', 'Kevin', 'Matthew', 'Ruth', 'Stephen', 'Amy', 'Brian', 'Emma', 'Olivia', 'Aria', 'Ayanda', 'Gabrielle', 'Liam', 'Mia', 'Seoyeon', 'Danielle', 'Gregory', 'Takumi', 'Kazuha', 'Tomoko', 'Camila', 'Lupe', 'Pedro', 'Adriano', 'Remi', 'Lea', 'Vicki', 'Bianca', 'Lucia', 'Kajal'],
  generative: ['Olivia', 'Kajal', 'Amy', 'Danielle', 'Joanna', 'Matthew', 'Ruth', 'Stephen', 'Ayanda', 'Lea', 'Remi', 'Lucia', 'Sergio', 'Mia', 'Andres', 'Lupe', 'Pedro', 'Vicki', 'Daniel', 'Bianca'],
  longForm: ['Danielle', 'Gregory', 'Ruth']
}

const PRICING = { standard: 4, neural: 16, 'long-form': 100, generative: 30 }

const detectEngineType = (voice: VoiceId, engine?: Engine): keyof typeof PRICING => {
  if (engine) return engine === 'standard' ? 'standard' : engine as keyof typeof PRICING
  return VOICE_TYPES.longForm.includes(voice) ? 'long-form' :
         VOICE_TYPES.generative.includes(voice) && !VOICE_TYPES.neural.includes(voice) ? 'generative' :
         VOICE_TYPES.neural.includes(voice) ? 'neural' : 'standard'
}

const getPollyClient = () => new PollyClient({ region: process.env['AWS_REGION'] || 'us-east-1' })

export async function synthesizeWithPolly(
  text: string,
  outputPath: string,
  options: {
    voice?: VoiceId
    format?: OutputFormat
    sampleRate?: string
    engine?: Engine
    languageCode?: LanguageCode
  } = {}
): Promise<string | undefined> {
  l.dim(`Starting Polly synthesis (${text.length} chars)`)
  if (!process.env['AWS_ACCESS_KEY_ID'] || !process.env['AWS_SECRET_ACCESS_KEY']) 
    err('AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
  
  const voice = options.voice || 'Joanna'
  const format = options.format || 'mp3'
  const engine = options.engine || (VOICE_TYPES.neural.includes(voice) ? 'neural' : 'standard')
  const engineType = detectEngineType(voice, engine)
  const cost = (text.length / 1_000_000) * PRICING[engineType]
  
  l.dim(`Voice: ${voice}, Format: ${format}, Engine: ${engine} ($${cost.toFixed(6)})`)
  
  try {
    const response = await getPollyClient().send(new SynthesizeSpeechCommand({
      OutputFormat: format,
      Text: text,
      TextType: 'text' as const,
      VoiceId: voice,
      SampleRate: options.sampleRate || '24000',
      Engine: engine,
      ...(options.languageCode && { LanguageCode: options.languageCode })
    }))
    
    if (!response.AudioStream) err('No audio stream received from Polly')
    await ensureDir(path.dirname(outputPath))
    await fs.writeFile(outputPath, Buffer.from(await response.AudioStream!.transformToByteArray()))
    l.dim(`Saved to ${outputPath}`)
    l.dim(`Cost: $${cost.toFixed(6)}`)
    return outputPath
  } catch (error: any) {
    err(error.name === 'CredentialsProviderError' ? 'AWS credentials error. Check your keys' :
        error.name === 'InvalidParameterValueException' ? `Invalid parameter: ${error.message}` :
        `Polly error: ${error.message || error}`)
    return undefined
  }
}

export async function processScriptWithPolly(
  scriptFile: string,
  outDir: string,
  options: {
    voice?: VoiceId
    format?: OutputFormat
    sampleRate?: string
    engine?: Engine
    languageCode?: LanguageCode
  } = {}
): Promise<void> {
  try {
    l.dim(`Reading Polly script: ${scriptFile}`)
    const script = JSON.parse(await fs.readFile(scriptFile, 'utf8'))
    await ensureDir(outDir)
    await ensureSilenceFile(outDir)
    
    const voiceMapping: Record<string, VoiceId> = {
      DUCO: (process.env['POLLY_VOICE_DUCO'] as VoiceId) || 'Matthew',
      SEAMUS: (process.env['POLLY_VOICE_SEAMUS'] as VoiceId) || 'Brian'
    }
    
    l.dim(`Processing ${script.length} lines with Polly`)
    const format = options.format || 'mp3'
    let totalCost = 0
    
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      l.dim(`Line ${idx + 1}/${script.length} (${speaker})`)
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const audioOut = path.join(outDir, `${base}.${format}`)
      const pcmOut = path.join(outDir, `${base}.pcm`)
      
      const speakerVoice = voiceMapping[speaker] || options.voice || 'Joanna'
      const engineType = detectEngineType(speakerVoice, options.engine)
      const cost = (text.length / 1_000_000) * PRICING[engineType]
      totalCost += cost
      
      await synthesizeWithPolly(text, audioOut, { ...options, voice: speakerVoice })
      
      if (format === 'mp3') {
        const result = spawnSync('ffmpeg', ['-i', audioOut, '-f', 's16le', '-ar', '24000', '-ac', '1', pcmOut], { stdio: 'pipe' })
        if (result.status !== 0) l.dim(`Failed to convert: ${result.stderr?.toString()}`)
      } else if (format === 'pcm') {
        await fs.copyFile(audioOut, pcmOut)
      }
      
      l.dim(`Saved ${audioOut}`)
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 100))
    }))
    
    l.dim(`Total cost: $${totalCost.toFixed(6)}`)
    if (format !== 'ogg_vorbis') {
      l.dim('Merging Polly audio files')
      await mergeAudioFiles(outDir)
      await convertPcmToWav(outDir)
      l.dim(`Conversation saved to ${path.join(outDir, 'full_conversation.wav')} 🔊`)
    } else {
      l.dim(`Individual files saved to ${outDir}`)
    }
  } catch (error) {
    err(`Error processing Polly script: ${error}`)
  }
}