import { join } from 'path'
import { l } from '@/logging'
import { ensureModelExists } from './validation'
import type { StableDiffusionCppOptions } from '@/image/image-types'

export function buildCommand(
  prompt: string, 
  outputPath: string, 
  options: Partial<StableDiffusionCppOptions>,
  binPath: string,
  modelsDir: string
): string[] {
  const args = [binPath]
  const p = '[image/sdcpp/command-builder]'
  
  if (options.cpuOnly && process.platform === 'darwin') {
    l.dim(`${p} CPU-only mode enabled (Metal will be disabled via environment variable)`)
  }
  
  if (options.model === 'sd3.5' || options.model === 'sd3-medium') {
    buildSD3Command(args, modelsDir, p)
  } else {
    buildSD15Command(args, modelsDir, options)
  }
  
  args.push('-p', prompt)
  args.push('-o', outputPath)
  
  addCommonOptions(args, options)
  
  args.push('-v')
  
  return args
}

function buildSD3Command(args: string[], modelsDir: string, p: string): void {
  const hasSD3Medium = ensureModelExists('sd3_medium_incl_clips_t5xxlfp16.safetensors', modelsDir)
  const hasSD35Large = ensureModelExists('sd3.5_large.safetensors', modelsDir)
  
  if (hasSD3Medium) {
    l.dim(`${p} Using SD3 Medium all-in-one model`)
    args.push('-m', join(modelsDir, 'sd3_medium_incl_clips_t5xxlfp16.safetensors'))
  } else if (hasSD35Large) {
    l.dim(`${p} Using SD3.5 Large with separate encoders`)
    args.push('-m', join(modelsDir, 'sd3.5_large.safetensors'))
    args.push('--clip_l', join(modelsDir, 'clip_l.safetensors'))
    args.push('--clip_g', join(modelsDir, 'clip_g.safetensors'))
    args.push('--t5xxl', join(modelsDir, 't5xxl_fp16.safetensors'))
  } else {
    throw new Error('No SD3 model found. Expected sd3_medium_incl_clips_t5xxlfp16.safetensors or sd3.5_large.safetensors')
  }
  
  args.push('-H', '1024', '-W', '1024')
  args.push('--cfg-scale', '4.5')
  args.push('--sampling-method', 'euler')
}

function buildSD15Command(
  args: string[], 
  modelsDir: string, 
  options: Partial<StableDiffusionCppOptions>
): void {
  args.push('-m', join(modelsDir, 'v1-5-pruned-emaonly.safetensors'))
  
  if (options.lora) {
    args.push('--lora-model-dir', modelsDir)
  }
}

function addCommonOptions(args: string[], options: Partial<StableDiffusionCppOptions>): void {
  if (options.negativePrompt) {
    args.push('-n', options.negativePrompt)
  }
  
  const isSD3 = options.model === 'sd3.5' || options.model === 'sd3-medium'
  
  if (options.width && options.height && !isSD3) {
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
  
  if (options.cfgScale && !isSD3) {
    args.push('--cfg-scale', options.cfgScale.toString())
  }
  
  if (options.samplingMethod && !isSD3) {
    args.push('--sampling-method', options.samplingMethod)
  }
  
  if (options.flashAttention) {
    args.push('--diffusion-fa')
  }
  
  if (options.quantization) {
    args.push('--type', options.quantization)
  }
}

export function preprocessPrompt(prompt: string, hasLora: boolean): string {
  return hasLora ? prompt : prompt.replace(/<lora:[^>]+>/g, '')
}

export function parseExecutionOutput(output: string): { hasError: boolean; errorLines: string[]; isMetalError: boolean } {
  const hasError = output.toLowerCase().includes('[error]')
  const isMetalError = output.includes('unsupported op') && output.includes('ggml-metal')
  const errorLines = hasError || isMetalError
    ? output.split('\n').filter(line => 
        line.toLowerCase().includes('error') || 
        line.includes('unsupported op'))
    : []
  
  return { hasError, errorLines, isMetalError }
}

export function interpretError(output: string, modelType: string): string {
  if (output.includes('unsupported op') && output.includes('ggml-metal')) {
    return `Metal backend error: The model uses unsupported operations.\nThis model may not be compatible with macOS.`
  }
  
  if (output.includes('init model loader from file failed')) {
    if (modelType === 'sd3.5' || modelType === 'sd3-medium') {
      return `SD3 model file cannot be loaded. This is a gated model requiring access approval:\n1. Visit https://huggingface.co/stabilityai/stable-diffusion-3-medium\n2. Request access and accept license\n3. Wait for approval then download the model manually`
    }
    return `Model file cannot be loaded. The file may be corrupted or incompatible.\nTry deleting and re-downloading from the appropriate source`
  }
  
  if (output.includes('tensor') && output.includes('not in model file')) {
    return 'Model file is missing required tensors. Please re-download the model.'
  }
  
  return 'Generation failed: Check logs for details'
}