import { l, err, success } from '@/logging'
import { 
  ensureDir, spawnSync, readFileSync, existsSync, mkdirSync, readFile, writeFile, join, dirname
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils/audio-utils'
import {
  ensureTtsEnvironment, checkCosyVoiceInstalled, runCosyVoiceSetup, checkCosyVoiceDocker, startCosyVoiceDocker
} from '../tts-utils/setup-utils'
import { getUserVoice } from '@/utils'
import type { CosyVoiceOptions, CosyVoiceMode } from '../tts-types'

const VALID_LANGUAGES = ['auto', 'zh', 'en', 'ja', 'ko', 'de', 'es', 'fr', 'it', 'ru']
const VALID_MODES = ['instruct', 'zero_shot', 'cross_lingual']
const DEFAULT_API_URL = 'http://localhost:50000'

const getCosyVoiceConfig = () => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l('Loading config from path', { configPath })
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  
  
  let pythonPath = process.env['TTS_PYTHON_PATH'] || process.env['COSYVOICE_PYTHON_PATH'] || config.python
  
  if (!pythonPath || !existsSync(pythonPath)) {
    l('Python path not configured, checking for environment')
    pythonPath = ensureTtsEnvironment()
  }
  
  l('Using Python path', { pythonPath })
  return { python: pythonPath, ...config.cosyvoice }
}

const verifyCosyVoiceEnvironment = (pythonPath: string): { useDocker: boolean, pythonPath: string } => {
  
  if (checkCosyVoiceDocker()) {
    l('CosyVoice Docker API available')
    return { useDocker: true, pythonPath }
  }
  
  
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) {
    l('Python not accessible, attempting to set up environment')
    const newPythonPath = ensureTtsEnvironment()
    return verifyCosyVoiceEnvironment(newPythonPath)
  }
  
  if (!checkCosyVoiceInstalled(pythonPath)) {
    l('CosyVoice not installed, attempting automatic setup')
    const setupSuccessful = runCosyVoiceSetup()
    if (!setupSuccessful) {
      
      l('Local setup failed, attempting Docker fallback')
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
    err('Invalid mode', { mode, validModes: VALID_MODES.join(', ') })
  }
  
  if (mode === 'zero_shot' && !options.refAudio) {
    err('Zero-shot mode requires --ref-audio for voice cloning')
  }
  
  if (options.language && !VALID_LANGUAGES.includes(options.language)) {
    err('Invalid language', { language: options.language, validLanguages: VALID_LANGUAGES.join(', ') })
  }
}

const synthesizeViaApi = async (
  text: string,
  outputPath: string,
  options: CosyVoiceOptions
): Promise<string> => {
  const apiUrl = options.apiUrl || DEFAULT_API_URL
  const mode = options.mode || 'instruct'
  
  l('Using CosyVoice API', { apiUrl })
  
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
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    
    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
      throw new Error(`CosyVoice API not accessible at ${apiUrl}.

The API server is not running or not reachable.

SOLUTION:
  1. Start the Docker API: docker run -d -p 50000:50000 cosyvoice:latest
  2. Or check if it's running: curl ${apiUrl}/health
  3. Or use local Python mode (requires full setup): remove --cosy-api-url

For easier setup, use Qwen3 TTS instead: --qwen3`)
    }
    
    throw new Error(`CosyVoice API request failed: ${errorMsg}`)
  }
}


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
  
  l('Using mode and language', { mode: modeName, language: languageName })
  
  
  if (useDocker || options.apiUrl) {
    try {
      return await synthesizeViaApi(text, outputPath, {
        ...options,
        mode: modeName as CosyVoiceMode,
        language: languageName,
        apiUrl: options.apiUrl || config.api_url || DEFAULT_API_URL
      })
    } catch (apiError) {
      const errorMsg = apiError instanceof Error ? apiError.message : String(apiError)
      
      
      if (options.apiUrl) {
        err(`CosyVoice API failed: ${errorMsg}`)
      }
      
      l('API mode failed, falling back to local mode', { apiError: errorMsg })
      if (useDocker && !checkCosyVoiceInstalled(pythonPath)) {
        err(`CosyVoice API failed and local installation not available.

${errorMsg}

SOLUTION:
  1. Start the Docker API: docker run -d -p 50000:50000 cosyvoice:latest
  2. Or install locally: bun setup:tts (complex, requires model download)
  3. Or use Qwen3 TTS instead: --qwen3 (simpler, no Docker needed)`)
      }
    }
  }
  
  
  const pythonScriptPath = new URL('cosyvoice-python.py', import.meta.url).pathname
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
  
  l(`Generating speech with CosyVoice TTS`)
  
  const result = spawnSync(pythonPath, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { 
      ...process.env, 
      PYTHONWARNINGS: 'ignore',
      PYTHONPATH: `${cosyvoiceDir}:${join(cosyvoiceDir, 'third_party/Matcha-TTS')}`
    },
    maxBuffer: 1024 * 1024 * 50 
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(errorWithCode.code === 'ENOENT' ? 'Python not found. Run: bun setup:tts' : 'Python execution error',
      { 
        errorCode: errorWithCode.code, 
        message: result.error.message,
        pythonPath,
        scriptPath: pythonScriptPath 
      })
  }
  
  if (result.status !== 0 && !result.stdout) {
    err('CosyVoice Python script failed without output', {
      status: result.status,
      stderr: result.stderr || '(no stderr)',
      stdout: result.stdout || '(no stdout)',
      pythonPath,
      scriptPath: pythonScriptPath
    })
  }
  
  
  const stdout = result.stdout || ''
  const lines = stdout.trim().split('\n')
  const lastLine = lines[lines.length - 1] || ''
  
  try {
    if (!lastLine) {
      err('CosyVoice TTS failed - no output from Python script', { 
        stdout,
        stderr: result.stderr || '(no stderr)',
        status: result.status,
        hint: 'The Python script did not produce any output. Check if the model is properly installed.'
      })
    }
    
    const jsonResult = JSON.parse(lastLine)
    if (!jsonResult.ok) {
      
      const error = jsonResult.error || ''
      if (error.includes('pretrained_models') || error.includes('model not found')) {
        err(`CosyVoice model not found.

The CosyVoice model files are missing or incomplete.

SOLUTION: Download the model:
  1. Create directory: mkdir -p build/cosyvoice/pretrained_models
  2. Download model from: https://www.modelscope.cn/models/iic/Fun-CosyVoice3-0.5B
  
Or use the Docker API instead:
  docker run -d -p 50000:50000 cosyvoice:latest`)
      } else if (error.includes('FileNotFoundError') || error.includes('No such file')) {
        err(`CosyVoice file not found.

Required files are missing.

SOLUTION: 
  1. Ensure model is downloaded: bun setup:tts
  2. Or use Docker API: docker run -d -p 50000:50000 cosyvoice:latest`)
      } else {
        l('CosyVoice error details', { error })
        err('CosyVoice TTS failed', { error })
      }
    }
  } catch (parseError) {
    l('JSON parse error', { parseError, lastLine, stdout })
    
    const stderr = result.stderr || ''
    if (result.status !== 0) {
      if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
        const missingModule = stderr.match(/No module named ['"]([^'"]+)['"]/)?.[1]
        err(`CosyVoice dependency missing${missingModule ? `: ${missingModule}` : ''}.

CosyVoice requires additional Python dependencies.

SOLUTION:
  1. Run full TTS setup: bun setup:tts
  2. Or use Docker (easier): docker run -d -p 50000:50000 cosyvoice:latest
  
Then retry with: --cosyvoice --cosy-api-url http://localhost:50000`)
      } else if (stderr.includes('torch') || stderr.includes('CUDA')) {
        err(`PyTorch or CUDA error.

CosyVoice requires PyTorch with proper device support.

SOLUTION:
  1. Ensure PyTorch is installed: bun setup:tts
  2. For CPU-only inference, this is expected to be slow
  3. Or use Docker: docker run -d -p 50000:50000 cosyvoice:latest`)
      } else if (stderr.includes('pretrained_models') || stderr.includes('checkpoint')) {
        err(`CosyVoice model not found.

The model files are missing from build/cosyvoice/pretrained_models/

SOLUTION:
  1. Download model: bun setup:tts
  2. Or use Docker API: docker run -d -p 50000:50000 cosyvoice:latest
  
Then access via: --cosyvoice --cosy-api-url http://localhost:50000`)
      } else {
        err('CosyVoice TTS failed', { 
          stderr: stderr || '(no stderr)',
          stdout: lines.slice(0, -1).join('\n') || '(no output)',
          hint: 'CosyVoice requires complex setup. Consider using Docker or try Qwen3 TTS (--qwen3) instead.'
        })
      }
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
    
    
    const voiceMapping: Record<string, { instruct?: string, refAudio?: string }> = {}
    const defaultInstructs: Record<string, string> = {
      'DUCO': 'Speak with energy and enthusiasm',
      'SEAMUS': 'Speak in a calm, thoughtful manner',
      'NARRATOR': 'Speak clearly and professionally'
    }
    
    for (const speakerKey of Object.keys(defaultInstructs)) {
      const instruct = getUserVoice('cosyvoice_instruct', speakerKey, defaultInstructs[speakerKey])
      const refAudio = getUserVoice('cosyvoice_ref', speakerKey)
      voiceMapping[speakerKey] = {
        instruct: instruct,
        refAudio: refAudio
      }
    }
    
    l('Processing lines with CosyVoice TTS', { lineCount: script.length })
    
    
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
      
      l('Processing segment', { current: idx + 1, total: script.length, speaker: entrySpeaker })
      
      const speakerConfig = voiceMapping[entrySpeaker] || {}
      
      await synthesizeWithCosyVoice(entryText, wavOut, {
        ...options,
        
        ...(segmentInstruct && { instruct: segmentInstruct }),
        ...(segmentMode && { mode: segmentMode }),
        ...(segmentRefAudio && { refAudio: segmentRefAudio }),
        
        ...(!segmentInstruct && speakerConfig.instruct && { instruct: speakerConfig.instruct }),
        ...(!segmentRefAudio && speakerConfig.refAudio && { refAudio: speakerConfig.refAudio })
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
    err('Error processing CosyVoice TTS script', { error })
  }
}
