import { l, err, success } from '@/logging'
import { 
  ensureDir, spawnSync, readFileSync, existsSync, mkdirSync, readFile, writeFile, join, dirname
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils/audio-utils'
import {
  ensureTtsEnvironment, checkKittenInstalled, runKittenSetup
} from '../tts-utils/setup-utils'

const getKittenConfig = () => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l('Loading config from path', { configPath })
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  
  let pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['KITTEN_PYTHON_PATH']
  
  if (!pythonPath || !existsSync(pythonPath)) {
    l('Python path not configured, checking for environment')
    pythonPath = ensureTtsEnvironment()
  }
  
  l('Using Python path', { pythonPath })
  return { python: pythonPath, ...config.kitten }
}

const verifyKittenEnvironment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) {
    l('Python not accessible, attempting to set up environment')
    const newPythonPath = ensureTtsEnvironment()
    return verifyKittenEnvironment(newPythonPath)
  }
  
  if (!checkKittenInstalled(pythonPath)) {
    l('Kitten TTS not installed, attempting automatic setup')
    const setupSuccessful = runKittenSetup()
    if (!setupSuccessful) {
      err(`Failed to automatically set up Kitten TTS. Please run: bun setup:tts`)
    }
    
    if (!checkKittenInstalled(pythonPath)) {
      err(`Kitten TTS still not available after setup. Please check installation logs.`)
    }
  }
}

export async function synthesizeWithKitten(
  text: string,
  outputPath: string,
  options: {
    model?: string
    voice?: string
    speed?: number
  } = {}
): Promise<string> {
  const config = getKittenConfig()
  verifyKittenEnvironment(config.python)
  
  const modelName = options.model || config.default_model || 'KittenML/kitten-tts-nano-0.1'
  const voiceName = options.voice || config.default_voice || 'expr-voice-2-f'
  l('Using model and voice', { model: modelName, voice: voiceName })
  
  const pythonScriptPath = join(dirname(import.meta.url.replace('file://', '')), 'kitten-python.py')
  
  await ensureDir(dirname(outputPath))
  
  const configData = {
    model: modelName,
    voice: voiceName,
    text,
    output: outputPath,
    speed: options.speed || 1.0
  }
  
  l('Generating speech with model and voice', { model: modelName, voice: voiceName })
  
  const result = spawnSync(config.python, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { ...process.env, PYTHONWARNINGS: 'ignore' },
    maxBuffer: 1024 * 1024 * 10
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(errorWithCode.code === 'ENOENT' ? 'Python not found. Run: bun setup' : 'Python error',
      { errorCode: errorWithCode.code, message: result.error.message })
  }
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    if (stderr.includes('ModuleNotFoundError')) {
      err('Kitten TTS not installed. Run: bun setup')
    } else if (stderr.includes('invalid expand shape')) {
      err('Text too long for Kitten TTS. Try a shorter text or use a different engine.')
    } else {
      err('Kitten TTS failed', { stderr })
    }
  }
  if (!existsSync(outputPath)) err(`Output file missing after synthesis`)
  return outputPath
}

export async function processScriptWithKitten(
  scriptFile: string,
  outDir: string,
  options: {
    model?: string
    speed?: number
  } = {}
): Promise<void> {
  try {
    const script = JSON.parse(await readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    const voiceMapping = Object.fromEntries(['DUCO', 'SEAMUS'].map(s => 
      [s, process.env[`KITTEN_VOICE_${s}`] || (s === 'DUCO' ? 'expr-voice-2-m' : 'expr-voice-3-m')]
    ))
    
    l('Processing lines with Kitten TTS', { lineCount: script.length })
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const wavOut = join(outDir, `${base}.wav`)
      const pcmOut = join(outDir, `${base}.pcm`)
      
      await synthesizeWithKitten(text, wavOut, {
        ...options,
        voice: voiceMapping[speaker] || 'expr-voice-2-f'
      })
      
      const wavData = await readFile(wavOut)
      await writeFile(pcmOut, wavData.slice(44))
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 100))
    }))
    
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    success('Conversation saved', { outputFile: join(outDir, 'full_conversation.wav') })
  } catch (error) {
    err('Error processing Kitten TTS script', { error })
  }
}