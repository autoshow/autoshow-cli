import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { l } from '@/logging'

const p = '[music/music-utils]'

export function generateUniqueFilename(prefix: string, extension: string = 'wav'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const randomString = Math.random().toString(36).substring(2, 8)
  const makeFilename = (extra = '') => join('./output', `${prefix}-${timestamp}-${randomString}${extra}.${extension}`)
  const filepath = makeFilename()
  const finalPath = existsSync(filepath) ? makeFilename(`-${Math.random().toString(36).substring(2, 8)}`) : filepath
  l.dim(`${p} Generated unique filename: ${finalPath}`)
  return finalPath
}

export function validateMusicOptions(options: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (options.duration) {
    const duration = parseFloat(options.duration)
    if (isNaN(duration) || duration <= 0 || duration > 30) {
      errors.push('Duration must be between 0 and 30 seconds')
    }
  }
  
  if (options.temperature) {
    const temp = parseFloat(options.temperature)
    if (isNaN(temp) || temp <= 0 || temp > 2) {
      errors.push('Temperature must be between 0 and 2')
    }
  }
  
  if (options.topK) {
    const topK = parseInt(options.topK, 10)
    if (isNaN(topK) || topK < 0) {
      errors.push('Top-K must be a positive integer')
    }
  }
  
  if (options.topP) {
    const topP = parseFloat(options.topP)
    if (isNaN(topP) || topP < 0 || topP > 1) {
      errors.push('Top-P must be between 0 and 1')
    }
  }
  
  if (options.melody && !existsSync(options.melody)) {
    errors.push(`Melody file not found: ${options.melody}`)
  }
  
  if (options.continuation && !existsSync(options.continuation)) {
    errors.push(`Continuation file not found: ${options.continuation}`)
  }
  
  return { valid: errors.length === 0, errors }
}

export function getModelDescription(model: string): string {
  const descriptions: Record<string, string> = {
    'facebook/musicgen-small': 'Small model (300M parameters) - Fast, lower quality',
    'facebook/musicgen-medium': 'Medium model (1.5B parameters) - Balanced speed and quality',
    'facebook/musicgen-large': 'Large model (3.3B parameters) - Best quality, slower',
    'facebook/musicgen-melody': 'Medium model with melody conditioning support',
    'facebook/musicgen-melody-large': 'Large model with melody conditioning support',
    'facebook/musicgen-stereo-small': 'Small stereo model',
    'facebook/musicgen-stereo-medium': 'Medium stereo model',
    'facebook/musicgen-stereo-large': 'Large stereo model',
    'facebook/musicgen-stereo-melody': 'Medium stereo model with melody conditioning',
    'facebook/musicgen-stereo-melody-large': 'Large stereo model with melody conditioning'
  }
  
  return descriptions[model] || 'Unknown model'
}