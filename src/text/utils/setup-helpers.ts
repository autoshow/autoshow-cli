import { l, err } from '@/logging'
import { execPromise, existsSync, spawnSync } from '@/node-utils'

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

export async function autoSetupWhisper(): Promise<void> {
  const p = '[text/utils/setup-helpers]'
  
  l.wait(`${p} Whisper not configured, running automatic setup...`)
  
  try {
    const result = spawnSync('./.github/setup/index.sh', ['--whisper'], {
      stdio: 'inherit',
      shell: true
    })
    
    if (result.status !== 0) {
      throw new Error(`Setup script exited with code ${result.status}`)
    }
    
    if (!isWhisperConfigured()) {
      throw new Error('Setup completed but Whisper binary or model not found')
    }
    
    l.success(`${p} Whisper setup completed successfully`)
  } catch (error) {
    err(`${p} Failed to automatically setup Whisper: ${(error as Error).message}`)
    l.warn(`${p} Please run manually: npm run setup:whisper`)
    throw error
  }
}

export async function autoSetupWhisperCoreML(): Promise<void> {
  const p = '[text/utils/setup-helpers]'
  
  l.wait(`${p} Whisper CoreML not configured, running automatic setup...`)
  
  try {
    const result = spawnSync('./.github/setup/index.sh', ['--whisper-coreml'], {
      stdio: 'inherit',
      shell: true
    })
    
    if (result.status !== 0) {
      throw new Error(`Setup script exited with code ${result.status}`)
    }
    
    if (!isWhisperCoreMLConfigured()) {
      throw new Error('Setup completed but Whisper CoreML binary or model not found')
    }
    
    l.success(`${p} Whisper CoreML setup completed successfully`)
  } catch (error) {
    err(`${p} Failed to automatically setup Whisper CoreML: ${(error as Error).message}`)
    l.warn(`${p} Please run manually: npm run setup:whisper-coreml`)
    throw error
  }
}