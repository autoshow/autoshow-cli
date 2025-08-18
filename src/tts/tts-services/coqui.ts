import { l, err } from '@/logging'
import { 
  ensureDir, fs, path, spawnSync, readFileSync, existsSync, mkdirSync
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils'

const p = '[tts/tts-services/coqui]'

const getCoquiConfig = () => {
  const configPath = path.join(process.cwd(), '.tts-config.json')
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['COQUI_PYTHON_PATH'] || 
    (existsSync(path.join(process.cwd(), 'python_env/bin/python')) ? path.join(process.cwd(), 'python_env/bin/python') : 'python3')
  return { python: pythonPath, ...config.coqui }
}

const verifyCoquiEnvironment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) err(`${p} Python not accessible at ${pythonPath}. Run: npm run setup`)
  const checkResult = spawnSync(pythonPath, ['-c', 'import TTS'], { encoding: 'utf-8', stdio: 'pipe' })
  if (checkResult.status !== 0) err(`${p} Coqui TTS not installed. Run: npm run setup`)
}

export async function synthesizeWithCoqui(
  text: string,
  outputPath: string,
  options: {
    model?: string
    speaker?: string
    speakerWav?: string
    language?: string
    speed?: number
    emotionWav?: string
    capacitronStyle?: string
  } = {}
): Promise<string> {
  const config = getCoquiConfig()
  verifyCoquiEnvironment(config.python)
  
  const modelName = options.model || config.default_model || 'tts_models/en/ljspeech/tacotron2-DDC'
  
  const pythonScriptPath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'coqui-python.py')
  
  await ensureDir(path.dirname(outputPath))
  
  const cleanedOptions = Object.fromEntries(
    Object.entries(options).filter(([_, value]) => value !== undefined)
  )
  
  const configData = {
    ...cleanedOptions,
    model: modelName,
    text,
    output: outputPath,
    speaker_wav: options.speakerWav,
  }
  
  const result = spawnSync(config.python, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { ...process.env, PYTHONWARNINGS: 'ignore' }
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(`${p} ${errorWithCode.code === 'ENOENT' ? 'Python not found. Run: npm run setup' : `Python error: ${result.error.message}`}`)
  }
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    err(`${p} ${stderr.includes('ModuleNotFoundError') ? 'Coqui TTS not installed. Run: npm run setup' :
        stderr.includes('torch') ? 'PyTorch not installed. Run: npm run setup' :
        `Coqui TTS failed: ${stderr}`}`)
  }
  if (!existsSync(outputPath)) err(`${p} Output file missing after synthesis`)
  return outputPath
}

export async function processScriptWithCoqui(
  scriptFile: string,
  outDir: string,
  options: {
    model?: string
    language?: string
    speed?: number
  } = {}
): Promise<void> {
  try {
    const script = JSON.parse(await fs.readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    const voiceSamples = Object.fromEntries(['DUCO', 'SEAMUS'].map(s => [s, process.env[`COQUI_VOICE_${s}`] || '']))
    const speakers = Object.fromEntries(['DUCO', 'SEAMUS'].map(s => [s, process.env[`COQUI_SPEAKER_${s}`] || '']))
    
    l.opts(`${p} Processing ${script.length} lines with Coqui`)
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const wavOut = path.join(outDir, `${base}.wav`)
      const pcmOut = path.join(outDir, `${base}.pcm`)
      
      await synthesizeWithCoqui(text, wavOut, {
        ...options,
        ...(voiceSamples[speaker] && existsSync(voiceSamples[speaker]) ? { speakerWav: voiceSamples[speaker] } :
            speakers[speaker] ? { speaker: speakers[speaker] } : {})
      })
      
      const wavData = await fs.readFile(wavOut)
      await fs.writeFile(pcmOut, wavData.slice(44))
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 500))
    }))
    
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    l.success(`${p} Conversation saved to ${path.join(outDir, 'full_conversation.wav')} 🔊`)
  } catch (error) {
    err(`${p} Error processing Coqui script: ${error}`)
  }
}