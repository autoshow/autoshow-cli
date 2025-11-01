import { l, err } from '@/logging'
import { existsSync, execPromise, ensureDir, readFile } from '@/node-utils'

async function loadEnvConfig(envFile: string): Promise<Record<string, string>> {
  if (!existsSync(envFile)) {
    return {}
  }
  
  try {
    const content = await readFile(envFile, 'utf8')
    const config: Record<string, string> = {}
    
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          config[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
    
    return config
  } catch (error) {
    return {}
  }
}

export async function ensureWhisperBinary(): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  const whisperPath = './build/bin/whisper-cli'
  
  if (existsSync(whisperPath)) {
    return true
  }
  
  l.warn('Whisper binary not found, running automatic setup...')
  
  try {
    await ensureDir('./build/bin')
    await execPromise('bash ./.github/setup/transcription/whisper.sh', { maxBuffer: 10000 * 1024 })
    l.success('Whisper setup completed successfully')
    return existsSync(whisperPath)
  } catch (error) {
    err(`${p} Failed to automatically setup whisper: ${(error as Error).message}`)
    return false
  }
}

export async function ensureWhisperModel(modelId: string): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  const modelPath = `./build/models/ggml-${modelId}.bin`
  
  if (existsSync(modelPath)) {
    return true
  }
  
  l.warn(`Model ${modelId} not found, downloading automatically...`)
  
  try {
    await ensureDir('./build/models')
    
    await execPromise(
      `bash ./.github/setup/transcription/download-ggml-model.sh ${modelId} ./build/models`,
      { maxBuffer: 10000 * 1024 }
    )
    l.success(`Model ${modelId} downloaded successfully`)
    return existsSync(modelPath)
  } catch (error) {
    err(`${p} Failed to download model ${modelId}: ${(error as Error).message}`)
    return false
  }
}

export async function ensureCoreMLEnvironment(): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  const pythonPath = './build/pyenv/coreml/bin/python'
  const binaryPath = './build/bin/whisper-cli-coreml'
  const envConfigPath = './build/config/.coreml-env'
  
  if (existsSync(pythonPath) && existsSync(binaryPath) && existsSync(envConfigPath)) {
    return true
  }
  
  l.warn('CoreML environment not found, running automatic setup...')
  l.warn('This may take several minutes on first run...')
  
  try {
    await ensureDir('./build/pyenv')
    await ensureDir('./build/bin')
    await ensureDir('./build/models')
    await ensureDir('./build/cache/coreml')
    await ensureDir('./build/tmp/coreml')
    
    const env = { ...process.env }
    delete env['PYTHONPATH']
    delete env['PYTHONHOME']
    env['PIP_CACHE_DIR'] = `${process.cwd()}/build/cache/coreml`
    env['TMPDIR'] = `${process.cwd()}/build/tmp/coreml`
    
    await execPromise('bash ./.github/setup/transcription/coreml/whisper-coreml.sh', { 
      maxBuffer: 10000 * 1024,
      timeout: 600000,
      env
    })
    l.success('CoreML environment setup completed successfully')
    return existsSync(pythonPath) && existsSync(binaryPath)
  } catch (error) {
    err(`${p} Failed to setup CoreML environment: ${(error as Error).message}`)
    return false
  }
}

export async function ensureCoreMLEncoder(modelId: string): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  
  const mlmodelcPath = `./build/models/ggml-${modelId}-encoder.mlmodelc`
  const mlpackagePath = `./build/models/ggml-${modelId}-encoder.mlpackage`
  const altPackagePath = `./build/models/coreml-encoder-${modelId}.mlpackage`
  
  if (existsSync(mlmodelcPath) || existsSync(mlpackagePath) || existsSync(altPackagePath)) {
    return true
  }
  
  const baseModelPath = `./build/models/ggml-${modelId}.bin`
  if (!existsSync(baseModelPath)) {
    const modelSuccess = await ensureWhisperModel(modelId)
    if (!modelSuccess) {
      err(`${p} Failed to download base model required for CoreML`)
      return false
    }
  }
  
  l.warn(`CoreML encoder for ${modelId} not found, generating automatically...`)
  l.warn('This may take several minutes...')
  
  try {
    await ensureDir('./build/models')
    
    const envConfig = await loadEnvConfig('./build/config/.coreml-env')
    const env = { ...process.env }
    delete env['PYTHONPATH']
    delete env['PYTHONHOME']
    if (envConfig['COREML_CACHE']) env['PIP_CACHE_DIR'] = envConfig['COREML_CACHE']
    if (envConfig['COREML_TMP']) env['TMPDIR'] = envConfig['COREML_TMP']
    
    await execPromise(`bash ./.github/setup/transcription/coreml/generate-coreml-model.sh ${modelId}`, {
      maxBuffer: 10000 * 1024,
      timeout: 300000,
      env
    })
    l.success(`CoreML encoder for ${modelId} generated successfully`)
    
    return existsSync(mlmodelcPath) || existsSync(mlpackagePath) || existsSync(altPackagePath)
  } catch (error) {
    err(`${p} Failed to generate CoreML model: ${(error as Error).message}`)
    return false
  }
}

export async function ensureDiarizationEnvironment(): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  const pythonPath = './build/pyenv/whisper-diarization/bin/python'
  const scriptPath = './build/bin/whisper-diarize.py'
  const envConfigPath = './build/config/.diarization-env'
  
  if (existsSync(pythonPath) && existsSync(scriptPath) && existsSync(envConfigPath)) {
    return true
  }
  
  l.warn('Diarization environment not found, running automatic setup...')
  l.warn('This may take several minutes on first run...')
  
  try {
    await ensureDir('./build/pyenv')
    await ensureDir('./build/bin')
    await ensureDir('./build/cache/whisper-diarization')
    await ensureDir('./build/tmp/whisper-diarization')
    
    const env = { ...process.env }
    delete env['PYTHONPATH']
    delete env['PYTHONHOME']
    env['PIP_CACHE_DIR'] = `${process.cwd()}/build/cache/whisper-diarization`
    env['TMPDIR'] = `${process.cwd()}/build/tmp/whisper-diarization`
    
    await execPromise('bash ./.github/setup/transcription/diarization/whisper-diarization.sh', {
      maxBuffer: 10000 * 1024,
      timeout: 600000,
      env
    })
    l.success('Diarization environment setup completed successfully')
    return existsSync(pythonPath) && existsSync(scriptPath)
  } catch (error) {
    err(`${p} Failed to setup diarization environment: ${(error as Error).message}`)
    return false
  }
}

export async function checkFFmpeg(): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  
  try {
    await execPromise('which ffmpeg', { maxBuffer: 1024 })
    return true
  } catch {
    l.warn(`${p} ffmpeg not found - audio processing may fail`)
    l.warn(`${p} Install ffmpeg with: brew install ffmpeg`)
    return false
  }
}

export async function runSetupWithRetry(
  setupFn: () => Promise<boolean>,
  maxRetries: number = 2
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const success = await setupFn()
    if (success) {
      return true
    }
    
    if (attempt < maxRetries) {
      const delay = 2000 * attempt
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return false
}

export async function ensureBuildDirectories(): Promise<void> {
  const directories = [
    './build',
    './build/bin',
    './build/models',
    './build/config',
    './build/pyenv',
    './build/cache',
    './build/cache/coreml',
    './build/cache/whisper-diarization',
    './build/tmp',
    './build/tmp/coreml',
    './build/tmp/whisper-diarization'
  ]
  
  for (const dir of directories) {
    if (!existsSync(dir)) {
      await ensureDir(dir)
    }
  }
}