import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { l, err } from '@/logging'
import type { ApiError } from '@/video/video-types'

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
    'quota exceeded': 'API quota exceeded. Please check your API limits',
    'Invalid API key': 'Invalid API key. Please check your API key',
    'rate limit': `Rate limit exceeded: ${error.message}`,
    'ValidationException': `Validation error: ${error.message}`,
    'insufficient permissions': `Insufficient permissions: ${error.message}\n\nPlease ensure your API key has the necessary permissions`,
    'RUNWAYML_API_SECRET': 'Missing Runway API key. Please set RUNWAYML_API_SECRET in your .env file',
    'GEMINI_API_KEY': 'Missing Gemini API key. Please set GEMINI_API_KEY in your .env file',
    'HunyuanVideo not configured': 'HunyuanVideo models not installed. Please run: bash .github/setup/video/hunyuan.sh',
    'CUDA out of memory': 'GPU memory insufficient. Try using --use-fp8 or hunyuan-540p model',
    'Model path does not exist': 'HunyuanVideo model not downloaded. Run: bash .github/setup/video/models.sh',
    'CogVideoX not configured': 'CogVideoX not installed. Please run: bash .github/setup/video/cogvideo.sh',
    'No module named': 'Missing Python dependencies. Re-run the setup script'
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

export function validateRunwayModel(model: string): boolean {
  const validModels = ['gen4_turbo', 'gen3a_turbo']
  return validModels.includes(model)
}

export function validateHunyuanModel(model: string): boolean {
  const validModels = ['hunyuan-720p', 'hunyuan-540p', 'hunyuan-fp8']
  return validModels.includes(model)
}

export function validateCogVideoModel(model: string): boolean {
  const validModels = ['cogvideo-2b', 'cogvideo-5b', 'cogvideo-5b-i2v']
  return validModels.includes(model)
}

export function parseAspectRatio(value: string): '16:9' | '9:16' | '4:3' | '3:4' | '1:1' | undefined {
  const validRatios = ['16:9', '9:16', '4:3', '3:4', '1:1']
  if (validRatios.includes(value)) {
    return value as '16:9' | '9:16' | '4:3' | '3:4' | '1:1'
  }
  l.warn(`${p} Invalid aspect ratio "${value}". Using default 16:9`)
  return '16:9'
}