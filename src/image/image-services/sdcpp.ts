import { execSync } from 'child_process'
import { existsSync, mkdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError } from '../image-utils.ts'
import type { ImageGenerationResult, StableDiffusionCppOptions } from '@/types'

const MODELS_DIR = 'models/sd'
const BIN_PATH = 'bin/sd'

const MODEL_HASHES: Record<string, { hash?: string; minSizeMB: number; maxSizeMB: number }> = {
  'v1-5-pruned-emaonly.safetensors': { minSizeMB: 1600, maxSizeMB: 2000 },
  'sd3_medium_incl_clips_t5xxlfp16.safetensors': { minSizeMB: 5400, maxSizeMB: 5600 },
  'sd3.5_large.safetensors': { minSizeMB: 6500, maxSizeMB: 7000 },
  'flux1-kontext-dev-q8_0.gguf': { minSizeMB: 12000, maxSizeMB: 13000 },
  'ae.safetensors': { minSizeMB: 100, maxSizeMB: 200 },
  'clip_l.safetensors': { minSizeMB: 240, maxSizeMB: 250 },
  'clip_g.safetensors': { minSizeMB: 690, maxSizeMB: 710 },
  't5xxl_fp16.safetensors': { minSizeMB: 9000, maxSizeMB: 9200 }
}

function ensureModelExists(modelPath: string): boolean {
  const fullPath = join(MODELS_DIR, modelPath)
  return existsSync(fullPath)
}

function validateFile(filePath: string, minSizeMB?: number): { valid: boolean; size: number; error?: string } {
  const p = '[image/sdcpp/validate]'
  const fullPath = join(MODELS_DIR, filePath)
  
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

function getDownloadUrl(filename: string): string {
  const urls: Record<string, string> = {
    'ae.safetensors': 'https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/ae.safetensors',
    'sd3_medium_incl_clips_t5xxlfp16.safetensors': 'https://huggingface.co/stabilityai/stable-diffusion-3-medium/blob/main/sd3_medium_incl_clips_t5xxlfp16.safetensors',
    'sd3.5_large.safetensors': 'https://huggingface.co/stabilityai/stable-diffusion-3.5-large/blob/main/sd3.5_large.safetensors',
    'clip_l.safetensors': 'https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/blob/main/text_encoders/clip_l.safetensors',
    'clip_g.safetensors': 'https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/blob/main/text_encoders/clip_g.safetensors',
    't5xxl_fp16.safetensors': 'https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/blob/main/text_encoders/t5xxl_fp16.safetensors',
    'flux1-kontext-dev-q8_0.gguf': 'https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF/blob/main/flux1-kontext-dev-Q8_0.gguf',
    'v1-5-pruned-emaonly.safetensors': 'https://huggingface.co/runwayml/stable-diffusion-v1-5/blob/main/v1-5-pruned-emaonly.safetensors'
  }
  return urls[filename] || 'Unknown source'
}

function buildCommand(prompt: string, outputPath: string, options: Partial<StableDiffusionCppOptions>): string[] {
  const args = [BIN_PATH]
  const p = '[image/sdcpp/build]'
  
  if (options.model === 'sd3.5' || options.model === 'sd3-medium') {
    const hasSD3Medium = ensureModelExists('sd3_medium_incl_clips_t5xxlfp16.safetensors')
    const hasSD35Large = ensureModelExists('sd3.5_large.safetensors')
    
    if (hasSD3Medium) {
      l.dim(`${p} Using SD3 Medium all-in-one model`)
      args.push('-m', join(MODELS_DIR, 'sd3_medium_incl_clips_t5xxlfp16.safetensors'))
    } else if (hasSD35Large) {
      l.dim(`${p} Using SD3.5 Large with separate encoders`)
      args.push('-m', join(MODELS_DIR, 'sd3.5_large.safetensors'))
      args.push('--clip_l', join(MODELS_DIR, 'clip_l.safetensors'))
      args.push('--clip_g', join(MODELS_DIR, 'clip_g.safetensors'))
      args.push('--t5xxl', join(MODELS_DIR, 't5xxl_fp16.safetensors'))
    } else {
      throw new Error('No SD3 model found. Expected sd3_medium_incl_clips_t5xxlfp16.safetensors or sd3.5_large.safetensors')
    }
    
    args.push('-H', '1024', '-W', '1024')
    args.push('--cfg-scale', '4.5')
    args.push('--sampling-method', 'euler')
  } else if (options.model === 'flux-kontext') {
    args.push('--diffusion-model', join(MODELS_DIR, 'flux1-kontext-dev-q8_0.gguf'))
    args.push('--vae', join(MODELS_DIR, 'ae.safetensors'))
    args.push('--clip_l', join(MODELS_DIR, 'clip_l.safetensors'))
    args.push('--t5xxl', join(MODELS_DIR, 't5xxl_fp16.safetensors'))
    args.push('--cfg-scale', '1.0')
    args.push('--sampling-method', 'euler')
    if (options.referenceImage) {
      args.push('-r', options.referenceImage)
    }
  } else {
    args.push('-m', join(MODELS_DIR, 'v1-5-pruned-emaonly.safetensors'))
    if (options.lora) {
      args.push('--lora-model-dir', MODELS_DIR)
    }
  }
  
  args.push('-p', prompt)
  args.push('-o', outputPath)
  
  if (options.negativePrompt) {
    args.push('-n', options.negativePrompt)
  }
  
  if (options.width && options.height && options.model !== 'sd3.5' && options.model !== 'sd3-medium') {
    args.push('-W', options.width.toString())
    args.push('-H', options.height.toString())
  }
  
  if (options.steps) {
    args.push('--steps', options.steps.toString())
  }
  
  if (options.seed) {
    args.push('-s', options.seed.toString())
  } else {
    args.push('-s', Math.floor(Math.random() * 1000000).toString())
  }
  
  if (options.cfgScale && options.model !== 'sd3.5' && options.model !== 'sd3-medium' && options.model !== 'flux-kontext') {
    args.push('--cfg-scale', options.cfgScale.toString())
  }
  
  if (options.samplingMethod && options.model !== 'sd3.5' && options.model !== 'sd3-medium' && options.model !== 'flux-kontext') {
    args.push('--sampling-method', options.samplingMethod)
  }
  
  if (options.flashAttention) {
    args.push('--diffusion-fa')
  }
  
  if (options.quantization) {
    args.push('--type', options.quantization)
  }
  
  args.push('-v')
  
  return args
}

export async function generateImageWithStableDiffusionCpp(
  prompt: string,
  outputPath?: string,
  options: Partial<StableDiffusionCppOptions> = {}
): Promise<ImageGenerationResult> {
  const p = '[image/image-services/sdcpp]'
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = outputPath || generateUniqueFilename('sdcpp', 'png')
  
  try {
    if (!existsSync(BIN_PATH)) {
      throw new Error('stable-diffusion.cpp not installed. Run: npm run setup')
    }
    
    const modelType = options.model || 'sd1.5'
    l.dim(`${p} [${requestId}] Using model type: ${modelType}`)
    
    if (modelType === 'sd3.5' || modelType === 'sd3-medium') {
      const hasSD3Medium = ensureModelExists('sd3_medium_incl_clips_t5xxlfp16.safetensors')
      const hasSD35Large = ensureModelExists('sd3.5_large.safetensors')
      
      if (!hasSD3Medium && !hasSD35Large) {
        throw new Error('No SD3 model found. Download sd3_medium_incl_clips_t5xxlfp16.safetensors or sd3.5_large.safetensors')
      }
      
      if (hasSD3Medium) {
        const validation = validateFile('sd3_medium_incl_clips_t5xxlfp16.safetensors')
        if (!validation.valid) {
          throw new Error(`SD3 Medium model validation failed: ${validation.error}`)
        }
        l.dim(`${p} [${requestId}] ✓ SD3 Medium validated (${validation.size.toFixed(2)} MB)`)
      }
      
      if (hasSD35Large && !hasSD3Medium) {
        const requiredModels = ['sd3.5_large.safetensors', 'clip_l.safetensors', 'clip_g.safetensors', 't5xxl_fp16.safetensors']
        for (const model of requiredModels) {
          const validation = validateFile(model)
          if (!validation.valid) {
            throw new Error(`Required model validation failed: ${validation.error}`)
          }
          l.dim(`${p} [${requestId}] ✓ ${model} validated (${validation.size.toFixed(2)} MB)`)
        }
      }
    } else if (modelType === 'flux-kontext') {
      const requiredModels = [
        { file: 'flux1-kontext-dev-q8_0.gguf', desc: 'FLUX Kontext model' },
        { file: 'ae.safetensors', desc: 'FLUX VAE' },
        { file: 'clip_l.safetensors', desc: 'CLIP-L encoder' },
        { file: 't5xxl_fp16.safetensors', desc: 'T5XXL encoder' }
      ]
      
      const failedModels: string[] = []
      for (const model of requiredModels) {
        const validation = validateFile(model.file)
        if (!validation.valid) {
          failedModels.push(`\n  • ${model.desc}: ${validation.error}`)
        } else {
          l.dim(`${p} [${requestId}] ✓ ${model.file} validated (${validation.size.toFixed(2)} MB)`)
        }
      }
      
      if (failedModels.length > 0) {
        throw new Error(`Model validation failed:${failedModels.join('')}\n\nTo fix: Delete corrupted files and run 'npm run setup' again`)
      }
    } else if (!ensureModelExists('v1-5-pruned-emaonly.safetensors')) {
      throw new Error('SD 1.5 model not found')
    }
    
    if (options.lora && prompt.includes('<lora:')) {
      const loraMatch = prompt.match(/<lora:([^:]+):[\d.]+>/)
      if (loraMatch) {
        const loraName = loraMatch[1]
        if (!ensureModelExists(`${loraName}.safetensors`)) {
          throw new Error(`LoRA model not found: ${loraName}`)
        }
      }
    }
    
    const outputDir = dirname(uniqueOutputPath)
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }
    
    const fullPrompt = options.lora ? prompt : prompt.replace(/<lora:[^>]+>/g, '')
    
    const args = buildCommand(fullPrompt, uniqueOutputPath, options)
    
    l.opts(`${p} [${requestId}] Running: ${args[0]} with ${modelType}`)
    l.dim(`${p} [${requestId}] Command: ${args.slice(1, 5).join(' ')}...`)
    
    const result = execSync(args.map(arg => `"${arg}"`).join(' '), {
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024
    })
    
    const hasError = result.toLowerCase().includes('[error]') || !existsSync(uniqueOutputPath)
    
    if (hasError) {
      const errorLines = result.split('\n').filter(line => line.toLowerCase().includes('error'))
      l.warn(`${p} [${requestId}] Errors found in output:`)
      errorLines.forEach(line => l.warn(`${p} [${requestId}] ${line.trim()}`))
      
      if (result.includes('init model loader from file failed')) {
        throw new Error(`Model file cannot be loaded. The file may be corrupted or incompatible.\nTry deleting and re-downloading from: ${getDownloadUrl(modelType === 'sd3-medium' ? 'sd3_medium_incl_clips_t5xxlfp16.safetensors' : 'sd3.5_large.safetensors')}`)
      }
      
      if (result.includes('tensor') && result.includes('not in model file')) {
        throw new Error('Model file is missing required tensors. Please re-download the model.')
      }
      
      throw new Error('Generation failed: Check logs for details')
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.success(`${p} [${requestId}] Generated in ${duration}s: ${uniqueOutputPath}`)
    
    return {
      success: true,
      path: uniqueOutputPath,
      seed: options.seed || 0
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.warn(`${p} [${requestId}] Failed in ${duration}s: ${isApiError(error) ? error.message : 'Unknown'}`)
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}