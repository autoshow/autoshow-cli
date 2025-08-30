import { spawn } from 'child_process'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError, ensureOutputDirectory } from '../video-utils.ts'
import { existsSync, readFileSync } from '@/node-utils'
import type { VideoGenerationResult, HunyuanGenerateOptions, HunyuanConfig } from '@/video/video-types.ts'

const p = '[video/video-services/hunyuan]'

function loadHunyuanConfig(): HunyuanConfig | null {
  const configPath = 'build/config/.hunyuan-config.json'
  l.dim(`${p} Loading config from: ${configPath}`)
  if (!existsSync(configPath)) {
    l.warn(`${p} HunyuanVideo config not found at ${configPath}`)
    return null
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configContent) as HunyuanConfig
    l.dim(`${p} Loaded HunyuanVideo config from ${configPath}`)
    return config
  } catch (error) {
    l.warn(`${p} Failed to parse HunyuanVideo config: ${isApiError(error) ? error.message : 'Unknown error'}`)
    return null
  }
}

function mapHunyuanModelToPath(model: string, config: HunyuanConfig): string | null {
  const modelKey = model.toLowerCase().replace('hunyuan-', '')
  const modelPath = config.available_models[modelKey] || null
  if (modelPath) {
    l.dim(`${p} Mapped model ${model} to path: ${modelPath}`)
  } else {
    l.warn(`${p} No mapping found for model: ${model}`)
  }
  return modelPath
}

function getResolutionForConfig(
  quality: '720p' | '540p',
  aspectRatio: string,
  config: HunyuanConfig
): { width: number; height: number } {
  const resolutions = config.resolutions[quality]
  if (resolutions && resolutions[aspectRatio]) {
    const [h, w] = resolutions[aspectRatio]
    return { width: w, height: h }
  }
  return quality === '720p' ? { width: 1280, height: 720 } : { width: 960, height: 544 }
}

export async function generateVideoWithHunyuan(
  prompt: string,
  options: HunyuanGenerateOptions = {}
): Promise<VideoGenerationResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('hunyuan', 'mp4')
  
  try {
    l.dim(`${p} [${requestId}] Loading HunyuanVideo configuration`)
    const config = loadHunyuanConfig()
    if (!config) {
      throw new Error('HunyuanVideo not configured. Please run: bash .github/setup/video/hunyuan.sh')
    }
    
    const model = options.model || 'hunyuan-720p'
    const modelPath = mapHunyuanModelToPath(model, config)
    
    if (!modelPath) {
      throw new Error(`Model ${model} not found in config. Available models: ${Object.keys(config.available_models).join(', ')}`)
    }
    
    l.dim(`${p} [${requestId}] Checking model path: ${modelPath}`)
    if (!existsSync(modelPath)) {
      throw new Error(`Model path does not exist: ${modelPath}. Please download the model first.`)
    }
    
    l.opts(`${p} [${requestId}] Generating video with HunyuanVideo model: ${model}`)
    l.dim(`${p} [${requestId}] Prompt: ${prompt}`)
    l.dim(`${p} [${requestId}] Model path: ${modelPath}`)
    
    const quality = model.includes('540p') ? '540p' : '720p'
    const aspectRatio = options.aspectRatio || '16:9'
    const resolution = options.resolution || getResolutionForConfig(quality, aspectRatio, config)
    const guidanceScale = options.guidanceScale || 6.0
    const flowShift = options.flowShift || 7.0
    const useFp8 = model.includes('fp8') || options.useFp8 || false
    
    l.dim(`${p} [${requestId}] Resolution: ${resolution.width}x${resolution.height}`)
    l.dim(`${p} [${requestId}] Guidance scale: ${guidanceScale}, Flow shift: ${flowShift}`)
    l.dim(`${p} [${requestId}] Using FP8: ${useFp8}`)
    
    ensureOutputDirectory(uniqueOutputPath)
    
    const pythonConfig = {
      model_path: modelPath,
      prompt: prompt,
      output_path: uniqueOutputPath,
      width: resolution.width,
      height: resolution.height,
      num_frames: options.numFrames || 129,
      guidance_scale: guidanceScale,
      negative_prompt: options.negativePrompt || '',
      num_inference_steps: options.numInferenceSteps || 50,
      flow_shift: flowShift,
      seed: options.seed || null,
      use_fp8: useFp8,
      use_cpu_offload: options.useCpuOffload !== false
    }
    
    const scriptPath = `${config.models_dir}/hunyuan_wrapper.py`
    l.dim(`${p} [${requestId}] Using wrapper script: ${scriptPath}`)
    if (!existsSync(scriptPath)) {
      throw new Error('HunyuanVideo wrapper script not found. Please re-run: bash .github/setup/video/hunyuan.sh')
    }
    
    l.dim(`${p} [${requestId}] Starting Python process with script: ${scriptPath}`)
    l.dim(`${p} [${requestId}] Config: ${JSON.stringify(pythonConfig, null, 2)}`)
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(config.python, [scriptPath, JSON.stringify(pythonConfig)], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      })
      
      let output = ''
      let errorOutput = ''
      
      pythonProcess.stdout.on('data', (data) => {
        const text = data.toString()
        output += text
        if (text.includes('Loading HunyuanVideo')) {
          l.dim(`${p} [${requestId}] Loading model...`)
        }
        if (text.includes('Generating video')) {
          l.dim(`${p} [${requestId}] Generating video...`)
        }
      })
      
      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString()
        errorOutput += text
        if (text.includes('Loading HunyuanVideo')) {
          l.dim(`${p} [${requestId}] ${text.trim()}`)
        }
        if (text.includes('Device:')) {
          l.dim(`${p} [${requestId}] ${text.trim()}`)
        }
        if (text.includes('Generating video')) {
          l.dim(`${p} [${requestId}] ${text.trim()}`)
        }
        if (text.includes('Using Diffusers')) {
          l.dim(`${p} [${requestId}] Using Diffusers pipeline`)
        }
        if (text.includes('CUDA out of memory')) {
          l.warn(`${p} [${requestId}] GPU memory issue. Try --use-cpu-offload or 540p resolution`)
        }
      })
      
      pythonProcess.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        
        if (code === 0) {
          try {
            const lines = output.trim().split('\n')
            const lastLine = lines[lines.length - 1]
            if (!lastLine) {
              throw new Error('No JSON output from script')
            }
            const result = JSON.parse(lastLine)
            
            if (result.success) {
              l.success(`${p} [${requestId}] Video generated in ${duration}s: ${result.path}`)
              if (result.note) {
                l.dim(`${p} [${requestId}] Note: ${result.note}`)
              }
              resolve({
                success: true,
                path: result.path,
                duration: parseFloat(duration)
              })
            } else {
              l.warn(`${p} [${requestId}] Generation failed: ${result.error}`)
              resolve({
                success: false,
                error: result.error,
                details: errorOutput
              })
            }
          } catch (parseError) {
            l.warn(`${p} [${requestId}] Failed to parse output: ${parseError}`)
            l.dim(`${p} [${requestId}] Output: ${output}`)
            l.dim(`${p} [${requestId}] Error output: ${errorOutput}`)
            resolve({
              success: false,
              error: 'Failed to parse generation output',
              details: `Output: ${output}\nError: ${errorOutput}`
            })
          }
        } else {
          l.warn(`${p} [${requestId}] Process exited with code ${code}`)
          l.dim(`${p} [${requestId}] Error output: ${errorOutput}`)
          resolve({
            success: false,
            error: `Process exited with code ${code}`,
            details: errorOutput || 'No error output'
          })
        }
      })
      
      pythonProcess.on('error', (error) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        l.warn(`${p} [${requestId}] Failed to start process in ${duration}s: ${error.message}`)
        resolve({
          success: false,
          error: `Failed to start Python process: ${error.message}`,
          details: error.stack
        })
      })
    })
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