import { l, err, success } from '@/logging'
import { 
  ensureDir, spawnSync, readFileSync, existsSync, mkdirSync, readFile, writeFile, join, dirname
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils/audio-utils'
import {
  ensureTtsEnvironment, checkQwen3Installed, runQwen3Setup
} from '../tts-utils/setup-utils'
import { getUserVoice } from '@/utils'
import type { Qwen3Options, Qwen3Mode } from '../tts-types'

const VALID_SPEAKERS = ['Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Ono_Anna', 'Sohee']
const VALID_LANGUAGES = ['Auto', 'Chinese', 'English', 'Japanese', 'Korean', 'German', 'French', 'Russian', 'Portuguese', 'Spanish', 'Italian']

const getQwen3Config = () => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l('Loading config from path', { configPath })
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  
  
  let pythonPath = process.env['TTS_PYTHON_PATH'] || process.env['QWEN3_PYTHON_PATH'] || config.python
  
  if (!pythonPath || !existsSync(pythonPath)) {
    l('Python path not configured, checking for environment')
    pythonPath = ensureTtsEnvironment()
  }
  
  l('Using Python path', { pythonPath })
  return { python: pythonPath, ...config.qwen3 }
}

const verifyQwen3Environment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) {
    l('Python not accessible, attempting to set up environment')
    const newPythonPath = ensureTtsEnvironment()
    return verifyQwen3Environment(newPythonPath)
  }
  
  if (!checkQwen3Installed(pythonPath)) {
    l('Qwen3 TTS not installed, attempting automatic setup')
    const setupSuccessful = runQwen3Setup()
    if (!setupSuccessful) {
      err(`Failed to automatically set up Qwen3 TTS. Please run: bun setup:tts`)
    }
    
    if (!checkQwen3Installed(pythonPath)) {
      err(`Qwen3 TTS still not available after setup. Please check installation logs.`)
    }
  }
}

const validateModeModelCompatibility = (mode: Qwen3Mode, model: string): void => {
  if (mode === 'custom' && !model.includes('CustomVoice')) {
    err('Mode custom requires a CustomVoice model', { mode, model })
  }
  if (mode === 'design' && !model.includes('VoiceDesign')) {
    err('Mode design requires a VoiceDesign model', { mode, model })
  }
  if (mode === 'clone' && !model.includes('Base')) {
    err('Mode clone requires a Base model', { mode, model })
  }
}

const validateOptions = (options: Qwen3Options): void => {
  const mode = options.mode || 'custom'
  const model = options.model || 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice'
  
  validateModeModelCompatibility(mode, model)
  
  if (mode === 'design' && !options.instruct) {
    err('Voice design mode requires --qwen3-instruct')
  }
  
  if (mode === 'clone' && !options.refAudio) {
    err('Voice clone mode requires --ref-audio')
  }
  
  if (options.speaker && !VALID_SPEAKERS.includes(options.speaker)) {
    err('Invalid speaker', { speaker: options.speaker, validSpeakers: VALID_SPEAKERS.join(', ') })
  }
  
  if (options.language && !VALID_LANGUAGES.includes(options.language)) {
    err('Invalid language', { language: options.language, validLanguages: VALID_LANGUAGES.join(', ') })
  }
}

export async function synthesizeWithQwen3(
  text: string,
  outputPath: string,
  options: Qwen3Options = {}
): Promise<string> {
  const config = getQwen3Config()
  verifyQwen3Environment(config.python)
  
  const modelName = options.model || config.default_model || 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice'
  const speakerName = options.speaker || config.default_speaker || 'Vivian'
  const languageName = options.language || config.default_language || 'Auto'
  const modeName = options.mode || config.default_mode || 'custom'
  
  validateOptions({ ...options, model: modelName, speaker: speakerName, language: languageName, mode: modeName })
  
  l('Using Qwen3 configuration', { model: modelName, speaker: speakerName, language: languageName, mode: modeName })
  
  const pythonScriptPath = join(dirname(import.meta.url.replace('file://', '')), 'qwen3-python.py')
  
  await ensureDir(dirname(outputPath))
  
  const configData: Record<string, unknown> = {
    model: modelName,
    speaker: speakerName,
    language: languageName,
    mode: modeName,
    text,
    output: outputPath,
    speed: options.speed || 1.0,
    max_chunk: options.maxChunk || 500
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
  
  l(`Generating speech with Qwen3 TTS`)
  
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
      err('Qwen3 TTS failed', { error: jsonResult.error })
    }
  } catch {
    
    const stderr = result.stderr || ''
    if (result.status !== 0) {
      if (stderr.includes('ModuleNotFoundError')) {
        err('Qwen3 TTS not installed. Run: bun setup:tts')
      } else if (stderr.includes('torch')) {
        err('PyTorch not installed. Run: bun setup:tts')
      } else if (stderr.includes('CUDA out of memory')) {
        err('GPU out of memory. Try using CPU mode or a smaller model.')
      } else {
        err('Qwen3 TTS failed', { stderr })
      }
    }
  }
  
  if (!existsSync(outputPath)) err(`Output file missing after synthesis`)
  return outputPath
}

export async function processScriptWithQwen3(
  scriptFile: string,
  outDir: string,
  options: Qwen3Options = {}
): Promise<void> {
  try {
    const script = JSON.parse(await readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    
    const voiceMapping: Record<string, string> = {}
    const defaultVoices: Record<string, string> = {
      'DUCO': 'Ryan',
      'SEAMUS': 'Aiden',
      'NARRATOR': 'Vivian'
    }
    
    for (const speakerKey of Object.keys(defaultVoices)) {
      voiceMapping[speakerKey] = getUserVoice('qwen3', speakerKey, defaultVoices[speakerKey]) as string
    }
    
    l('Processing lines with Qwen3 TTS', { lineCount: script.length })
    
    
    for (let idx = 0; idx < script.length; idx++) {
      const entry = script[idx] as { speaker: string; text: string; instruct?: string; mode?: Qwen3Mode }
      const entrySpeaker = entry.speaker
      const entryText = entry.text
      const segmentInstruct = entry.instruct
      const segmentMode = entry.mode
      const base = `${String(idx).padStart(3, '0')}_${entrySpeaker}`
      const wavOut = join(outDir, `${base}.wav`)
      const pcmOut = join(outDir, `${base}.pcm`)
      
      l('Processing segment', { current: idx + 1, total: script.length, speaker: entrySpeaker })
      
      await synthesizeWithQwen3(entryText, wavOut, {
        ...options,
        speaker: voiceMapping[entrySpeaker] || options.speaker || 'Vivian',
        
        ...(segmentInstruct && { instruct: segmentInstruct }),
        ...(segmentMode && { mode: segmentMode })
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
    err('Error processing Qwen3 TTS script', { error })
  }
}
