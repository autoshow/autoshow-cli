import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { l, err } from '@/logging'
import type { ApiError, WeightedPrompt, MusicGenerationConfig, MusicScale, MusicGenerationMode } from '@/types'

const p = '[music/music-utils]'

export function generateUniqueFilename(prefix: string, extension: string = 'wav'): string {
  const timestamp = generateTimestamp()
  const randomString = Math.random().toString(36).substring(2, 8)
  const makeFilename = (extra = '') => join('./output', `${prefix}-${timestamp}-${randomString}${extra}.${extension}`)
  const filepath = makeFilename()
  const finalPath = existsSync(filepath) ? makeFilename(`-${Math.random().toString(36).substring(2, 8)}`) : filepath
  return finalPath
}

export const generateTimestamp = (): string => new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)

export const isApiError = (error: unknown): error is ApiError => 
  typeof error === 'object' && error !== null && 'message' in error && typeof (error as ApiError).message === 'string'

export const handleError = (error: any): void => {
  if (!isApiError(error)) {
    err(`${p} Unknown error: ${String(error)}`)
  }
  
  const errorMap = {
    'quota exceeded': 'API quota exceeded. Please check your Gemini API limits',
    'Invalid API key': 'Invalid Gemini API key. Please check your GEMINI_API_KEY',
    'rate limit': `Rate limit exceeded: ${error.message}`,
    'ValidationException': `Validation error: ${error.message}`,
    'insufficient permissions': `Insufficient permissions: ${error.message}\n\nPlease ensure your API key has the necessary permissions`
  }
  
  const matched = Object.entries(errorMap).find(([key]) => 
    error.name === key || error.message?.includes(key)
  )
  
  err(`${p} ${matched ? matched[1] : `Error: ${error.message}`}`)
}

export function ensureOutputDirectory(outputPath: string): void {
  const dir = dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function parseWeightedPrompts(promptString: string): WeightedPrompt[] {
  const prompts = promptString.split(',').map(p => {
    const parts = p.trim().split(':')
    if (parts.length === 2) {
      return {
        text: parts[0]?.trim() || '',
        weight: parseFloat(parts[1] || '1.0')
      }
    }
    return {
      text: p.trim(),
      weight: 1.0
    }
  })
  
  l.dim(`${p} Parsed prompts: ${JSON.stringify(prompts)}`)
  return prompts
}

export function validateMusicConfig(config: any): MusicGenerationConfig {
  const validated: MusicGenerationConfig = {}
  
  if (config.guidance !== undefined) {
    const guidance = parseFloat(config.guidance)
    if (guidance >= 0 && guidance <= 6) {
      validated.guidance = guidance
    } else {
      l.warn(`${p} Invalid guidance value ${guidance}, using default 4.0`)
      validated.guidance = 4.0
    }
  }
  
  if (config.bpm !== undefined) {
    const bpm = parseInt(config.bpm)
    if (bpm >= 60 && bpm <= 200) {
      validated.bpm = bpm
    } else {
      l.warn(`${p} Invalid BPM ${bpm}, must be between 60-200`)
    }
  }
  
  if (config.density !== undefined) {
    const density = parseFloat(config.density)
    if (density >= 0 && density <= 1) {
      validated.density = density
    } else {
      l.warn(`${p} Invalid density ${density}, must be between 0-1`)
    }
  }
  
  if (config.brightness !== undefined) {
    const brightness = parseFloat(config.brightness)
    if (brightness >= 0 && brightness <= 1) {
      validated.brightness = brightness
    } else {
      l.warn(`${p} Invalid brightness ${brightness}, must be between 0-1`)
    }
  }
  
  if (config.scale) {
    validated.scale = config.scale as MusicScale
  }
  
  validated.muteBass = config.muteBass || false
  validated.muteDrums = config.muteDrums || false
  validated.onlyBassAndDrums = config.onlyBassAndDrums || false
  
  if (config.musicGenerationMode) {
    validated.musicGenerationMode = config.musicGenerationMode as MusicGenerationMode
  }
  
  if (config.temperature !== undefined) {
    const temp = parseFloat(config.temperature)
    if (temp >= 0 && temp <= 3) {
      validated.temperature = temp
    } else {
      l.warn(`${p} Invalid temperature ${temp}, using default 1.1`)
      validated.temperature = 1.1
    }
  }
  
  if (config.topK !== undefined) {
    const topK = parseInt(config.topK)
    if (topK >= 1 && topK <= 1000) {
      validated.topK = topK
    }
  }
  
  if (config.seed !== undefined) {
    validated.seed = parseInt(config.seed)
  }
  
  l.dim(`${p} Validated config: ${JSON.stringify(validated)}`)
  return validated
}

export function convertPcmToWav(pcmData: Buffer): Buffer {
  const sampleRate = 48000
  const channels = 2
  const bitsPerSample = 16
  
  const wavHeader = Buffer.alloc(44)
  
  wavHeader.write('RIFF', 0)
  wavHeader.writeUInt32LE(36 + pcmData.length, 4)
  wavHeader.write('WAVE', 8)
  wavHeader.write('fmt ', 12)
  wavHeader.writeUInt32LE(16, 16)
  wavHeader.writeUInt16LE(1, 20)
  wavHeader.writeUInt16LE(channels, 22)
  wavHeader.writeUInt32LE(sampleRate, 24)
  wavHeader.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28)
  wavHeader.writeUInt16LE(channels * (bitsPerSample / 8), 32)
  wavHeader.writeUInt16LE(bitsPerSample, 34)
  wavHeader.write('data', 36)
  wavHeader.writeUInt32LE(pcmData.length, 40)
  
  return Buffer.concat([wavHeader, pcmData])
}