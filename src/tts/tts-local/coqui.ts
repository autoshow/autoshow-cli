import { l, err, success } from '@/logging'
import { 
  ensureDir, spawnSync, readFileSync, existsSync, mkdirSync, readFile, writeFile, join, dirname
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils/audio-utils'
import {
  ensureTtsEnvironment, checkCoquiInstalled, runCoquiSetup
} from '../tts-utils/setup-utils'
import { getUserVoice } from '@/utils'

const getCoquiConfig = () => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l('Loading config from path', { configPath })
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  
  
  let pythonPath = process.env['TTS_PYTHON_PATH'] || process.env['COQUI_PYTHON_PATH'] || config.python
  
  if (!pythonPath || !existsSync(pythonPath)) {
    l('Python path not configured, checking for environment')
    pythonPath = ensureTtsEnvironment()
  }
  
  l('Using Python path', { pythonPath })
  return { python: pythonPath, ...config.coqui }
}

const verifyCoquiEnvironment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) {
    l('Python not accessible, attempting to set up environment')
    const newPythonPath = ensureTtsEnvironment()
    return verifyCoquiEnvironment(newPythonPath)
  }
  
  if (!checkCoquiInstalled(pythonPath)) {
    l('Coqui TTS not installed, attempting automatic setup')
    const setupSuccessful = runCoquiSetup()
    if (!setupSuccessful) {
      err(`Failed to automatically set up Coqui TTS. Please run: bun setup:tts`)
    }
    
    if (!checkCoquiInstalled(pythonPath)) {
      err(`Coqui TTS still not available after setup. Please check installation logs.`)
    }
  }
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
  l('Using model', { model: modelName })
  
  const pythonScriptPath = join(dirname(import.meta.url.replace('file://', '')), 'coqui-python.py')
  
  await ensureDir(dirname(outputPath))
  
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
  
  l('Generating speech with model', { model: modelName })
  
  const result = spawnSync(config.python, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { ...process.env, PYTHONWARNINGS: 'ignore' }
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    if (errorWithCode.code === 'ENOENT') {
      err(`Python not found at: ${config.python}

SOLUTION: Run setup to install Python environment:
  bun setup:tts`)
    } else {
      l('Python execution error', { error: result.error, pythonPath: config.python })
      err('Python execution error', { errorCode: errorWithCode.code, message: result.error.message })
    }
  }
  
  const stdout = result.stdout || ''
  const lines = stdout.trim().split('\n')
  const lastLine = lines[lines.length - 1] || ''
  
  
  try {
    if (lastLine && lastLine.startsWith('{')) {
      const jsonResult = JSON.parse(lastLine)
      if (!jsonResult.ok) {
        l('Coqui TTS error from Python', { error: jsonResult.error })
        err('Coqui TTS failed', { error: jsonResult.error })
      }
    }
  } catch (parseError) {
    
    l('Could not parse JSON response', { lastLine, parseError })
  }
  
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    l('Coqui TTS failed', { status: result.status, stderr, stdout: lines.slice(0, -1).join('\n') })
    
    if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
      const missingModule = stderr.match(/No module named ['"]([^'"]+)['"]/)?.[1]
      err(`Coqui TTS dependency missing${missingModule ? `: ${missingModule}` : ''}.

SOLUTION: Run setup to install all dependencies:
  bun setup:tts`)
    } else if (stderr.includes('torch') || stderr.includes('CUDA')) {
      err(`PyTorch error detected.

SOLUTION:
  1. Ensure PyTorch is installed: bun setup:tts
  2. For CPU-only inference, this is expected
  3. Check Python environment: ${config.python} -c "import torch; print(torch.__version__)"`)
    } else if (stderr.includes('model') || stderr.includes('checkpoint')) {
      err(`Coqui TTS model error.

The requested model may not be available or failed to load.

SOLUTION:
  1. Use a specific model: --coqui-model "model_name"
  2. Or reinstall: bun setup:tts`)
    } else {
      err('Coqui TTS failed', { 
        stderr: stderr || '(no stderr)',
        hint: 'Check the error output above. Run bun setup:tts if TTS is not installed.'
      })
    }
  }
  
  if (!existsSync(outputPath)) {
    err(`Output file missing after synthesis.

The synthesis may have completed but failed to save the audio file.

Check: ${outputPath}`)
  }
  
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
    const script = JSON.parse(await readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    const voiceSamples = Object.fromEntries(['DUCO', 'SEAMUS'].map(s => [s, getUserVoice('coqui', s) || '']))
    const speakers = Object.fromEntries(['DUCO', 'SEAMUS'].map(s => [s, getUserVoice('coqui_speaker', s) || '']))
    
    l('Processing lines with Coqui', { lineCount: script.length })
    await Promise.all(script.map(async (entry: any, idx: number) => {
      const { speaker, text } = entry
      const base = `${String(idx).padStart(3, '0')}_${speaker}`
      const wavOut = join(outDir, `${base}.wav`)
      const pcmOut = join(outDir, `${base}.pcm`)
      
      await synthesizeWithCoqui(text, wavOut, {
        ...options,
        ...(voiceSamples[speaker] && existsSync(voiceSamples[speaker]) ? { speakerWav: voiceSamples[speaker] } :
            speakers[speaker] ? { speaker: speakers[speaker] } : {})
      })
      
      const wavData = await readFile(wavOut)
      await writeFile(pcmOut, wavData.slice(44))
      if (idx < script.length - 1) await new Promise(resolve => setTimeout(resolve, 500))
    }))
    
    await mergeAudioFiles(outDir)
    await convertPcmToWav(outDir)
    success('Conversation saved', { outputFile: join(outDir, 'full_conversation.wav') })
  } catch (error) {
    err('Error processing Coqui script', { error })
  }
}