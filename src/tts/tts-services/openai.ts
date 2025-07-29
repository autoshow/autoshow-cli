import { l, err } from '../../text/utils/logging.ts'
import { 
  ensureDir, fs, path
} from '../../text/utils/node-utils.ts'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils.ts'

const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const
const VALID_MODELS = ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'] as const
const VALID_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const

type OpenAIVoice = typeof VALID_VOICES[number]
type OpenAIModel = typeof VALID_MODELS[number]
type OpenAIFormat = typeof VALID_FORMATS[number]

const MODEL_CONFIG = {
  'tts-1': { name: 'TTS', cost: 15 },
  'tts-1-hd': { name: 'TTS HD', cost: 30 },
  'gpt-4o-mini-tts': { name: 'GPT-4o Mini TTS', inputCost: 0.6, outputCost: 12 }
}

const calculateCost = (model: OpenAIModel, textLength: number) => {
  const config = MODEL_CONFIG[model]
  if (model === 'gpt-4o-mini-tts') {
    return (textLength / 4 / 1_000_000) * (config as { inputCost: number }).inputCost +
           (textLength * 25 / 4 / 1_000_000) * (config as { outputCost: number }).outputCost
  } else {
    return (textLength / 1_000_000) * (config as { cost: number }).cost
  }
}

export async function synthesizeWithOpenAI(
  text: string, 
  outputPath: string,
  model: OpenAIModel = 'tts-1',
  voice: OpenAIVoice = 'alloy',
  format: OpenAIFormat = 'mp3',
  speed: number = 1.0,
  instructions?: string
): Promise<string | undefined> {
  if (!process.env['OPENAI_API_KEY']) {
    err('OPENAI_API_KEY not set')
    return undefined
  }
  
  try {
    l.dim('Loading OpenAI module')
    const { openai } = await import('@ai-sdk/openai')
    const { experimental_generateSpeech: generateSpeech } = await import('ai')
    
    const cost = calculateCost(model, text.length)
    l.dim(`Synthesizing (${text.length} chars) - ${model}, ${voice}, ${format} ($${cost.toFixed(6)})`)
    
    const startTime = Date.now()
    const result = await generateSpeech({
      model: openai.speech(model),
      text,
      providerOptions: {
        openai: {
          voice,
          response_format: format,
          speed,
          ...(instructions && model === 'gpt-4o-mini-tts' && { instructions })
        }
      }
    })
    
    l.dim(`Completed in ${(Date.now() - startTime) / 1000}s`)
    await ensureDir(path.dirname(outputPath))
    await fs.writeFile(outputPath, Buffer.from(result.audio.uint8Array))
    l.dim(`Saved to ${outputPath}`)
    l.dim(`Cost: $${cost.toFixed(6)}`)
    return outputPath
  } catch (error: any) {
    err(error.code === 'MODULE_NOT_FOUND' ? 'Install: npm install @ai-sdk/openai ai' : `OpenAI error: ${error}`)
    return undefined
  }
}

export async function processScriptWithOpenAI(
  scriptFile: string,
  outDir: string,
  model: OpenAIModel = 'tts-1',
  voice: OpenAIVoice = 'alloy',
  format: OpenAIFormat = 'mp3',
  speed: number = 1.0
): Promise<void> {
  try {
    l.dim(`Reading OpenAI script: ${scriptFile}`)
    const script = JSON.parse(await fs.readFile(scriptFile, 'utf8'))
    await ensureDir(outDir)
    await ensureSilenceFile(outDir)
    
    const voiceMapping: Record<string, OpenAIVoice> = {
      DUCO: process.env['OPENAI_VOICE_DUCO'] as OpenAIVoice || 'alloy',
      SEAMUS: process.env['OPENAI_VOICE_SEAMUS'] as OpenAIVoice || 'echo'
    }
    
    l.dim(`Processing ${script.length} lines with OpenAI`)
    let totalCost = 0
    
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      l.dim(`Line ${idx + 1}/${script.length} (${speaker})`)
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const audioOut = path.join(outDir, `${base}.${format === 'pcm' ? 'pcm' : format}`)
      const pcmOut = path.join(outDir, `${base}.pcm`)
      
      const cost = calculateCost(model, text.length)
      totalCost += cost
      
      await synthesizeWithOpenAI(text, audioOut, model, voiceMapping[speaker] || voice, format, speed)
      
      if (format === 'wav') await fs.writeFile(pcmOut, (await fs.readFile(audioOut)).slice(44))
      else if (format !== 'pcm') l.dim('Note: Non-WAV formats require conversion for merging')
      
      l.dim(`Saved ${audioOut}`)
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 500))
    }))
    
    l.dim(`Total cost: $${totalCost.toFixed(6)}`)
    
    if (format === 'wav' || format === 'pcm') {
      l.dim('Merging OpenAI audio files')
      await mergeAudioFiles(outDir)
      await convertPcmToWav(outDir)
      l.dim(`Conversation saved to ${path.join(outDir, 'full_conversation.wav')} 🔊`)
    } else {
      l.dim(`Individual files saved to ${outDir}`)
    }
  } catch (error) {
    err(`Error processing OpenAI script: ${error}`)
  }
}