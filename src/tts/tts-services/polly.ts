import { l, err } from '@/logging'
import { 
  ensureDir, fs, path, spawnSync
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils'
import {
  checkPollyInstalled, installNpmPackage
} from '../tts-utils/setup-utils'

const VOICE_TYPES = {
  neural: ['Ivy', 'Joanna', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Justin', 'Kevin', 'Matthew', 'Ruth', 'Stephen', 'Amy', 'Brian', 'Emma', 'Olivia', 'Aria', 'Ayanda', 'Gabrielle', 'Liam', 'Mia', 'Seoyeon', 'Danielle', 'Gregory', 'Takumi', 'Kazuha', 'Tomoko', 'Camila', 'Lupe', 'Pedro', 'Adriano', 'Remi', 'Lea', 'Vicki', 'Bianca', 'Lucia', 'Kajal'],
  generative: ['Olivia', 'Kajal', 'Amy', 'Danielle', 'Joanna', 'Matthew', 'Ruth', 'Stephen', 'Ayanda', 'Lea', 'Remi', 'Lucia', 'Sergio', 'Mia', 'Andres', 'Lupe', 'Pedro', 'Vicki', 'Daniel', 'Bianca'],
  longForm: ['Danielle', 'Gregory', 'Ruth']
}

const NEURAL_SUPPORTED_REGIONS = [
  'us-east-1', 'us-west-2', 'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ca-central-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'ap-northeast-2', 'ap-south-1'
]

const GENERATIVE_SUPPORTED_REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1']

const PRICING = { standard: 4, neural: 16, 'long-form': 100, generative: 30 }

const ensurePollyInstalled = async () => {
  if (!checkPollyInstalled()) {
    l.dim(`AWS Polly package not installed, attempting automatic installation...`)
    const installed = installNpmPackage('@aws-sdk/client-polly')
    if (!installed) {
      err(`Failed to install AWS Polly. Please run: npm install @aws-sdk/client-polly`)
    }
  }
}

const detectEngineType = (voice: any, engine?: any, region?: string): keyof typeof PRICING => {
  if (engine === 'standard') return 'standard'
  
  const currentRegion = region || process.env['AWS_REGION'] || 'us-east-1'
  
  if (engine === 'long-form' || VOICE_TYPES.longForm.includes(voice)) {
    if (NEURAL_SUPPORTED_REGIONS.includes(currentRegion)) {
      return 'long-form'
    }
    l.dim(`Long-form engine not supported in ${currentRegion}, falling back to standard`)
    return 'standard'
  }
  
  if (engine === 'generative' || (VOICE_TYPES.generative.includes(voice) && !VOICE_TYPES.neural.includes(voice))) {
    if (GENERATIVE_SUPPORTED_REGIONS.includes(currentRegion)) {
      return 'generative'
    }
    l.dim(`Generative engine not supported in ${currentRegion}, falling back to standard`)
    return 'standard'
  }
  
  if (engine === 'neural' || VOICE_TYPES.neural.includes(voice)) {
    if (NEURAL_SUPPORTED_REGIONS.includes(currentRegion)) {
      return 'neural'
    }
    l.dim(`Neural engine not supported in ${currentRegion}, falling back to standard`)
    return 'standard'
  }
  
  return 'standard'
}

const getPollyClient = async () => {
  await ensurePollyInstalled()
  const { PollyClient } = await import('@aws-sdk/client-polly')
  const region = process.env['AWS_REGION'] || 'us-east-1'
  l.dim(`Using AWS region: ${region}`)
  return new PollyClient({ region })
}

const getEngineForRegion = (preferredEngine: any, voice: any, region: string): any => {
  if (preferredEngine === 'standard') return 'standard'
  
  const engineType = detectEngineType(voice, preferredEngine, region)
  
  if (engineType === 'long-form' && VOICE_TYPES.longForm.includes(voice)) {
    return 'long-form'
  }
  
  if (engineType === 'generative' && GENERATIVE_SUPPORTED_REGIONS.includes(region)) {
    return 'generative'
  }
  
  if (engineType === 'neural' && NEURAL_SUPPORTED_REGIONS.includes(region)) {
    return 'neural'
  }
  
  return 'standard'
}

export async function synthesizeWithPolly(
  text: string,
  outputPath: string,
  options: {
    voice?: any
    format?: any
    sampleRate?: string
    engine?: any
    languageCode?: any
  } = {}
): Promise<string | undefined> {
  if (!process.env['AWS_ACCESS_KEY_ID'] || !process.env['AWS_SECRET_ACCESS_KEY']) 
    err(`AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY`)
  
  await ensurePollyInstalled()
  
  const voice = options.voice || 'Joanna'
  const format = options.format || 'mp3'
  const region = process.env['AWS_REGION'] || 'us-east-1'
  
  const preferredEngine = options.engine || (VOICE_TYPES.neural.includes(voice) ? 'neural' : 'standard')
  const actualEngine = getEngineForRegion(preferredEngine, voice, region)
  
  if (preferredEngine !== actualEngine) {
    l.dim(`Requested engine '${preferredEngine}' not available in ${region}, using '${actualEngine}'`)
  } else {
    l.dim(`Using engine: ${actualEngine} in region ${region}`)
  }
  
  const engineType = detectEngineType(voice, actualEngine, region)
  const cost = (text.length / 1_000_000) * PRICING[engineType]
  
  const attemptSynthesis = async (useEngine: any): Promise<string | undefined> => {
    try {
      const { SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly')
      const client = await getPollyClient()
      
      const response = await client.send(new SynthesizeSpeechCommand({
        OutputFormat: format,
        Text: text,
        TextType: 'text' as const,
        VoiceId: voice,
        SampleRate: options.sampleRate || '24000',
        Engine: useEngine,
        ...(options.languageCode && { LanguageCode: options.languageCode })
      }))
      
      if (!response.AudioStream) err(`No audio stream received from Polly`)
      await ensureDir(path.dirname(outputPath))
      await fs.writeFile(outputPath, Buffer.from(await response.AudioStream!.transformToByteArray()))
      l.dim(`Cost: $${cost.toFixed(6)}`)
      return outputPath
    } catch (error: any) {
      if (error.message?.includes('not supported in this region') || error.message?.includes('selected engine')) {
        if (useEngine !== 'standard') {
          l.dim(`Engine ${useEngine} not supported, retrying with standard engine`)
          return attemptSynthesis('standard')
        }
      }
      
      if (error.name === 'CredentialsProviderError') {
        err(`AWS credentials error. Check your keys`)
      } else if (error.name === 'InvalidParameterValueException') {
        err(`Invalid parameter: ${error.message}`)
      } else {
        err(`Polly error: ${error.message || error}`)
      }
      return undefined
    }
  }
  
  return attemptSynthesis(actualEngine)
}

export async function processScriptWithPolly(
  scriptFile: string,
  outDir: string,
  options: {
    voice?: any
    format?: any
    sampleRate?: string
    engine?: any
    languageCode?: any
  } = {}
): Promise<void> {
  try {
    await ensurePollyInstalled()
    
    const script = JSON.parse(await fs.readFile(scriptFile, 'utf8'))
    await ensureDir(outDir)
    await ensureSilenceFile(outDir)
    
    const voiceMapping: Record<string, any> = {
      DUCO: process.env['POLLY_VOICE_DUCO'] || 'Matthew',
      SEAMUS: process.env['POLLY_VOICE_SEAMUS'] || 'Brian'
    }
    
    l.opts(`Processing ${script.length} lines with Polly`)
    const format = options.format || 'mp3'
    const region = process.env['AWS_REGION'] || 'us-east-1'
    let totalCost = 0
    
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const audioOut = path.join(outDir, `${base}.${format}`)
      const pcmOut = path.join(outDir, `${base}.pcm`)
      
      const speakerVoice = voiceMapping[speaker] || options.voice || 'Joanna'
      const engineType = detectEngineType(speakerVoice, options.engine, region)
      const cost = (text.length / 1_000_000) * PRICING[engineType]
      totalCost += cost
      
      await synthesizeWithPolly(text, audioOut, { ...options, voice: speakerVoice })
      
      if (format === 'mp3') {
        const result = spawnSync('ffmpeg', ['-i', audioOut, '-f', 's16le', '-ar', '24000', '-ac', '1', pcmOut], { stdio: 'pipe' })
        if (result.status !== 0) l.dim(`Failed to convert: ${result.stderr?.toString()}`)
      } else if (format === 'pcm') {
        await fs.copyFile(audioOut, pcmOut)
      }
      
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 100))
    }))
    
    l.opts(`Total cost: $${totalCost.toFixed(6)}`)
    if (format !== 'ogg_vorbis') {
      await mergeAudioFiles(outDir)
      await convertPcmToWav(outDir)
      l.success(`Conversation saved to ${path.join(outDir, 'full_conversation.wav')} 🔊`)
    }
  } catch (error) {
    err(`Error processing Polly script: ${error}`)
  }
}