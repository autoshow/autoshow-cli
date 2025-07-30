import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { l, err } from '@/logging'
import type { ApiError } from '@/types'

const p = '[image/image-utils]'

export function generateUniqueFilename(prefix: string, extension: string = 'png'): string {
  const timestamp = generateTimestamp()
  const randomString = Math.random().toString(36).substring(2, 8)
  const makeFilename = (extra = '') => join('./output', `${prefix}-${timestamp}-${randomString}${extra}.${extension}`)
  const filepath = makeFilename()
  const finalPath = existsSync(filepath) ? makeFilename(`-${Math.random().toString(36).substring(2, 8)}`) : filepath
  l.dim(`${p} Generated ${existsSync(filepath) ? 'unique ' : ''}filename: ${finalPath.split('/').pop()}`)
  return finalPath
}

export const generateTimestamp = (): string => new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)

export function encodeImage(imagePath: string): string {
  l.dim(`${p} Encoding image: ${imagePath}`)
  if (!existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`)
  }
  return readFileSync(imagePath).toString('base64')
}

export function saveImage(base64Data: string, outputPath: string): void {
  const dir = outputPath.startsWith('/') ? dirname(outputPath) : join(process.cwd(), 'output')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const fullPath = outputPath.startsWith('/') ? outputPath : join(dir, outputPath)
  writeFileSync(fullPath, Buffer.from(base64Data, 'base64'))
  l.dim(`${p} Image saved to: ${fullPath}`)
}

export function parseResolution(value: string): { width: number; height: number } {
  const [width, height] = value.split('x').map(Number)
  if (!width || !height) {
    throw new Error('Resolution must be in format WIDTHxHEIGHT (e.g., 1024x1024)')
  }
  return { width, height }
}

const parseOption = (value: string, defaultValue: number, parser: (v: string) => number): number => {
  const parsed = parser(value)
  if (isNaN(parsed)) {
    l.warn(`${p} Invalid number "${value}", using default: ${defaultValue}`)
    return defaultValue
  }
  return parsed
}

export const parseIntOption = (value: string, defaultValue: number): number => parseOption(value, defaultValue, v => parseInt(v, 10))
export const parseFloatOption = (value: string, defaultValue: number): number => parseOption(value, defaultValue, parseFloat)

export const isApiError = (error: unknown): error is ApiError => 
  typeof error === 'object' && error !== null && 'message' in error && typeof (error as ApiError).message === 'string'

export const handleError = (error: any): void => {
  if (!isApiError(error)) {
    err(`${p} Unknown error: ${String(error)}`)
  }
  
  l.dim(`${p} Error details: ${JSON.stringify({ 
    name: error.name, 
    message: error.message, 
    code: error.$metadata?.httpStatusCode || error.code 
  })}`)
  
  const errorMap = {
    'content filters': 'Content blocked by AI safety policy',
    'ValidationException': `Validation error: ${error.message}`,
    "don't have access": `Access denied: ${error.message}\n\nPlease ensure:\n1. You have enabled the model in the console\n2. Your credentials have the necessary permissions\n3. The model is available in your current region`,
    'rate limit': `Rate limit exceeded: ${error.message}`,
    'Out of credits': `Out of credits: ${error.message}`
  }
  
  const matched = Object.entries(errorMap).find(([key]) => 
    error.name === key || error.message?.includes(key)
  )
  
  err(`${p} ${matched ? matched[1] : `Error: ${error.message}`}`)
}