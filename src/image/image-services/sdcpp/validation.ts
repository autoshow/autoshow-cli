import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { l } from '@/logging'
import { MODEL_HASHES, getDownloadUrl } from './models'
import type { ValidationResult } from '@/image/image-types'

const p = '[image/sdcpp/validation]'

const resolveModelsDir = (modelsDir: string): string => {
  const possiblePaths = [
    modelsDir,
    join(process.cwd(), modelsDir),
    join('/app', modelsDir),
    './build/models/sd',
    '/app/build/models/sd'
  ]
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      l.dim(`${p} Using models directory: ${path}`)
      return path
    }
  }
  
  l.warn(`${p} Models directory not found in any of: ${possiblePaths.join(', ')}`)
  return modelsDir
}

export function ensureModelExists(modelPath: string, modelsDir: string): boolean {
  const resolvedModelsDir = resolveModelsDir(modelsDir)
  const fullPath = join(resolvedModelsDir, modelPath)
  const exists = existsSync(fullPath)
  
  l.dim(`${p} Checking model at: ${fullPath} - exists: ${exists}`)
  return exists
}

export function validateFile(filePath: string, modelsDir: string, minSizeMB?: number): ValidationResult {
  const resolvedModelsDir = resolveModelsDir(modelsDir)
  const fullPath = join(resolvedModelsDir, filePath)
  
  if (!existsSync(fullPath)) {
    return { valid: false, size: 0, error: `File not found: ${filePath}` }
  }
  
  try {
    const stats = statSync(fullPath)
    const sizeMB = stats.size / (1024 * 1024)
    
    const expectedRange = MODEL_HASHES[filePath]
    const minSize = minSizeMB || expectedRange?.minSizeMB || 1
    const maxSize = expectedRange?.maxSizeMB
    
    l.dim(`${p} Validating ${filePath}: ${sizeMB.toFixed(2)} MB`)
    
    if (sizeMB === 0) {
      return { 
        valid: false, 
        size: sizeMB, 
        error: `File is empty (0 bytes). Please delete and re-download: ${filePath}\nDownload from: ${getDownloadUrl(filePath)}` 
      }
    }
    
    if (sizeMB < minSize) {
      return { 
        valid: false, 
        size: sizeMB, 
        error: `File too small (${sizeMB.toFixed(2)} MB < ${minSize} MB). File may be corrupted.\nPlease delete and re-download from: ${getDownloadUrl(filePath)}` 
      }
    }
    
    if (maxSize && sizeMB > maxSize) {
      l.warn(`${p} File unusually large (${sizeMB.toFixed(2)} MB > ${maxSize} MB): ${filePath}`)
    }
    
    return { valid: true, size: sizeMB }
  } catch (error) {
    return { valid: false, size: 0, error: `Cannot read file: ${filePath}` }
  }
}

export function validateSD3Models(modelsDir: string): void {
  const requestId = Math.random().toString(36).substring(2, 10)
  const resolvedModelsDir = resolveModelsDir(modelsDir)
  
  const hasSD3Medium = ensureModelExists('sd3_medium_incl_clips_t5xxlfp16.safetensors', resolvedModelsDir)
  const hasSD35Large = ensureModelExists('sd3.5_large.safetensors', resolvedModelsDir)
  
  if (!hasSD3Medium && !hasSD35Large) {
    throw new Error('No SD3 model found. These are gated models requiring access approval:\n1. Visit https://huggingface.co/stabilityai/stable-diffusion-3-medium\n2. Request access and accept license\n3. Wait for approval then run setup again')
  }
  
  if (hasSD3Medium) {
    const validation = validateFile('sd3_medium_incl_clips_t5xxlfp16.safetensors', resolvedModelsDir)
    if (!validation.valid) {
      throw new Error(`SD3 Medium model validation failed: ${validation.error}`)
    }
    l.dim(`${p} [${requestId}] ✓ SD3 Medium validated (${validation.size.toFixed(2)} MB)`)
  }
  
  if (hasSD35Large && !hasSD3Medium) {
    const requiredModels = ['sd3.5_large.safetensors', 'clip_l.safetensors', 'clip_g.safetensors', 't5xxl_fp16.safetensors']
    for (const model of requiredModels) {
      const validation = validateFile(model, resolvedModelsDir)
      if (!validation.valid) {
        throw new Error(`Required model validation failed: ${validation.error}`)
      }
      l.dim(`${p} [${requestId}] ✓ ${model} validated (${validation.size.toFixed(2)} MB)`)
    }
  }
}

export function validateLoraModel(prompt: string, modelsDir: string): void {
  const loraMatch = prompt.match(/<lora:([^:]+):[\d.]+>/)
  if (loraMatch) {
    const loraName = loraMatch[1]
    if (!ensureModelExists(`${loraName}.safetensors`, modelsDir)) {
      throw new Error(`LoRA model not found: ${loraName}`)
    }
  }
}

export function checkMetalCompatibility(_modelType: string): { compatible: boolean; warning?: string } {
  return { compatible: true }
}