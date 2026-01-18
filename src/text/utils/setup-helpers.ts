import { l, err } from '@/logging'
import { execPromise, existsSync, spawnSync } from '@/node-utils'

export async function checkFFmpeg(): Promise<boolean> {
  try {
    await execPromise('which ffmpeg', { maxBuffer: 1024 })
    return true
  } catch {
    l.warn('ffmpeg not found - audio processing may fail')
    l.warn('Install ffmpeg with: brew install ffmpeg')
    return false
  }
}

export async function getAudioDuration(filePath: string): Promise<number> {
  const cmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`
  const { stdout } = await execPromise(cmd)
  const seconds = parseFloat(stdout.trim())
  if (isNaN(seconds)) {
    throw new Error(`Could not parse audio duration for file: ${filePath}`)
  }
  return seconds
}

export function isWhisperConfigured(): boolean {
  const whisperBinary = './build/bin/whisper-cli'
  const baseModel = './build/models/ggml-base.bin'
  return existsSync(whisperBinary) && existsSync(baseModel)
}

export function isWhisperCoreMLConfigured(): boolean {
  const whisperCoreMLBinary = './build/bin/whisper-cli-coreml'
  const baseModel = './build/models/ggml-base.bin'
  return existsSync(whisperCoreMLBinary) && existsSync(baseModel)
}

export function checkModelExists(modelId: string): boolean {
  const modelPath = `./build/models/ggml-${modelId}.bin`
  return existsSync(modelPath)
}

export async function downloadModel(modelId: string): Promise<void> {
  l.wait(`Downloading model ${modelId}...`)
  
  try {
    const result = spawnSync(
      './.github/setup/transcription/download-ggml-model.sh',
      [modelId, './build/models'],
      { stdio: 'inherit', shell: true }
    )
    
    if (result.status !== 0) {
      throw new Error(`Model download script exited with code ${result.status}`)
    }
    
    if (!checkModelExists(modelId)) {
      throw new Error(`Model download completed but file not found`)
    }
    
    l.success(`Model ${modelId} downloaded successfully`)
  } catch (error) {
    err(`Failed to download model ${modelId}: ${(error as Error).message}`)
    throw error
  }
}

export async function ensureModelExists(modelId: string): Promise<void> {
  if (!checkModelExists(modelId)) {
    l.wait(`Model ${modelId} not found, downloading...`)
    await downloadModel(modelId)
  }
}

export function checkCoreMLModelExists(modelId: string): boolean {
  const mlmodelcPath = `./build/models/ggml-${modelId}-encoder.mlmodelc`
  const mlpackagePath = `./build/models/ggml-${modelId}-encoder.mlpackage`
  const altPackagePath = `./build/models/coreml-encoder-${modelId}.mlpackage`
  
  return existsSync(mlmodelcPath) || existsSync(mlpackagePath) || existsSync(altPackagePath)
}

export async function generateCoreMLModel(modelId: string): Promise<void> {
  l.wait(`Generating CoreML model for ${modelId}...`)
  
  try {
    const result = spawnSync(
      './.github/setup/transcription/coreml/generate-coreml-model.sh',
      [modelId],
      { stdio: 'inherit', shell: true }
    )
    
    if (result.status !== 0) {
      throw new Error(`CoreML generation script exited with code ${result.status}`)
    }
    
    if (!checkCoreMLModelExists(modelId)) {
      throw new Error(`CoreML model generation completed but artifact not found`)
    }
    
    l.success(`CoreML model for ${modelId} generated successfully`)
  } catch (error) {
    err(`Failed to generate CoreML model for ${modelId}: ${(error as Error).message}`)
    throw error
  }
}

export async function ensureCoreMLModelExists(modelId: string): Promise<void> {
  await ensureModelExists(modelId)
  
  if (!checkCoreMLModelExists(modelId)) {
    l.wait(`CoreML model for ${modelId} not found, generating...`)
    await generateCoreMLModel(modelId)
  }
}

export async function autoSetupWhisper(): Promise<void> {
  l.wait('Whisper not configured, running automatic setup...')
  
  try {
    const result = spawnSync('./.github/setup/index.sh', ['--transcription'], {
      stdio: 'inherit',
      shell: true
    })
    
    if (result.status !== 0) {
      throw new Error(`Setup script exited with code ${result.status}`)
    }
    
    if (!isWhisperConfigured()) {
      throw new Error('Setup completed but Whisper binary or model not found')
    }
    
    l.success('Whisper setup completed successfully')
  } catch (error) {
    err(`Failed to automatically setup Whisper: ${(error as Error).message}`)
    l.warn('Please run manually: bun setup:transcription')
    throw error
  }
}

export async function autoSetupWhisperCoreML(): Promise<void> {
  l.wait('Whisper CoreML not configured, running automatic setup...')
  
  try {
    // CoreML is set up as part of the transcription setup on macOS
    const result = spawnSync('./.github/setup/index.sh', ['--transcription'], {
      stdio: 'inherit',
      shell: true
    })
    
    if (result.status !== 0) {
      throw new Error(`Setup script exited with code ${result.status}`)
    }
    
    if (!isWhisperCoreMLConfigured()) {
      throw new Error('Setup completed but Whisper CoreML binary or model not found')
    }
    
    l.success('Whisper CoreML setup completed successfully')
  } catch (error) {
    err(`Failed to automatically setup Whisper CoreML: ${(error as Error).message}`)
    l.warn('Please run manually: bun setup:transcription')
    throw error
  }
}