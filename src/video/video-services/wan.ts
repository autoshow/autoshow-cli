import { spawn } from 'child_process'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError, ensureOutputDirectory } from '../video-utils.ts'
import { existsSync, readFileSync } from '@/node-utils'
import type { VideoGenerationResult, WanGenerateOptions } from '@/video/video-types.ts'

const p = '[video/video-services/wan]'

interface WanConfig {
  python: string
  venv: string
  models_dir: string
  repo_dir?: string
  default_model: string
  available_models: Record<string, string>
}

function loadWanConfig(): WanConfig | null {
  const configPath = 'models/wan/.wan-config.json'
  if (!existsSync(configPath)) {
    l.warn(`${p} Wan config not found at ${configPath}`)
    return null
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8')
    return JSON.parse(configContent) as WanConfig
  } catch (error) {
    l.warn(`${p} Failed to parse Wan config: ${isApiError(error) ? error.message : 'Unknown error'}`)
    return null
  }
}

function mapWanModelToPath(model: string, config: WanConfig): string | null {
  const modelKey = model.toLowerCase().replace('wan-', '')
  return config.available_models[modelKey] || null
}

function getResolutionForModel(model: string): { width: number; height: number } {
  if (model.includes('720p') || model === 'vace-14b' || model === 't2v-14b') {
    return { width: 1280, height: 720 }
  }
  return { width: 832, height: 480 }
}

export async function generateVideoWithWan(
  prompt: string,
  options: WanGenerateOptions = {}
): Promise<VideoGenerationResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('wan', 'mp4')
  
  try {
    const config = loadWanConfig()
    if (!config) {
      throw new Error('Wan2.1 not configured. Please run: bash .github/setup/video/wan.sh')
    }
    
    const model = options.model || 't2v-1.3b'
    const modelPath = mapWanModelToPath(model, config)
    
    if (!modelPath) {
      throw new Error(`Model ${model} not found in config. Available models: ${Object.keys(config.available_models).join(', ')}`)
    }
    
    if (!existsSync(modelPath)) {
      throw new Error(`Model path does not exist: ${modelPath}. Please download the model first.`)
    }
    
    l.opts(`${p} [${requestId}] Generating video with Wan2.1 model: ${model}`)
    l.dim(`${p} [${requestId}] Prompt: ${prompt}`)
    l.dim(`${p} [${requestId}] Model path: ${modelPath}`)
    
    const resolution = options.resolution || getResolutionForModel(model)
    const guidanceScale = options.guidanceScale || (model.includes('1.3b') ? 6.0 : 5.0)
    
    l.dim(`${p} [${requestId}] Resolution: ${resolution.width}x${resolution.height}`)
    l.dim(`${p} [${requestId}] Guidance scale: ${guidanceScale}`)
    
    ensureOutputDirectory(uniqueOutputPath)
    
    const pythonConfig = {
      model_path: modelPath,
      prompt: prompt,
      output_path: uniqueOutputPath,
      width: resolution.width,
      height: resolution.height,
      num_frames: options.numFrames || 81,
      guidance_scale: guidanceScale,
      negative_prompt: options.negativePrompt || '',
      num_inference_steps: model.includes('1.3b') ? 40 : 50
    }
    
    const scriptPath = `${config.models_dir}/wan_wrapper.py`
    if (!existsSync(scriptPath)) {
      throw new Error('Wan wrapper script not found. Please re-run: bash .github/setup/video/wan.sh')
    }
    
    l.dim(`${p} [${requestId}] Starting Python process...`)
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(config.python, [scriptPath, JSON.stringify(pythonConfig)], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      })
      
      let output = ''
      let errorOutput = ''
      
      pythonProcess.stdout.on('data', (data) => {
        const text = data.toString()
        output += text
        if (text.includes('Loading model')) {
          l.dim(`${p} [${requestId}] Loading model...`)
        }
        if (text.includes('Generating video')) {
          l.dim(`${p} [${requestId}] Generating video...`)
        }
      })
      
      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString()
        errorOutput += text
        if (text.includes('Loading model')) {
          l.dim(`${p} [${requestId}] ${text.trim()}`)
        }
        if (text.includes('Using device')) {
          l.dim(`${p} [${requestId}] ${text.trim()}`)
        }
        if (text.includes('Generating video')) {
          l.dim(`${p} [${requestId}] ${text.trim()}`)
        }
        if (text.includes('CUDA out of memory')) {
          l.warn(`${p} [${requestId}] GPU memory issue detected. Try using a smaller model.`)
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