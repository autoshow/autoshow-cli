import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { err, l } from '@/logging'
import type { ApiError, MusicOutputFormat, MinimaxAudioSetting, MusicService } from './music-types'
import { MINIMAX_SECTION_TAGS } from './music-types'

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
    err('Unknown error', { error: String(error) })
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
  
  err(matched ? matched[1] : 'Error', matched ? undefined : { message: error.message })
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

const MINIMAX_LYRICS_MAX_LENGTH = 3500
const MINIMAX_PROMPT_MAX_LENGTH = 2000

export function truncateLyricsForMinimax(lyrics: string): string {
  if (lyrics.length <= MINIMAX_LYRICS_MAX_LENGTH) {
    return lyrics
  }
  
  l('Lyrics exceed MiniMax limit. Truncating...', { 
    actualLength: lyrics.length, 
    maxLength: MINIMAX_LYRICS_MAX_LENGTH 
  })
  
  const truncated = lyrics.substring(0, MINIMAX_LYRICS_MAX_LENGTH)
  
  const lastSectionIndex = truncated.lastIndexOf('\n[')
  if (lastSectionIndex > MINIMAX_LYRICS_MAX_LENGTH * 0.7) {
    return truncated.substring(0, lastSectionIndex).trim()
  }
  
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > MINIMAX_LYRICS_MAX_LENGTH * 0.8) {
    return truncated.substring(0, lastNewline).trim()
  }
  
  return truncated.trim()
}

export function truncatePromptForMinimax(prompt: string): string {
  if (prompt.length <= MINIMAX_PROMPT_MAX_LENGTH) {
    return prompt
  }
  
  l('Prompt exceeds MiniMax limit. Truncating...', { 
    actualLength: prompt.length, 
    maxLength: MINIMAX_PROMPT_MAX_LENGTH 
  })
  return prompt.substring(0, MINIMAX_PROMPT_MAX_LENGTH).trim()
}

export function normalizeSectionTagsForMinimax(lyrics: string): string {
  const tagMap: Record<string, string> = {
    'verse 1': 'Verse', 'verse 2': 'Verse', 'verse 3': 'Verse', 'verse 4': 'Verse',
    'chorus 1': 'Chorus', 'chorus 2': 'Chorus', 'chorus 3': 'Chorus',
    'pre-chorus': 'Pre Chorus', 'prechorus': 'Pre Chorus',
    'post-chorus': 'Post Chorus', 'postchorus': 'Post Chorus',
    'build-up': 'Build Up', 'buildup': 'Build Up',
    'instrumental': 'Inst', 'instrument': 'Inst',
    'end': 'Outro', 'ending': 'Outro',
    'start': 'Intro', 'opening': 'Intro',
    'refrain': 'Chorus',
  }
  
  return lyrics.replace(/\[([^\]]+)\]/gi, (match, tag) => {
    const normalized = tag.toLowerCase().trim()
    const mapped = tagMap[normalized]
    if (mapped) {
      return `[${mapped}]`
    }
    const validTag = MINIMAX_SECTION_TAGS.find(
      t => t.toLowerCase() === normalized
    )
    if (validTag) {
      return `[${validTag}]`
    }
    l('Unknown section tag may not be recognized by MiniMax', { tag })
    return match
  })
}

export const VALID_MINIMAX_FORMATS = [
  'mp3_16000_32000', 'mp3_16000_64000', 'mp3_16000_128000', 'mp3_16000_256000',
  'mp3_24000_32000', 'mp3_24000_64000', 'mp3_24000_128000', 'mp3_24000_256000',
  'mp3_32000_32000', 'mp3_32000_64000', 'mp3_32000_128000', 'mp3_32000_256000',
  'mp3_44100_32000', 'mp3_44100_64000', 'mp3_44100_128000', 'mp3_44100_256000',
  'wav_16000', 'wav_24000', 'wav_32000', 'wav_44100',
  'pcm_16000', 'pcm_24000', 'pcm_32000', 'pcm_44100',
] as const

export type MinimaxOutputFormat = typeof VALID_MINIMAX_FORMATS[number]

export function parseMinimaxFormat(formatStr: string): MinimaxAudioSetting {
  const parts = formatStr.split('_')
  const format = (parts[0] ?? 'mp3') as 'mp3' | 'wav' | 'pcm'
  const sampleRate = parseInt(parts[1] ?? '44100') as 16000 | 24000 | 32000 | 44100
  const bitrate = parts[2] ? parseInt(parts[2]) as 32000 | 64000 | 128000 | 256000 : undefined
  
  return {
    format,
    sample_rate: sampleRate,
    bitrate,
  }
}

export function isMinimaxFormat(format: string): boolean {
  return VALID_MINIMAX_FORMATS.includes(format as MinimaxOutputFormat)
}

export function isElevenlabsFormat(format: string): boolean {
  return VALID_OUTPUT_FORMATS.includes(format as MusicOutputFormat)
}

export function convertFormatForService(format: string, targetService: MusicService): string {
  if (targetService === 'minimax') {
    if (isMinimaxFormat(format)) {
      return format
    }
    
    l('Format not compatible with MiniMax. Using closest match.', { format })
    
    const parts = format.split('_')
    const sr = parseInt(parts[1] ?? '44100') || 44100
    const validSampleRates = [16000, 24000, 32000, 44100]
    const closestSr = validSampleRates.reduce((prev, curr) =>
      Math.abs(curr - sr) < Math.abs(prev - sr) ? curr : prev
    )
    
    return `mp3_${closestSr}_256000`
  }
  
  if (targetService === 'elevenlabs') {
    if (isElevenlabsFormat(format)) {
      return format
    }
    
    l('Format not compatible with ElevenLabs. Using closest match.', { format })
    
    const parts = format.split('_')
    const sr = parseInt(parts[1] ?? '44100') || 44100
    const validSampleRates = [22050, 24000, 44100]
    const closestSr = validSampleRates.reduce((prev, curr) =>
      Math.abs(curr - sr) < Math.abs(prev - sr) ? curr : prev
    )
    
    return `mp3_${closestSr}_128`
  }
  
  return format
}

export function getExtensionFromMinimaxFormat(format: string): string {
  if (format.startsWith('mp3')) return 'mp3'
  if (format.startsWith('wav')) return 'wav'
  if (format.startsWith('pcm')) return 'pcm'
  return 'mp3'
}
