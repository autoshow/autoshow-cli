import { readFileSync } from 'node:fs'
import removeMd from 'remove-markdown'
import { l, err } from '../text/utils/logging.ts'
import { 
  fs, path, spawnSync, existsSync, basename, extname, join
} from '../text/utils/node-utils.ts'
import { synthesizeWithElevenLabs, processScriptWithElevenLabs } from './tts-services/elevenlabs.ts'
import { synthesizeWithOpenAI, processScriptWithOpenAI } from './tts-services/openai.ts'
import { synthesizeWithCoqui, processScriptWithCoqui } from './tts-services/coqui.ts'
import { synthesizeWithPolly, processScriptWithPolly } from './tts-services/polly.ts'

type TtsEngine = 'elevenlabs' | 'openai' | 'coqui' | 'polly'

export const SAMPLE_RATE = 24000
export const CHANNELS = 1
export const BYTES_PER_SAMPLE = 2

export const buildWavHeader = (pcmSize: number): Buffer => {
  const h = Buffer.alloc(44)
  const writeStr = (s: string, o: number) => h.write(s, o)
  const writeInt = (v: number, o: number, b = 4) => b === 4 ? h.writeUInt32LE(v, o) : h.writeUInt16LE(v, o)
  
  writeStr('RIFF', 0), writeInt(36 + pcmSize, 4), writeStr('WAVE', 8), writeStr('fmt ', 12)
  writeInt(16, 16), writeInt(1, 20, 2), writeInt(CHANNELS, 22, 2), writeInt(SAMPLE_RATE, 24)
  writeInt(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28), writeInt(CHANNELS * BYTES_PER_SAMPLE, 32, 2)
  writeInt(8 * BYTES_PER_SAMPLE, 34, 2), writeStr('data', 36), writeInt(pcmSize, 40)
  
  return h
}

export const ensureSilenceFile = async (outDir: string): Promise<void> => {
  const silence = path.join(outDir, 'silence_025.pcm')
  try { 
    await fs.access(silence) 
  } catch {
    await fs.writeFile(silence, Buffer.alloc(SAMPLE_RATE * 0.5 * BYTES_PER_SAMPLE * CHANNELS))
  }
}

export const mergeAudioFiles = async (outDir: string): Promise<void> => {
  const files = await fs.readdir(outDir)
  const pcms = files.filter(f => f.endsWith('.pcm') && f !== 'silence_025.pcm').sort()
  const silence = await fs.readFile(path.join(outDir, 'silence_025.pcm'))
  const buffersNested = await Promise.all(pcms.map(async (pcm, i) => [
    await fs.readFile(path.join(outDir, pcm)),
    ...(i < pcms.length - 1 ? [silence] : [])
  ]))
  const buffers = buffersNested.flat()
  await fs.writeFile(path.join(outDir, 'full_conversation.pcm'), Buffer.concat(buffers))
}

export const convertPcmToWav = async (outDir: string): Promise<void> => {
  const pcmPath = path.join(outDir, 'full_conversation.pcm')
  const pcm = await fs.readFile(pcmPath)
  await fs.writeFile(path.join(outDir, 'full_conversation.wav'), Buffer.concat([buildWavHeader(pcm.length), pcm]))
}

export const detectEngine = (options: any): TtsEngine => {
  const engines = ['elevenlabs', 'openai', 'polly', 'coqui'].find(e => 
    options[e === 'openai' ? 'openaiTts' : e]
  ) || 'coqui'
  l.dim(`Using ${engines} engine${engines === 'coqui' ? ' (default)' : ''}`)
  return engines as TtsEngine
}

export const listModels = async (): Promise<void> => {
  l.dim('Fetching available Coqui TTS models')
  
  const configPath = path.join(process.cwd(), '.tts-config.json')
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['COQUI_PYTHON_PATH'] || 
    (existsSync(path.join(process.cwd(), 'python_env/bin/python')) ? path.join(process.cwd(), 'python_env/bin/python') : 'python3')
  
  l.dim(`Using Python: ${pythonPath}`)
  
  const pythonScriptPath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'tts-services/coqui-list.py')
  l.dim(`Using Python script: ${pythonScriptPath}`)
  
  const result = spawnSync(pythonPath, [pythonScriptPath], { 
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONWARNINGS: 'ignore', TF_CPP_MIN_LOG_LEVEL: '3' }
  })
  
  if (result.error) {
    err(`Failed to execute Python: ${result.error.message}`)
  }
  
  if (result.status !== 0) {
    l.dim(`stderr: ${result.stderr}`)
    err(`Failed to list models: ${result.stderr || 'Unknown error'}`)
  }
  
  const output = result.stdout
  
  if (output.includes('ERROR:')) {
    const errorMatch = output.match(/ERROR: (.+)/)
    err(`Error loading TTS: ${errorMatch ? errorMatch[1] : 'Unknown error'}`)
  }
  
  const startIdx = output.indexOf('MODELS_START:')
  const endIdx = output.indexOf('MODELS_END')
  
  if (startIdx === -1 || endIdx === -1) {
    l.dim('Attempting alternative method using CLI')
    
    const cliResult = spawnSync(pythonPath, ['-m', 'TTS', '--list_models'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONWARNINGS: 'ignore' }
    })
    
    if (cliResult.status === 0 && cliResult.stdout) {
      const cliOutput = cliResult.stdout
      const lines = cliOutput.split('\n')
        .filter(line => 
          line.trim() && 
          line.includes('/') &&
          !line.includes('UserWarning') &&
          !line.includes('DeprecationWarning')
        )
      
      if (lines.length > 0) {
        l.dim('Available Coqui TTS models:')
        
        const modelsByCategory = lines.reduce((acc, model) => {
          const trimmedModel = model.trim()
          const parts = trimmedModel.split('/')
          if (parts.length >= 3) {
            const category = `${parts[0]}/${parts[1]}`
            if (!acc[category]) acc[category] = []
            acc[category].push(trimmedModel)
          }
          return acc
        }, {} as Record<string, string[]>)
        
        Object.entries(modelsByCategory)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([category, models]) => {
            console.log(`\n  ${category}:`)
            models.sort().forEach(model => {
              const modelName = model.split('/').slice(2).join('/')
              console.log(`    - ${modelName}`)
            })
          })
        
        l.dim('Use a model with: npm run as -- tts file input.md --coqui-model "model_name"')
        l.dim('Example: npm run as -- tts file input.md --coqui-model "tts_models/en/ljspeech/tacotron2-DDC"')
        return
      }
    }
    
    err('Failed to parse model list. Coqui TTS may not be properly installed.')
  }
  
  const modelsSection = output.substring(startIdx, endIdx)
  const modelCountMatch = modelsSection.match(/MODELS_START:(\d+)/)
  const modelCount = parseInt(modelCountMatch?.[1] ?? '0')
  
  l.dim(`Found ${modelCount} models`)
  
  const lines = modelsSection.split('\n')
    .slice(1)
    .filter(line => line.trim() && !line.includes('MODELS_START'))
    .map(line => line.trim())
  
  if (lines.length === 0) {
    err('No models found. Coqui TTS may not be properly installed or initialized.')
  }
  
  l.dim('Available Coqui TTS models:')
  
  const modelsByCategory = lines.reduce((acc, model) => {
    const parts = model.split('/')
    if (parts.length >= 3) {
      const category = `${parts[0]}/${parts[1]}`
      if (!acc[category]) acc[category] = []
      acc[category].push(model)
    } else {
      if (!acc['other']) acc['other'] = []
      acc['other'].push(model)
    }
    return acc
  }, {} as Record<string, string[]>)
  
  Object.entries(modelsByCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, models]) => {
      console.log(`\n  ${category}:`)
      models.sort().forEach(model => {
        const modelName = model.split('/').slice(2).join('/')
        console.log(`    - ${modelName || model}`)
      })
    })
  
  l.dim('Use a model with: npm run as -- tts file input.md --coqui-model "model_name"')
  l.dim('Example: npm run as -- tts file input.md --coqui-model "tts_models/en/ljspeech/tacotron2-DDC"')
}

export const stripMarkdown = (file: string): string => {
  l.dim(`Stripping markdown from ${file}`)
  const plain = removeMd(readFileSync(file, 'utf8').trim()).replace(/\s+/g, ' ').trim()
  l.dim(`plain text length=${plain.length}`)
  if (!plain) err('No narratable text after stripping Markdown')
  return plain
}

const synthesizers = {
  elevenlabs: async (plain: string, out: string, opts: any) => 
    synthesizeWithElevenLabs(plain, out, opts.voice || process.env['ELEVENLABS_DEFAULT_VOICE'] || 'onwK4e9ZLuTAKqWW03F9'),
  openai: async (plain: string, _: string, opts: any) => 
    synthesizeWithOpenAI(plain, join(opts.outDir, basename(opts.filePath, extname(opts.filePath)) + '.' + (opts.outputFormat || 'mp3')), 
      opts.openaiModel || 'tts-1', opts.voice || 'alloy', opts.outputFormat || 'mp3', opts.speed || 1.0, opts.instructions),
  coqui: async (plain: string, out: string, opts: any) => 
    synthesizeWithCoqui(plain, out, { model: opts.coquiModel, speaker: opts.speaker, speakerWav: opts.voiceClone, language: opts.language, speed: opts.speed }),
  polly: async (plain: string, _: string, opts: any) => 
    synthesizeWithPolly(plain, join(opts.outDir, basename(opts.filePath, extname(opts.filePath)) + '.' + (opts.pollyFormat || 'mp3')), 
      { voice: opts.voice, format: opts.pollyFormat || 'mp3', sampleRate: opts.pollySampleRate, engine: opts.pollyEngine, languageCode: opts.language })
}

export const processFileWithEngine = async (engine: TtsEngine, filePath: string, outDir: string, options: any): Promise<void> => {
  l.dim(`Processing file with ${engine} engine`)
  const plain = stripMarkdown(filePath)
  const wavOut = join(outDir, basename(filePath, extname(filePath)) + '.wav')
  const synth = synthesizers[engine]
  if (!synth) err(`Unknown engine: ${engine}`)
  l.dim(`Synthesising → ${engine === 'openai' || engine === 'polly' ? outDir : wavOut}`)
  await synth(plain, wavOut, { ...options, outDir, filePath })
}

const scriptProcessors = {
  elevenlabs: processScriptWithElevenLabs,
  openai: async (s: string, o: string, opts: any) => 
    processScriptWithOpenAI(s, o, opts.openaiModel || 'tts-1', opts.voice || 'alloy', opts.outputFormat || 'mp3', opts.speed || 1.0),
  coqui: async (s: string, o: string, opts: any) => 
    processScriptWithCoqui(s, o, { model: opts.coquiModel, language: opts.language, speed: opts.speed }),
  polly: async (s: string, o: string, opts: any) => 
    processScriptWithPolly(s, o, { voice: opts.voice, format: opts.pollyFormat, sampleRate: opts.pollySampleRate, engine: opts.pollyEngine, languageCode: opts.language })
}

export const processScriptWithEngine = async (engine: TtsEngine, scriptPath: string, outDir: string, options: any): Promise<void> => {
  l.dim(`Processing script with ${engine} engine`)
  const processor = scriptProcessors[engine]
  if (!processor) err(`Unknown engine: ${engine}`)
  await processor(scriptPath, outDir, options)
}

export const downloadModel = async (_modelId: string): Promise<boolean> => {
  l.dim('Model download not applicable for current TTS engines')
  return true
}