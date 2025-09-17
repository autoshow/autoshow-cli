import { l, err } from '@/logging'
import { existsSync, execPromise, ensureDir } from '@/node-utils'

export async function ensureWhisperBinary(): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  const whisperPath = './build/bin/whisper-cli'
  
  if (existsSync(whisperPath)) {
    l.dim(`${p} Whisper binary already exists`)
    return true
  }
  
  l.warn(`${p} Whisper binary not found, running automatic setup...`)
  
  try {
    await ensureDir('./build/bin')
    await execPromise('bash ./.github/setup/transcription/whisper.sh', { maxBuffer: 10000 * 1024 })
    l.success(`${p} Whisper setup completed successfully`)
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
    l.dim(`${p} Model ${modelId} already exists`)
    return true
  }
  
  l.warn(`${p} Model ${modelId} not found, downloading automatically...`)
  
  try {
    await ensureDir('./build/models')
    l.dim(`${p} Created models directory at ./build/models`)
    
    await execPromise(
      `bash ./.github/setup/transcription/download-ggml-model.sh ${modelId} ./build/models`,
      { maxBuffer: 10000 * 1024 }
    )
    l.success(`${p} Model ${modelId} downloaded successfully`)
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
  
  if (existsSync(pythonPath) && existsSync(binaryPath)) {
    l.dim(`${p} CoreML environment already exists`)
    return true
  }
  
  l.warn(`${p} CoreML environment not found, running automatic setup...`)
  l.warn(`${p} This may take several minutes on first run...`)
  
  try {
    await ensureDir('./build/pyenv')
    await ensureDir('./build/bin')
    await ensureDir('./build/models')
    
    await execPromise('bash ./.github/setup/transcription/whisper-coreml.sh', { 
      maxBuffer: 10000 * 1024,
      timeout: 600000
    })
    l.success(`${p} CoreML environment setup completed successfully`)
    return existsSync(pythonPath) && existsSync(binaryPath)
  } catch (error) {
    err(`${p} Failed to setup CoreML environment: ${(error as Error).message}`)
    return false
  }
}

export async function ensureCoreMLModel(modelId: string): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  const encoderPath = `./build/models/ggml-${modelId}-encoder.mlmodelc`
  
  if (existsSync(encoderPath)) {
    l.dim(`${p} CoreML encoder for ${modelId} already exists`)
    return true
  }
  
  const baseModelPath = `./build/models/ggml-${modelId}.bin`
  if (!existsSync(baseModelPath)) {
    l.dim(`${p} Base model ${modelId} needed for CoreML, downloading first...`)
    const modelSuccess = await ensureWhisperModel(modelId)
    if (!modelSuccess) {
      err(`${p} Failed to download base model required for CoreML`)
      return false
    }
  }
  
  l.warn(`${p} CoreML encoder for ${modelId} not found, generating automatically...`)
  
  try {
    await ensureDir('./build/models')
    
    await execPromise(`bash ./.github/setup/transcription/generate-coreml-model.sh ${modelId}`, {
      maxBuffer: 10000 * 1024,
      timeout: 300000
    })
    l.success(`${p} CoreML encoder for ${modelId} generated successfully`)
    return existsSync(encoderPath)
  } catch (error) {
    err(`${p} Failed to generate CoreML model: ${(error as Error).message}`)
    return false
  }
}

export async function ensureDiarizationEnvironment(): Promise<boolean> {
  const p = '[text/utils/setup-helpers]'
  const pythonPath = './build/pyenv/whisper-diarization/bin/python'
  const scriptPath = './build/bin/whisper-diarize.py'
  
  if (existsSync(pythonPath) && existsSync(scriptPath)) {
    l.dim(`${p} Diarization environment already exists`)
    return true
  }
  
  l.warn(`${p} Diarization environment not found, running automatic setup...`)
  l.warn(`${p} This may take several minutes on first run...`)
  
  try {
    await ensureDir('./build/pyenv')
    await ensureDir('./build/bin')
    
    await execPromise('bash ./.github/setup/transcription/whisper-diarization.sh', {
      maxBuffer: 10000 * 1024,
      timeout: 600000
    })
    l.success(`${p} Diarization environment setup completed successfully`)
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
    l.dim(`${p} ffmpeg is available`)
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
  const p = '[text/utils/setup-helpers]'
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    l.dim(`${p} Setup attempt ${attempt} of ${maxRetries}`)
    
    const success = await setupFn()
    if (success) {
      return true
    }
    
    if (attempt < maxRetries) {
      const delay = 2000 * attempt
      l.warn(`${p} Setup failed, retrying in ${delay / 1000} seconds...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return false
}

export async function ensureBuildDirectories(): Promise<void> {
  const p = '[text/utils/setup-helpers]'
  const directories = [
    './build',
    './build/bin',
    './build/models',
    './build/config',
    './build/pyenv'
  ]
  
  for (const dir of directories) {
    if (!existsSync(dir)) {
      await ensureDir(dir)
      l.dim(`${p} Created directory: ${dir}`)
    }
  }
}