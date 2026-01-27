import { l, err, success } from '@/logging'
import { 
  ensureDir, spawnSync, readFileSync, existsSync, mkdirSync, readFile, writeFile, join, dirname
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils/audio-utils'
import {
  ensureTtsEnvironment, checkChatterboxInstalled, runChatterboxSetup
} from '../tts-utils/setup-utils'
import type { ChatterboxOptions, ChatterboxModel } from '../tts-types'

const VALID_MODELS = ['turbo', 'standard', 'multilingual']
const VALID_LANGUAGES = ['ar', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'he', 'hi', 'it', 'ja', 'ko', 'ms', 'nl', 'no', 'pl', 'pt', 'ru', 'sv', 'sw', 'tr', 'zh']

const getChatterboxConfig = () => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l('Loading config from path', { configPath })
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  
  let pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['CHATTERBOX_PYTHON_PATH']
  
  if (!pythonPath || !existsSync(pythonPath)) {
    l('Python path not configured, checking for environment')
    pythonPath = ensureTtsEnvironment()
  }
  
  l('Using Python path', { pythonPath })
  return {
    python: pythonPath,
    default_model: config.chatterbox?.default_model,
    default_exaggeration: config.chatterbox?.default_exaggeration,
    default_cfg_weight: config.chatterbox?.default_cfg_weight,
    default_language: config.chatterbox?.default_language,
    ...config.chatterbox
  }
}

const verifyChatterboxEnvironment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) {
    l('Python not accessible, attempting to set up environment')
    const newPythonPath = ensureTtsEnvironment()
    return verifyChatterboxEnvironment(newPythonPath)
  }
  
  if (!checkChatterboxInstalled(pythonPath)) {
    l('Chatterbox TTS not installed, attempting automatic setup')
    const setupSuccessful = runChatterboxSetup()
    if (!setupSuccessful) {
      err(`Failed to automatically set up Chatterbox TTS. Please run: bun setup:tts`)
    }
    
    if (!checkChatterboxInstalled(pythonPath)) {
      err(`Chatterbox TTS still not available after setup. Please check installation logs.`)
    }
  }
}

const validateOptions = (options: ChatterboxOptions): void => {
  const model = options.model || 'turbo'
  
  if (!VALID_MODELS.includes(model)) {
    err('Invalid model', { model, validModels: VALID_MODELS.join(', ') })
  }
  
  if (model === 'multilingual') {
    if (options.languageId && !VALID_LANGUAGES.includes(options.languageId)) {
      err('Invalid language', { language: options.languageId, validLanguages: VALID_LANGUAGES.join(', ') })
    }
  } else if (options.languageId) {
    err('Language can only be set with the multilingual model')
  }

  if (options.refAudio && !existsSync(options.refAudio)) {
    err('Reference audio not found', { refAudio: options.refAudio })
  }

  if (options.device && !['cpu', 'mps', 'cuda'].includes(options.device)) {
    err('Invalid device', { device: options.device, validDevices: 'cpu, mps, cuda' })
  }

  if (options.dtype && !['float32', 'float16', 'bfloat16'].includes(options.dtype)) {
    err('Invalid dtype', { dtype: options.dtype, validDtypes: 'float32, float16, bfloat16' })
  }
  
  if (options.exaggeration !== undefined && (options.exaggeration < 0 || options.exaggeration > 1)) {
    err('Exaggeration must be between 0.0 and 1.0')
  }
  
  if (options.cfgWeight !== undefined && (options.cfgWeight < 0 || options.cfgWeight > 1)) {
    err('CFG weight must be between 0.0 and 1.0')
  }
}

export async function synthesizeWithChatterbox(
  text: string,
  outputPath: string,
  options: ChatterboxOptions = {}
): Promise<string> {
  const config = getChatterboxConfig()
  verifyChatterboxEnvironment(config.python)
  
  const modelName = options.model || config.default_model || 'turbo'
  const languageId = modelName === 'multilingual'
    ? (options.languageId || config.default_language)
    : options.languageId
  const exaggeration = options.exaggeration ?? config.default_exaggeration
  const cfgWeight = options.cfgWeight ?? config.default_cfg_weight
  
  validateOptions({ ...options, model: modelName as ChatterboxModel, languageId, exaggeration, cfgWeight })
  
  l('Using Chatterbox model', { model: modelName })
  
  const pythonScriptPath = new URL('chatterbox-python.py', import.meta.url).pathname
  
  await ensureDir(dirname(outputPath))
  
  const configData: Record<string, unknown> = {
    model: modelName,
    text,
    output: outputPath
  }
  
  if (options.refAudio) {
    configData['ref_audio'] = options.refAudio
  }
  if (languageId) {
    configData['language_id'] = languageId
  }
  if (options.device) {
    configData['device'] = options.device
  }
  if (options.dtype) {
    configData['dtype'] = options.dtype
  }
  if (modelName === 'standard' && exaggeration !== undefined) {
    configData['exaggeration'] = exaggeration
  }
  if (modelName === 'standard' && cfgWeight !== undefined) {
    configData['cfg_weight'] = cfgWeight
  }
  
  l(`Generating speech with Chatterbox TTS`)
  
  const result = spawnSync(config.python, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { ...process.env, PYTHONWARNINGS: 'ignore' },
    maxBuffer: 1024 * 1024 * 50
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(errorWithCode.code === 'ENOENT' ? 'Python not found. Run: bun setup' : 'Python error', 
      { errorCode: errorWithCode.code, message: result.error.message })
  }
  
  const stdout = result.stdout || ''
  const lines = stdout.trim().split('\n')
  const lastLine = lines[lines.length - 1] || ''
  
  try {
    const jsonResult = JSON.parse(lastLine)
    if (!jsonResult.ok) {
      err('Chatterbox TTS failed', { error: jsonResult.error })
    }
  } catch {
    const stderr = result.stderr || ''
    if (result.status !== 0) {
      if (stderr.includes('ModuleNotFoundError')) {
        err('Chatterbox TTS not installed. Run: bun setup:tts')
      } else if (stderr.includes('torch')) {
        err('PyTorch not installed. Run: bun setup:tts')
      } else if (stderr.includes('CUDA out of memory')) {
        err('GPU out of memory. Try using CPU mode or a smaller model.')
      } else {
        err('Chatterbox TTS failed', { stderr })
      }
    }
  }
  
  if (!existsSync(outputPath)) err(`Output file missing after synthesis`)
  return outputPath
}

export async function processScriptWithChatterbox(
  scriptFile: string,
  outDir: string,
  options: ChatterboxOptions = {}
): Promise<void> {
  try {
    const script = JSON.parse(await readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    // Voice mapping from environment variables (reference audio paths)
    const voiceMapping: Record<string, string> = {}
    for (const speakerKey of ['DUCO', 'SEAMUS', 'NARRATOR']) {
      const envValue = process.env[`CHATTERBOX_VOICE_${speakerKey}`]
      if (envValue) {
        voiceMapping[speakerKey] = envValue
      }
    }
    
    l('Processing lines with Chatterbox TTS', { lineCount: script.length })
    
    for (let idx = 0; idx < script.length; idx++) {
      const entry = script[idx] as { speaker: string; text: string; refAudio?: string }
      const entrySpeaker = entry.speaker
      const entryText = entry.text
      const base = `${String(idx).padStart(3, '0')}_${entrySpeaker}`
      const wavOut = join(outDir, `${base}.wav`)
      const pcmOut = join(outDir, `${base}.pcm`)
      
      l('Processing segment', { current: idx + 1, total: script.length, speaker: entrySpeaker })
      
      await synthesizeWithChatterbox(entryText, wavOut, {
        ...options,
        refAudio: entry.refAudio || voiceMapping[entrySpeaker] || options.refAudio
      })
      
      const wavData = await readFile(wavOut)
      await writeFile(pcmOut, wavData.slice(44))
      
      if (idx < script.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    success('Conversation saved', { outputFile: join(outDir, 'full_conversation.wav') })
  } catch (error) {
    err('Error processing Chatterbox TTS script', { error })
  }
}
