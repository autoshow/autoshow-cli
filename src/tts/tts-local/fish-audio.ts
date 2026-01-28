import { l, err, success } from '@/logging'
import { 
  ensureDir, spawnSync, execSync, readFileSync, existsSync, mkdirSync, readFile, writeFile, join, dirname
} from '@/node-utils'
import {
  ensureSilenceFile, mergeAudioFiles, convertPcmToWav
} from '../tts-utils/audio-utils'
import {
  ensureTtsEnvironment, checkFishAudioInstalled, runFishAudioSetup
} from '../tts-utils/setup-utils'
import { getUserVoice } from '@/utils'
import type { FishAudioOptions } from '../tts-types'

const CHECKPOINT_DIR = 'build/checkpoints/openaudio-s1-mini'
const DOCKER_IMAGE = 'fishaudio/fish-speech:server-cpu'
const DOCKER_CONTAINER_NAME = 'fish-speech-server'

const waitForServerReady = (maxAttempts = 90): boolean => {
  let attempts = 0
  while (attempts < maxAttempts) {
    try {
      const health = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:8080/v1/health'], {
        encoding: 'utf-8',
        stdio: 'pipe'
      })
      if (health.stdout && health.stdout.trim() === '200') {
        return true
      }
    } catch {}
    attempts++
    if (attempts % 15 === 0) {
      l('Still waiting for server', { elapsedSeconds: attempts * 4 })
    }
    spawnSync('sleep', ['4'], { stdio: 'pipe' })
  }
  return false
}

const checkDockerRunning = (): boolean => {
  try {
    const result = spawnSync('docker', ['ps', '-q', '-f', `name=${DOCKER_CONTAINER_NAME}`], {
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    return !!(result.stdout && result.stdout.trim())
  } catch {
    return false
  }
}

const downloadWeightsIfNeeded = (): boolean => {
  const configPath = join(process.cwd(), CHECKPOINT_DIR, 'config.json')
  if (existsSync(configPath)) {
    l('FishAudio weights already present')
    return true
  }
  
  l('Downloading FishAudio S1-mini weights (~2GB)')
  
  const checkpointDir = join(process.cwd(), CHECKPOINT_DIR)
  if (!existsSync(dirname(checkpointDir))) {
    mkdirSync(dirname(checkpointDir), { recursive: true })
  }
  
  
  const homeDir = process.env['HOME'] || ''
  const tokenPaths = [
    join(homeDir, '.cache/huggingface/token'),
    join(homeDir, '.huggingface/token')
  ]
  let hfToken = process.env['HF_TOKEN'] || process.env['HUGGING_FACE_HUB_TOKEN'] || ''
  
  for (const tokenPath of tokenPaths) {
    if (!hfToken && existsSync(tokenPath)) {
      try {
        hfToken = readFileSync(tokenPath, 'utf8').trim()
      } catch {}
    }
  }
  
  try {
    
    const env = { ...process.env }
    if (hfToken) env['HF_TOKEN'] = hfToken
    
    execSync(`hf download fishaudio/openaudio-s1-mini --local-dir ${checkpointDir}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env
    })
    success(`FishAudio weights downloaded`)
    return true
  } catch {
    
    try {
      const pythonPath = join(process.cwd(), 'build/pyenv/tts/bin/python')
      const tokenArg = hfToken ? `, token='${hfToken}'` : ''
      execSync(`${pythonPath} -c "from huggingface_hub import snapshot_download; snapshot_download('fishaudio/openaudio-s1-mini', local_dir='${checkpointDir}'${tokenArg})"`, {
        stdio: 'inherit',
        cwd: process.cwd()
      })
      success('FishAudio weights downloaded')
      return true
    } catch (e) {
      l('Failed to download weights', { error: e })
      return false
    }
  }
}

const startDockerServer = (): boolean => {
  if (checkDockerRunning()) {
    l('FishAudio Docker server already running')
    if (waitForServerReady(30)) {
      return true
    }
    l('FishAudio server not responding while container is running', { containerName: DOCKER_CONTAINER_NAME })
    return false
  }
  
  
  if (!downloadWeightsIfNeeded()) {
    return false
  }
  
  l('Starting FishAudio Docker server')
  
  try {
    
    spawnSync('docker', ['rm', '-f', DOCKER_CONTAINER_NAME], { stdio: 'pipe' })
    
    const checkpointPath = join(process.cwd(), 'build/checkpoints')
    const result = spawnSync('docker', [
      'run', '-d',
      '--name', DOCKER_CONTAINER_NAME,
      '-p', '8080:8080',
      '-v', `${checkpointPath}:/app/checkpoints`,
      DOCKER_IMAGE
    ], {
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    
    if (result.status !== 0) {
      l('Docker run failed', { stderr: result.stderr })
      return false
    }
    
    
    l('Waiting for server to initialize (this can take 5+ minutes on first run)')
    if (waitForServerReady()) {
      success('FishAudio server started')
      return true
    }
    l('Server did not respond after 6 minutes', { containerName: DOCKER_CONTAINER_NAME })
    return false
  } catch (e) {
    l('Failed to start Docker server', { error: e })
    return false
  }
}

const VALID_LANGUAGES = ['en', 'zh', 'ja', 'de', 'fr', 'es', 'ko', 'ar', 'ru', 'nl', 'it', 'pl', 'pt']

const getFishAudioConfig = () => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l('Loading config from path', { configPath })
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  
  
  let pythonPath = process.env['TTS_PYTHON_PATH'] || process.env['FISHAUDIO_PYTHON_PATH'] || config.python
  
  if (!pythonPath || !existsSync(pythonPath)) {
    l('Python path not configured, checking for environment')
    pythonPath = ensureTtsEnvironment()
  }
  
  l('Using Python path', { pythonPath })
  return {
    python: pythonPath,
    default_language: config.fishaudio?.default_language,
    
    api_url: process.env['FISHAUDIO_API_URL'] || config.fishaudio?.api_url || 'http://localhost:8080',
    checkpoint_path: process.env['FISHAUDIO_CHECKPOINT_PATH'] || config.fishaudio?.checkpoint_path || 'build/checkpoints/openaudio-s1-mini',
    use_api: config.fishaudio?.use_api ?? true,
    compile: config.fishaudio?.compile ?? false,
    ...config.fishaudio
  }
}

const verifyFishAudioEnvironment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) {
    l('Python not accessible, attempting to set up environment')
    const newPythonPath = ensureTtsEnvironment()
    return verifyFishAudioEnvironment(newPythonPath)
  }
  
  if (!checkFishAudioInstalled(pythonPath)) {
    l('FishAudio TTS not installed, attempting automatic setup')
    const setupSuccessful = runFishAudioSetup()
    if (!setupSuccessful) {
      err(`Failed to automatically set up FishAudio TTS. Please run: bun setup:tts`)
    }
    
    if (!checkFishAudioInstalled(pythonPath)) {
      err(`FishAudio TTS still not available after setup. Please check installation logs.`)
    }
  }
}

const validateOptions = (options: FishAudioOptions): void => {
  if (options.language && !VALID_LANGUAGES.includes(options.language)) {
    err('Invalid language', { language: options.language, validLanguages: VALID_LANGUAGES.join(', ') })
  }

  if (options.refAudio && !existsSync(options.refAudio)) {
    err('Reference audio not found', { refAudio: options.refAudio })
  }

  if (options.device && !['cpu', 'mps', 'cuda'].includes(options.device)) {
    err('Invalid device', { device: options.device, validDevices: 'cpu, mps, cuda' })
  }
}

export async function synthesizeWithFishAudio(
  text: string,
  outputPath: string,
  options: FishAudioOptions = {},
  _retryCount = 0
): Promise<string> {
  const MAX_RETRIES = 3
  const config = getFishAudioConfig()
  verifyFishAudioEnvironment(config.python)
  
  const language = options.language || config.default_language
  
  validateOptions({ ...options, language })
  
  l(`Using FishAudio S1-mini`)
  
  const pythonScriptPath = new URL('fish-audio-python.py', import.meta.url).pathname
  
  await ensureDir(dirname(outputPath))
  
  
  let processedText = text
  if (options.emotion) {
    processedText = `(${options.emotion}) ${text}`
  }
  
  const configData: Record<string, unknown> = {
    text: processedText,
    output: outputPath,
    api_url: options.apiUrl || config.api_url,
    checkpoint_path: config.checkpoint_path,
    use_api: options.apiUrl ? true : config.use_api,
    compile: config.compile
  }
  
  if (options.refAudio) {
    configData['ref_audio'] = options.refAudio
  }
  if (options.refText) {
    configData['ref_text'] = options.refText
  }
  if (language) {
    configData['language'] = language
  }
  if (options.device) {
    configData['device'] = options.device
  }
  
  l(`Generating speech with FishAudio TTS`)
  
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
      const error = jsonResult.error || ''
      
      if (error.includes('Connection refused') || error.includes('CLI fallback requires') || error.includes('Checkpoint not found')) {
        if (_retryCount >= MAX_RETRIES) {
          err('FishAudio TTS failed after retries', { maxRetries: MAX_RETRIES, containerName: DOCKER_CONTAINER_NAME })
        }
        l('FishAudio API not available, attempting automatic Docker setup')
        if (startDockerServer()) {
          
          await new Promise(resolve => setTimeout(resolve, 3000))
          l('Retrying synthesis with Docker server', { attempt: _retryCount + 1, maxRetries: MAX_RETRIES })
          return synthesizeWithFishAudio(text, outputPath, options, _retryCount + 1)
        }
        err('FishAudio TTS failed. Could not start Docker server automatically')
      }
      err('FishAudio TTS failed', { error })
    }
  } catch {
    const stderr = result.stderr || ''
    if (result.status !== 0) {
      
      if (stderr.includes('Connection refused') || stderr.includes('CLI fallback requires') || stderr.includes('Checkpoint not found')) {
        if (_retryCount >= MAX_RETRIES) {
          err('FishAudio TTS failed after retries', { maxRetries: MAX_RETRIES, containerName: DOCKER_CONTAINER_NAME })
        }
        l('FishAudio API not available, attempting automatic Docker setup')
        if (startDockerServer()) {
          
          await new Promise(resolve => setTimeout(resolve, 3000))
          l('Retrying synthesis with Docker server', { attempt: _retryCount + 1, maxRetries: MAX_RETRIES })
          return synthesizeWithFishAudio(text, outputPath, options, _retryCount + 1)
        }
        err('FishAudio TTS failed. Could not start Docker server automatically')
      }
      if (stderr.includes('ModuleNotFoundError')) {
        err('FishAudio TTS not installed. Run: bun setup:tts')
      } else if (stderr.includes('torch')) {
        err('PyTorch not installed. Run: bun setup:tts')
      } else if (stderr.includes('CUDA out of memory')) {
        err('GPU out of memory. Try using CPU mode.')
      } else {
        err('FishAudio TTS failed', { stderr })
      }
    }
  }
  
  if (!existsSync(outputPath)) err(`Output file missing after synthesis`)
  return outputPath
}

export async function processScriptWithFishAudio(
  scriptFile: string,
  outDir: string,
  options: FishAudioOptions = {}
): Promise<void> {
  try {
    const script = JSON.parse(await readFile(scriptFile, 'utf8'))
    
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    
    await ensureSilenceFile(outDir)
    
    
    const voiceMapping: Record<string, string> = {}
    for (const speakerKey of ['DUCO', 'SEAMUS', 'NARRATOR']) {
      const voiceValue = getUserVoice('fishaudio', speakerKey)
      if (voiceValue) {
        voiceMapping[speakerKey] = voiceValue
      }
    }
    
    l('Processing lines with FishAudio TTS', { lineCount: script.length })
    
    for (let idx = 0; idx < script.length; idx++) {
      const entry = script[idx] as { speaker: string; text: string; refAudio?: string; emotion?: string }
      const entrySpeaker = entry.speaker
      const entryText = entry.text
      const base = `${String(idx).padStart(3, '0')}_${entrySpeaker}`
      const wavOut = join(outDir, `${base}.wav`)
      const pcmOut = join(outDir, `${base}.pcm`)
      
      l('Processing segment', { current: idx + 1, total: script.length, speaker: entrySpeaker })
      
      await synthesizeWithFishAudio(entryText, wavOut, {
        ...options,
        refAudio: entry.refAudio || voiceMapping[entrySpeaker] || options.refAudio,
        emotion: entry.emotion || options.emotion
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
    err('Error processing FishAudio TTS script', { error })
  }
}
