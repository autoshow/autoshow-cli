import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { l, err } from '@/logging'
import type { ApiError } from '@/types'

const p = '[video/video-utils]'

export function generateUniqueFilename(prefix: string, extension: string = 'mp4'): string {
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

export function validateVideoModel(model: string): boolean {
  const validModels = ['veo-3.0-generate-preview', 'veo-3.0-fast-generate-preview', 'veo-2.0-generate-001']
  return validModels.includes(model)
}

export function parseAspectRatio(value: string): '16:9' | '9:16' | undefined {
  if (value === '16:9' || value === '9:16') {
    return value
  }
  l.warn(`${p} Invalid aspect ratio "${value}". Using default 16:9`)
  return '16:9'
}