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
import { getUserVoice } from '@/utils'

const getKittenConfig = () => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l('Loading config from path', { configPath })
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  
  
  let pythonPath = process.env['TTS_PYTHON_PATH'] || process.env['KITTEN_PYTHON_PATH'] || config.python
  
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
        l('Kitten TTS error from Python', { error: jsonResult.error })
        err('Kitten TTS failed', { error: jsonResult.error })
      }
    }
  } catch (parseError) {
    
    l('Could not parse JSON response', { lastLine, parseError })
  }
  
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    l('Kitten TTS failed', { status: result.status, stderr, stdout: lines.slice(0, -1).join('\n') })
    
    if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
      const missingModule = stderr.match(/No module named ['"]([^'"]+)['"]/)?.[1]
      err(`Kitten TTS dependency missing${missingModule ? `: ${missingModule}` : ''}.

SOLUTION: Run setup to install all dependencies:
  bun setup:tts`)
    } else if (stderr.includes('invalid expand shape') || stderr.includes('shape') || stderr.includes('dimension')) {
      err(`Text too long or incompatible with Kitten TTS.

Kitten TTS is a lightweight model with limitations on input length and complexity.

SOLUTION:
  1. Try shorter text (max ~200 characters recommended)
  2. Or use a more capable engine: --qwen3 or --coqui`)
    } else if (stderr.includes('torch') || stderr.includes('CUDA')) {
      err(`PyTorch error detected.

SOLUTION:
  1. Ensure PyTorch is installed: bun setup:tts
  2. Kitten TTS works on CPU, GPU not required
  3. Check Python environment: ${config.python} -c "import torch; print(torch.__version__)"`)
    } else if (stderr.includes('model') || stderr.includes('checkpoint') || stderr.includes('load')) {
      err(`Kitten TTS model loading error.

The model may not be properly downloaded or initialized.

SOLUTION:
  1. Reinstall: bun setup:tts
  2. Check model directory exists: ls -la build/pyenv/tts/lib/python*/site-packages/kittentts/`)
    } else {
      err('Kitten TTS failed', { 
        stderr: stderr || '(no stderr)',
        hint: 'Check the error output above. Kitten TTS is lightweight but has limitations.'
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
      [s, getUserVoice('kitten', s, s === 'DUCO' ? 'expr-voice-2-m' : 'expr-voice-3-m')]
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