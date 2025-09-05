import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError } from '@/image/image-utils'
import { 
  ensureModelExists, 
  validateFile, 
  validateSD3Models, 
  validateLoraModel,
  checkMetalCompatibility
} from './validation'
import { 
  buildCommand, 
  preprocessPrompt, 
  parseExecutionOutput, 
  interpretError 
} from './command-builder'
import { MODELS_DIR, BIN_PATH, ModelTypes } from './models'
import type { ImageGenerationResult, StableDiffusionCppOptions } from '@/image/image-types'

export async function generateImageWithStableDiffusionCpp(
  prompt: string,
  outputPath?: string,
  options: Partial<StableDiffusionCppOptions> = {}
): Promise<ImageGenerationResult> {
  const p = '[image/image-services/sdcpp/generator]'
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = outputPath || generateUniqueFilename('sdcpp', 'png')
  
  try {
    l.dim(`${p} [${requestId}] Validating binary exists at: ${BIN_PATH}`)
    validateBinaryExists()
    
    const modelType = options.model || ModelTypes.SD15
    l.dim(`${p} [${requestId}] Using model type: ${modelType}`)
    l.dim(`${p} [${requestId}] Using models directory: ${MODELS_DIR}`)
    
    const metalCheck = checkMetalCompatibility(modelType)
    if (!metalCheck.compatible) {
      if (!options.cpuOnly) {
        l.warn(`${p} [${requestId}] ${metalCheck.warning}`)
        l.dim(`${p} [${requestId}] Attempting CPU-only mode`)
        options.cpuOnly = true
      }
    }
    
    validateModels(modelType, options, requestId, prompt)
    
    const outputDir = dirname(uniqueOutputPath)
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }
    
    const fullPrompt = preprocessPrompt(prompt, !!options.lora)
    const args = buildCommand(fullPrompt, uniqueOutputPath, options, BIN_PATH, MODELS_DIR)
    
    l.opts(`${p} [${requestId}] Running: ${args[0]} with ${modelType}${options.cpuOnly ? ' (CPU-only attempt)' : ''}`)
    l.dim(`${p} [${requestId}] Command: ${args.slice(1, 5).join(' ')}...`)
    
    const result = executeCommand(args, options.cpuOnly)
    validateOutput(result, uniqueOutputPath, modelType, requestId, options)
    
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

function validateBinaryExists(): void {
  const p = '[image/image-services/sdcpp/generator]'
  if (!existsSync(BIN_PATH)) {
    l.warn(`${p} Binary not found at: ${BIN_PATH}`)
    throw new Error('stable-diffusion.cpp not installed. Run: npm run setup')
  }
  l.dim(`${p} Binary validated at: ${BIN_PATH}`)
}

function validateModels(
  modelType: string, 
  options: Partial<StableDiffusionCppOptions>, 
  requestId: string,
  prompt: string
): void {
  const p = '[image/image-services/sdcpp/generator]'
  
  if (modelType === ModelTypes.SD35 || modelType === ModelTypes.SD3_MEDIUM) {
    l.dim(`${p} [${requestId}] Validating SD3 models in: ${MODELS_DIR}`)
    validateSD3Models(MODELS_DIR)
  } else if (!ensureModelExists('v1-5-pruned-emaonly.safetensors', MODELS_DIR)) {
    l.warn(`${p} [${requestId}] SD 1.5 model not found in: ${MODELS_DIR}`)
    throw new Error('SD 1.5 model not found')
  } else {
    const validation = validateFile('v1-5-pruned-emaonly.safetensors', MODELS_DIR)
    if (!validation.valid) {
      throw new Error(`SD 1.5 model validation failed: ${validation.error}`)
    }
    l.dim(`${p} [${requestId}] ✓ SD 1.5 validated (${validation.size.toFixed(2)} MB)`)
  }
  
  if (options.lora && prompt.includes('<lora:')) {
    l.dim(`${p} [${requestId}] Validating LoRA model for prompt`)
    validateLoraModel(prompt, MODELS_DIR)
  }
}

function executeCommand(args: string[], cpuOnly?: boolean): string {
  const p = '[image/image-services/sdcpp/generator]'
  const env = { ...process.env }
  
  if (cpuOnly && process.platform === 'darwin') {
    l.dim(`${p} Setting GGML_METAL=0 to disable Metal acceleration`)
    env['GGML_METAL'] = '0'
  }
  
  return execSync(args.map(arg => `"${arg}"`).join(' '), {
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 10 * 1024 * 1024,
    env
  })
}

function validateOutput(
  result: string, 
  outputPath: string, 
  modelType: string, 
  requestId: string,
  _options: Partial<StableDiffusionCppOptions>
): { success: boolean; isMetalError?: boolean } {
  const p = '[image/image-services/sdcpp/generator]'
  const { hasError, errorLines, isMetalError } = parseExecutionOutput(result)
  
  if (hasError || isMetalError || !existsSync(outputPath)) {
    if (errorLines.length > 0) {
      l.warn(`${p} [${requestId}] Errors found in output:`)
      errorLines.forEach(line => l.warn(`${p} [${requestId}] ${line.trim()}`))
    }
    
    const errorMessage = interpretError(result, modelType)
    throw new Error(errorMessage)
  }
  
  l.dim(`${p} [${requestId}] Output validation successful: ${outputPath}`)
  return { success: true }
}