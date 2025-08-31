import { spawn } from 'child_process'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError, ensureOutputDirectory } from '../video-utils.ts'
import { existsSync, readFileSync } from '@/node-utils'
import type { VideoGenerationResult, CogVideoGenerateOptions, CogVideoConfig } from '@/video/video-types.ts'

const p = '[video/video-services/cogvideo]'

function loadCogVideoConfig(): CogVideoConfig | null {
  const configPath = 'build/config/.cogvideo-config.json'
  l.dim(`${p} Loading config from: ${configPath}`)
  if (!existsSync(configPath)) {
    l.warn(`${p} CogVideoX config not found at ${configPath}`)
    return null
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configContent) as CogVideoConfig
    l.dim(`${p} Loaded CogVideoX config from ${configPath}`)
    return config
  } catch (error) {
    l.warn(`${p} Failed to parse CogVideoX config: ${isApiError(error) ? error.message : 'Unknown error'}`)
    return null
  }
}

export async function generateVideoWithCogVideo(
  prompt: string,
  options: CogVideoGenerateOptions = {}
): Promise<VideoGenerationResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('cogvideo', 'mp4')
  
  try {
    l.dim(`${p} [${requestId}] Loading CogVideoX configuration`)
    const config = loadCogVideoConfig()
    if (!config) {
      throw new Error('CogVideoX not configured. Please run: bash .github/setup/video/cogvideo.sh')
    }
    
    const model = options.model || 'cogvideo-2b'
    const modelId = config.available_models[model]
    
    if (!modelId) {
      throw new Error(`Model ${model} not found. Available: ${Object.keys(config.available_models).join(', ')}`)
    }
    
    l.opts(`${p} [${requestId}] Generating video with CogVideoX model: ${model}`)
    l.dim(`${p} [${requestId}] Prompt: ${prompt}`)
    l.dim(`${p} [${requestId}] Model ID: ${modelId}`)
    l.dim(`${p} [${requestId}] Output path: ${uniqueOutputPath}`)
    
    ensureOutputDirectory(uniqueOutputPath)
    
    const pythonScript = `
import sys
import os
import json
import traceback
import warnings
warnings.filterwarnings("ignore")

try:
    import torch
    print(f"PyTorch imported, version: {torch.__version__}", file=sys.stderr, flush=True)
    
    from diffusers import CogVideoXPipeline, CogVideoXImageToVideoPipeline
    print("Diffusers imported", file=sys.stderr, flush=True)
    
    from diffusers.utils import export_to_video
    print("Export utils imported", file=sys.stderr, flush=True)
    
except ImportError as e:
    print(f"Import error: {e}", file=sys.stderr, flush=True)
    print(json.dumps({"success": False, "error": f"Import error: {str(e)}"}), flush=True)
    sys.exit(1)

model_id = "${modelId}"
prompt = """${prompt.replace(/"/g, '\\"')}"""
output_path = "${uniqueOutputPath}"
num_frames = ${options.numFrames || 49}
guidance_scale = ${options.guidanceScale || 6.0}
num_inference_steps = ${options.numInferenceSteps || 50}
seed = ${options.seed || Math.floor(Math.random() * 1000000)}

try:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    use_mps = torch.backends.mps.is_available()
    
    if use_mps:
        print("MPS detected, using CPU mode for compatibility", file=sys.stderr, flush=True)
        device = "cpu"
        dtype = torch.float32
    elif device == "cuda":
        dtype = torch.float16
    else:
        dtype = torch.float32
    
    print(f"Device: {device}, dtype: {dtype}", file=sys.stderr, flush=True)
    print(f"Loading model from: {model_id}", file=sys.stderr, flush=True)
    
    if "I2V" in model_id:
        pipe = CogVideoXImageToVideoPipeline.from_pretrained(
            model_id,
            torch_dtype=dtype,
            cache_dir="build/models/cogvideo",
            use_safetensors=True,
            low_cpu_mem_usage=True
        )
    else:
        pipe = CogVideoXPipeline.from_pretrained(
            model_id,
            torch_dtype=dtype,
            cache_dir="build/models/cogvideo",
            use_safetensors=True,
            low_cpu_mem_usage=True
        )
    
    print("Model loaded", file=sys.stderr, flush=True)
    
    if device == "cuda":
        pipe = pipe.to(device)
        print("Enabling memory optimizations", file=sys.stderr, flush=True)
        pipe.enable_model_cpu_offload()
        pipe.vae.enable_slicing()
        pipe.vae.enable_tiling()
    
    print(f"Generating {num_frames} frames (this will take several minutes)", file=sys.stderr, flush=True)
    
    generator = torch.Generator(device="cpu").manual_seed(seed)
    
    with torch.no_grad():
        video = pipe(
            prompt=prompt,
            num_videos_per_prompt=1,
            num_frames=num_frames,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            generator=generator
        ).frames[0]
    
    print(f"Generation complete, saving to: {output_path}", file=sys.stderr, flush=True)
    
    try:
        export_to_video(video, output_path, fps=8)
        print(f"Video saved successfully", file=sys.stderr, flush=True)
        
        if not os.path.exists(output_path):
            raise Exception("Video file was not created")
        
        file_size = os.path.getsize(output_path)
        if file_size == 0:
            raise Exception("Video file is empty")
        
        print(f"Video file size: {file_size} bytes", file=sys.stderr, flush=True)
        
    except Exception as export_error:
        print(f"Export error: {export_error}", file=sys.stderr, flush=True)
        print(f"Attempting alternative save method", file=sys.stderr, flush=True)
        
        import numpy as np
        import imageio
        
        video_np = video.cpu().numpy()
        video_np = (video_np * 255).astype(np.uint8)
        
        with imageio.get_writer(output_path, fps=8) as writer:
            for frame in video_np:
                writer.append_data(frame)
        
        print(f"Video saved using alternative method", file=sys.stderr, flush=True)
    
    if os.path.exists(output_path):
        file_size = os.path.getsize(output_path)
        print(json.dumps({"success": True, "path": output_path, "size": file_size}), flush=True)
    else:
        print(json.dumps({"success": False, "error": "Failed to save video file"}), flush=True)
    
except Exception as e:
    error_msg = str(e)
    print(f"Error occurred: {error_msg}", file=sys.stderr, flush=True)
    print(f"Traceback: {traceback.format_exc()}", file=sys.stderr, flush=True)
    
    if "out of memory" in error_msg.lower():
        error_msg = "Out of memory. Try reducing frames or steps"
    elif "float64" in error_msg:
        error_msg = "MPS compatibility issue. Running on CPU instead."
    
    print(json.dumps({"success": False, "error": error_msg}), flush=True)
    sys.exit(1)

sys.exit(0)
`
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(config.python, ['-c', pythonScript], {
        env: { 
          ...process.env, 
          PYTHONUNBUFFERED: '1',
          HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
          PYTORCH_ENABLE_MPS_FALLBACK: '1',
          PYTORCH_MPS_HIGH_WATERMARK_RATIO: '0.0'
        }
      })
      
      let output = ''
      let errorOutput = ''
      let lastError = ''
      let hasResult = false
      
      pythonProcess.stdout.on('data', (data) => {
        const text = data.toString()
        output += text
        
        if (text.includes('{"success":')) {
          hasResult = true
          l.dim(`${p} [${requestId}] Received result JSON`)
        }
      })
      
      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString()
        errorOutput += text
        
        if (text.includes('Error') || text.includes('error')) {
          lastError = text
          if (!text.includes('deprecated') && !text.includes('UserWarning')) {
            l.warn(`${p} [${requestId}] ${text.trim()}`)
          }
        } else if (text.includes('MPS detected')) {
          l.dim(`${p} [${requestId}] Running on CPU for Mac compatibility`)
        } else if (text.includes('Loading model')) {
          l.dim(`${p} [${requestId}] Loading model...`)
        } else if (text.includes('Model loaded')) {
          l.dim(`${p} [${requestId}] Model ready`)
        } else if (text.includes('Generating')) {
          l.dim(`${p} [${requestId}] Generating video (this may take several hours on CPU)...`)
        } else if (text.includes('Generation complete')) {
          l.success(`${p} [${requestId}] Video generation complete!`)
        } else if (text.includes('Video saved')) {
          l.success(`${p} [${requestId}] Video saved successfully`)
        } else if (text.includes('file size:')) {
          l.dim(`${p} [${requestId}] ${text.trim()}`)
        } else if (!text.includes('deprecated') && !text.includes('torch_dtype') && !text.includes('UserWarning') && !text.includes('resource_tracker')) {
          l.dim(`${p} [${requestId}] ${text.trim()}`)
        }
      })
      
      pythonProcess.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        l.dim(`${p} [${requestId}] Process exited with code: ${code}`)
        
        if (hasResult) {
          try {
            const jsonMatch = output.match(/\{"success":[^}]+\}/g)
            if (jsonMatch && jsonMatch.length > 0) {
              const lastJson = jsonMatch[jsonMatch.length - 1]
              const result = JSON.parse(lastJson)
              
              if (result.success) {
                l.success(`${p} [${requestId}] Video generated in ${duration}s: ${result.path}`)
                if (result.size) {
                  l.dim(`${p} [${requestId}] File size: ${(result.size / 1024 / 1024).toFixed(2)} MB`)
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
              return
            }
          } catch (parseError) {
            l.warn(`${p} [${requestId}] Failed to parse JSON result: ${parseError}`)
          }
        }
        
        if (code === 0 && existsSync(uniqueOutputPath)) {
          l.success(`${p} [${requestId}] Video file exists at: ${uniqueOutputPath}`)
          resolve({
            success: true,
            path: uniqueOutputPath,
            duration: parseFloat(duration)
          })
        } else {
          l.warn(`${p} [${requestId}] Process failed or video not found`)
          resolve({
            success: false,
            error: lastError || `Process exited with code ${code}`,
            details: errorOutput
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