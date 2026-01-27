import { l, err } from '@/logging'
import { 
  ensureDir, spawnSync, readFileSync, existsSync, mkdirSync, readFile, writeFile, join, dirname
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils/audio-utils'
import {
  ensureTtsEnvironment, checkCosyVoiceInstalled, runCosyVoiceSetup, checkCosyVoiceDocker, startCosyVoiceDocker
} from '../tts-utils/setup-utils'
import type { CosyVoiceOptions, CosyVoiceMode } from '../tts-types'

const VALID_LANGUAGES = ['auto', 'zh', 'en', 'ja', 'ko', 'de', 'es', 'fr', 'it', 'ru']
const VALID_MODES = ['instruct', 'zero_shot', 'cross_lingual']
const DEFAULT_API_URL = 'http://localhost:50000'

const getCosyVoiceConfig = () => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l.dim(`Loading config from: ${configPath}`)
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  
  let pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['COSYVOICE_PYTHON_PATH']
  
  if (!pythonPath || !existsSync(pythonPath)) {
    l.dim(`Python path not configured, checking for environment...`)
    pythonPath = ensureTtsEnvironment()
  }
  
  l.dim(`Using Python path: ${pythonPath}`)
  return { python: pythonPath, ...config.cosyvoice }
}

const verifyCosyVoiceEnvironment = (pythonPath: string): { useDocker: boolean, pythonPath: string } => {
  // First check if Docker API is available
  if (checkCosyVoiceDocker()) {
    l.dim(`CosyVoice Docker API available`)
    return { useDocker: true, pythonPath }
  }
  
  // Check local Python environment
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) {
    l.dim(`Python not accessible, attempting to set up environment...`)
    const newPythonPath = ensureTtsEnvironment()
    return verifyCosyVoiceEnvironment(newPythonPath)
  }
  
  if (!checkCosyVoiceInstalled(pythonPath)) {
    l.dim(`CosyVoice not installed, attempting automatic setup...`)
    const setupSuccessful = runCosyVoiceSetup()
    if (!setupSuccessful) {
      // Try starting Docker as fallback
      l.dim(`Local setup failed, attempting Docker fallback...`)
      if (startCosyVoiceDocker()) {
        return { useDocker: true, pythonPath }
      }
      err(`Failed to set up CosyVoice. Please run: bun setup:tts`)
    }
    
    if (!checkCosyVoiceInstalled(pythonPath)) {
      err(`CosyVoice still not available after setup. Please check installation logs.`)
    }
  }
  
  return { useDocker: false, pythonPath }
}

const validateOptions = (options: CosyVoiceOptions): void => {
  const mode = options.mode || 'instruct'
  
  if (!VALID_MODES.includes(mode)) {
    err(`Invalid mode: ${mode}. Valid modes: ${VALID_MODES.join(', ')}`)
  }
  
  if (mode === 'zero_shot' && !options.refAudio) {
    err(`Zero-shot mode requires --ref-audio for voice cloning`)
  }
  
  if (options.language && !VALID_LANGUAGES.includes(options.language)) {
    err(`Invalid language: ${options.language}. Valid languages: ${VALID_LANGUAGES.join(', ')}`)
  }
}

const synthesizeViaApi = async (
  text: string,
  outputPath: string,
  options: CosyVoiceOptions
): Promise<string> => {
  const apiUrl = options.apiUrl || DEFAULT_API_URL
  const mode = options.mode || 'instruct'
  
  l.dim(`Using CosyVoice API at: ${apiUrl}`)
  
  const formData = new FormData()
  formData.append('tts_text', text)
  formData.append('mode', mode)
  
  if (options.language && options.language !== 'auto') {
    formData.append('language', options.language)
  }
  
  if (options.instruct) {
    formData.append('instruct_text', options.instruct)
  }
  
  if (options.refAudio && existsSync(options.refAudio)) {
    const audioBuffer = readFileSync(options.refAudio)
    const blob = new Blob([audioBuffer], { type: 'audio/wav' })
    formData.append('prompt_wav', blob, 'prompt.wav')
    
    if (options.refText) {
      formData.append('prompt_text', options.refText)
    }
  }
  
  const endpoint = mode === 'instruct' ? '/inference_instruct2' :
                   mode === 'zero_shot' ? '/inference_zero_shot' :
                   '/inference_cross_lingual'
  
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} - ${errorText}`)
    }
    
    const audioBuffer = await response.arrayBuffer()
    await ensureDir(dirname(outputPath))
    writeFileSync(outputPath, Buffer.from(audioBuffer))
    
    return outputPath
  } catch (error) {
    throw new Error(`CosyVoice API request failed: ${error}`)
  }
}

// Import writeFileSync for API mode
import { writeFileSync } from 'node:fs'

export async function synthesizeWithCosyVoice(
  text: string,
  outputPath: string,
  options: CosyVoiceOptions = {}
): Promise<string> {
  const config = getCosyVoiceConfig()
  const { useDocker, pythonPath } = verifyCosyVoiceEnvironment(config.python)
  
  const modeName = options.mode || config.default_mode || 'instruct'
  const languageName = options.language || config.default_language || 'auto'
  
  validateOptions({ ...options, mode: modeName as CosyVoiceMode, language: languageName })
  
  l.dim(`Using mode: ${modeName}, language: ${languageName}`)
  
  // Try Docker API first if available
  if (useDocker || options.apiUrl) {
    try {
      return await synthesizeViaApi(text, outputPath, {
        ...options,
        mode: modeName as CosyVoiceMode,
        language: languageName,
        apiUrl: options.apiUrl || config.api_url || DEFAULT_API_URL
      })
    } catch (apiError) {
      l.dim(`API mode failed: ${apiError}, falling back to local mode...`)
      if (useDocker && !checkCosyVoiceInstalled(pythonPath)) {
        err(`CosyVoice API failed and local installation not available: ${apiError}`)
      }
    }
  }
  
  // Local Python mode
  const pythonScriptPath = join(dirname(import.meta.url.replace('file://', '')), 'cosyvoice-python.py')
  const cosyvoiceDir = config.model_dir || join(process.cwd(), 'build/cosyvoice')
  
  await ensureDir(dirname(outputPath))
  
  const configData: Record<string, unknown> = {
    mode: modeName,
    language: languageName,
    text,
    output: outputPath,
    cosyvoice_dir: cosyvoiceDir,
    stream: options.stream || false
  }
  
  if (options.instruct) {
    configData['instruct'] = options.instruct
  }
  if (options.refAudio) {
    configData['ref_audio'] = options.refAudio
  }
  if (options.refText) {
    configData['ref_text'] = options.refText
  }
  
  l.dim(`Generating speech with CosyVoice TTS`)
  
  const result = spawnSync(pythonPath, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { 
      ...process.env, 
      PYTHONWARNINGS: 'ignore',
      PYTHONPATH: join(cosyvoiceDir, 'third_party/Matcha-TTS')
    },
    maxBuffer: 1024 * 1024 * 50 // 50MB buffer for large model outputs
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(`${errorWithCode.code === 'ENOENT' ? 'Python not found. Run: bun setup' : `Python error: ${result.error.message}`}`)
  }
  
  // Parse stdout for JSON result
  const stdout = result.stdout || ''
  const lines = stdout.trim().split('\n')
  const lastLine = lines[lines.length - 1] || ''
  
  try {
    const jsonResult = JSON.parse(lastLine)
    if (!jsonResult.ok) {
      err(`CosyVoice TTS failed: ${jsonResult.error}`)
    }
  } catch {
    // If we can't parse JSON, check for errors in stderr
    const stderr = result.stderr || ''
    if (result.status !== 0) {
      err(`${stderr.includes('ModuleNotFoundError') ? 'CosyVoice not installed. Run: bun setup:tts' :
          stderr.includes('torch') ? 'PyTorch not installed. Run: bun setup:tts' :
          `CosyVoice TTS failed: ${stderr}`}`)
    }
  }
  
  if (!existsSync(outputPath)) err(`Output file missing after synthesis`)
  return outputPath
}

export async function processScriptWithCosyVoice(
  scriptFile: string,
  outDir: string,
  options: CosyVoiceOptions = {}
): Promise<void> {
  try {
    const script = JSON.parse(await readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    // Voice mapping from environment variables
    const voiceMapping: Record<string, { instruct?: string, refAudio?: string }> = {}
    const defaultInstructs: Record<string, string> = {
      'DUCO': 'Speak with energy and enthusiasm',
      'SEAMUS': 'Speak in a calm, thoughtful manner',
      'NARRATOR': 'Speak clearly and professionally'
    }
    
    for (const speakerKey of Object.keys(defaultInstructs)) {
      const envInstruct = process.env[`COSYVOICE_INSTRUCT_${speakerKey}`]
      const envRefAudio = process.env[`COSYVOICE_REF_${speakerKey}`]
      voiceMapping[speakerKey] = {
        instruct: envInstruct || defaultInstructs[speakerKey],
        refAudio: envRefAudio
      }
    }
    
    l.opts(`Processing ${script.length} lines with CosyVoice TTS`)
    
    // Process sequentially to avoid memory issues
    for (let idx = 0; idx < script.length; idx++) {
      const entry = script[idx] as { speaker: string; text: string; instruct?: string; mode?: CosyVoiceMode; refAudio?: string }
      const entrySpeaker = entry.speaker
      const entryText = entry.text
      const segmentInstruct = entry.instruct
      const segmentMode = entry.mode
      const segmentRefAudio = entry.refAudio
      const base = `${String(idx).padStart(3, '0')}_${entrySpeaker}`
      const wavOut = join(outDir, `${base}.wav`)
      const pcmOut = join(outDir, `${base}.pcm`)
      
      l.dim(`Processing segment ${idx + 1}/${script.length}: ${entrySpeaker}`)
      
      const speakerConfig = voiceMapping[entrySpeaker] || {}
      
      await synthesizeWithCosyVoice(entryText, wavOut, {
        ...options,
        // Segment-level overrides
        ...(segmentInstruct && { instruct: segmentInstruct }),
        ...(segmentMode && { mode: segmentMode }),
        ...(segmentRefAudio && { refAudio: segmentRefAudio }),
        // Speaker defaults from env
        ...(!segmentInstruct && speakerConfig.instruct && { instruct: speakerConfig.instruct }),
        ...(!segmentRefAudio && speakerConfig.refAudio && { refAudio: speakerConfig.refAudio })
      })
      
      const wavData = await readFile(wavOut)
      await writeFile(pcmOut, wavData.slice(44))
      
      // Small delay between segments
      if (idx < script.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    l.success(`Conversation saved to ${join(outDir, 'full_conversation.wav')}`)
  } catch (error) {
    err(`Error processing CosyVoice TTS script: ${error}`)
  }
}
