import { l } from '@/logging'
import { execPromise } from '@/node-utils'

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