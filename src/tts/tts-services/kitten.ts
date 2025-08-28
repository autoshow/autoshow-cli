import { l, err } from '@/logging'
import { 
  ensureDir, fs, path, spawnSync, readFileSync, existsSync, mkdirSync
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils'

const p = '[tts/tts-services/kitten]'

const getKittenConfig = () => {
  const configPath = path.join(process.cwd(), 'config', '.tts-config.json')
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['KITTEN_PYTHON_PATH'] || 
    (existsSync(path.join(process.cwd(), 'pyenv/tts/bin/python')) ? path.join(process.cwd(), 'pyenv/tts/bin/python') : 'python3')
  l.dim(`${p} Using Python path: ${pythonPath}`)
  return { python: pythonPath, ...config.kitten }
}

const verifyKittenEnvironment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) err(`${p} Python not accessible at ${pythonPath}. Run: npm run setup`)
  const checkResult = spawnSync(pythonPath, ['-c', 'import kittentts'], { encoding: 'utf-8', stdio: 'pipe' })
  if (checkResult.status !== 0) err(`${p} Kitten TTS not installed. Run: npm run setup`)
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
  
  const pythonScriptPath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'kitten-python.py')
  
  await ensureDir(path.dirname(outputPath))
  
  const configData = {
    model: modelName,
    voice: voiceName,
    text,
    output: outputPath,
    speed: options.speed || 1.0
  }
  
  l.dim(`${p} Generating speech with model: ${modelName}, voice: ${voiceName}`)
  
  const result = spawnSync(config.python, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { ...process.env, PYTHONWARNINGS: 'ignore' },
    maxBuffer: 1024 * 1024 * 10
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(`${p} ${errorWithCode.code === 'ENOENT' ? 'Python not found. Run: npm run setup' : `Python error: ${result.error.message}`}`)
  }
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    err(`${p} ${stderr.includes('ModuleNotFoundError') ? 'Kitten TTS not installed. Run: npm run setup' :
        stderr.includes('invalid expand shape') ? 'Text too long for Kitten TTS. Try a shorter text or use a different engine.' :
        `Kitten TTS failed: ${stderr}`}`)
  }
  if (!existsSync(outputPath)) err(`${p} Output file missing after synthesis`)
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
    const script = JSON.parse(await fs.readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    const voiceMapping = Object.fromEntries(['DUCO', 'SEAMUS'].map(s => 
      [s, process.env[`KITTEN_VOICE_${s}`] || (s === 'DUCO' ? 'expr-voice-2-m' : 'expr-voice-3-m')]
    ))
    
    l.opts(`${p} Processing ${script.length} lines with Kitten TTS`)
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const wavOut = path.join(outDir, `${base}.wav`)
      const pcmOut = path.join(outDir, `${base}.pcm`)
      
      await synthesizeWithKitten(text, wavOut, {
        ...options,
        voice: voiceMapping[speaker] || 'expr-voice-2-f'
      })
      
      const wavData = await fs.readFile(wavOut)
      await fs.writeFile(pcmOut, wavData.slice(44))
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 100))
    }))
    
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    l.success(`${p} Conversation saved to ${path.join(outDir, 'full_conversation.wav')} 🔊`)
  } catch (error) {
    err(`${p} Error processing Kitten TTS script: ${error}`)
  }
}