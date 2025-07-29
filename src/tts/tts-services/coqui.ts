import { l, err } from '../../logging.ts'
import { 
  ensureDir, fs, path, spawnSync, readFileSync, existsSync, mkdirSync
} from '../../node-utils.ts'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils'

const getCoquiConfig = () => {
  l.dim('Loading Coqui configuration')
  const configPath = path.join(process.cwd(), '.tts-config.json')
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['COQUI_PYTHON_PATH'] || 
    (existsSync(path.join(process.cwd(), 'python_env/bin/python')) ? path.join(process.cwd(), 'python_env/bin/python') : 'python3')
  l.dim(`Using Python: ${pythonPath}`)
  return { python: pythonPath, ...config.coqui }
}

const verifyCoquiEnvironment = (pythonPath: string) => {
  l.dim(`Checking Coqui at: ${pythonPath}`)
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) err(`Python not accessible at ${pythonPath}. Run: npm run setup`)
  l.dim(`Python: ${versionResult.stdout.trim()}`)
  const checkResult = spawnSync(pythonPath, ['-c', 'import TTS'], { encoding: 'utf-8', stdio: 'pipe' })
  if (checkResult.status !== 0) err('Coqui TTS not installed. Run: npm run setup')
  l.dim('Coqui TTS available')
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
  l.dim(`Starting Coqui synthesis (${text.length} chars)`)
  const config = getCoquiConfig()
  verifyCoquiEnvironment(config.python)
  
  const modelName = options.model || config.default_model || 'tts_models/en/ljspeech/tacotron2-DDC'
  const isXtts = modelName.includes('xtts')
  l.dim(`Model: ${modelName}${isXtts && options.speakerWav ? ', voice cloning' : ''}`)
  
  const pythonScriptPath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'coqui-python.py')
  l.dim(`Using Python script: ${pythonScriptPath}`)
  
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
  
  l.dim(`Config data: ${JSON.stringify({ model: configData.model, outputPath: configData.output, hasText: !!configData.text })}`)
  
  const result = spawnSync(config.python, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { ...process.env, PYTHONWARNINGS: 'ignore' }
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(errorWithCode.code === 'ENOENT' ? 'Python not found. Run: npm run setup' : `Python error: ${result.error.message}`)
  }
  if (result.stdout) result.stdout.split('\n').filter(line => line.trim()).forEach(line => l.dim(line))
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    err(stderr.includes('ModuleNotFoundError') ? 'Coqui TTS not installed. Run: npm run setup' :
        stderr.includes('torch') ? 'PyTorch not installed. Run: npm run setup' :
        `Coqui TTS failed: ${stderr}`)
  }
  if (!existsSync(outputPath)) err('Output file missing after synthesis')
  l.dim(`Audio saved to ${outputPath}`)
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
    l.dim(`Reading Coqui script: ${scriptFile}`)
    const script = JSON.parse(await fs.readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    const voiceSamples = Object.fromEntries(['DUCO', 'SEAMUS'].map(s => [s, process.env[`COQUI_VOICE_${s}`] || '']))
    const speakers = Object.fromEntries(['DUCO', 'SEAMUS'].map(s => [s, process.env[`COQUI_SPEAKER_${s}`] || '']))
    
    l.dim(`Processing ${script.length} lines with Coqui`)
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      l.dim(`Line ${idx + 1}/${script.length} (${speaker})`)
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
      l.dim(`Saved ${wavOut}`)
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 500))
    }))
    
    l.dim('Merging Coqui audio files')
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    l.dim(`Conversation saved to ${path.join(outDir, 'full_conversation.wav')} 🔊`)
  } catch (error) {
    err(`Error processing Coqui script: ${error}`)
  }
}