import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { err } from '@/logging'
import type { ApiError, MusicOutputFormat } from './music-types'

export function generateUniqueFilename(prefix: string, extension: string = 'mp3'): string {
  const timestamp = generateTimestamp()
  const randomString = Math.random().toString(36).substring(2, 8)
  const makeFilename = (extra = '') => join('./output', `${prefix}-${timestamp}-${randomString}${extra}.${extension}`)
  const filepath = makeFilename()
  return existsSync(filepath) ? makeFilename(`-${Math.random().toString(36).substring(2, 8)}`) : filepath
}

export const generateTimestamp = (): string => new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)

export const isApiError = (error: unknown): error is ApiError => 
  typeof error === 'object' && error !== null && 'message' in error && typeof (error as ApiError).message === 'string'

export const handleError = (error: any): void => {
  if (!isApiError(error)) {
    err(`Unknown error: ${String(error)}`)
  }
  
  const errorMap: Record<string, string> = {
    'quota exceeded': 'API quota exceeded. Please check your ElevenLabs plan limits',
    'Invalid API key': 'Invalid API key. Please check your ELEVENLABS_API_KEY',
    'rate limit': `Rate limit exceeded: ${error.message}`,
    'ELEVENLABS_API_KEY': 'Missing ElevenLabs API key. Please set ELEVENLABS_API_KEY in your .env file',
    '401': 'Unauthorized. Please verify your ELEVENLABS_API_KEY is valid',
    '422': `Validation error: ${error.message}`
  }
  
  const matched = Object.entries(errorMap).find(([key]) => 
    error.name === key || error.message?.includes(key)
  )
  
  err(`${matched ? matched[1] : `Error: ${error.message}`}`)
}

export function ensureOutputDirectory(outputPath: string): void {
  const dir = dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function getExtensionFromFormat(format: MusicOutputFormat): string {
  if (format.startsWith('mp3')) return 'mp3'
  if (format.startsWith('pcm')) return 'pcm'
  if (format.startsWith('opus')) return 'opus'
  if (format.startsWith('ulaw') || format.startsWith('alaw')) return 'wav'
  return 'mp3'
}

export function validateDuration(ms: number): boolean {
  return ms >= 3000 && ms <= 600000
}

export function parseDuration(value: string): number {
  // Support formats: "30s", "2m", "2:30", "150000" (ms)
  if (value.endsWith('s')) {
    return parseInt(value) * 1000
  }
  if (value.endsWith('m')) {
    return parseInt(value) * 60 * 1000
  }
  if (value.includes(':')) {
    const [min, sec] = value.split(':').map(Number)
    return ((min ?? 0) * 60 + (sec ?? 0)) * 1000
  }
  return parseInt(value)
}

// NOTE: caller should validate NaN and range after parseDuration

export const VALID_OUTPUT_FORMATS: MusicOutputFormat[] = [
  'mp3_22050_32', 'mp3_24000_48', 'mp3_44100_32', 'mp3_44100_64',
  'mp3_44100_96', 'mp3_44100_128', 'mp3_44100_192',
  'pcm_8000', 'pcm_16000', 'pcm_22050', 'pcm_24000', 'pcm_32000', 'pcm_44100', 'pcm_48000',
  'ulaw_8000', 'alaw_8000',
  'opus_48000_32', 'opus_48000_64', 'opus_48000_96', 'opus_48000_128', 'opus_48000_192'
]

export function isValidOutputFormat(format: string): format is MusicOutputFormat {
  return VALID_OUTPUT_FORMATS.includes(format as MusicOutputFormat)
}
