import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { l } from '@/logging'
import { env } from '@/node-utils'

const p = '[image/image-services/sdcpp/setup]'

export async function checkAndRunSetup(modelType: string): Promise<boolean> {
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    l.dim(`${p} [${requestId}] Checking if setup is required for ${modelType}`)
    
    const binExists = existsSync('build/bin/sd')
    const modelsDir = 'build/models/sd'
    
    if (!binExists) {
      l.warn(`${p} [${requestId}] Binary not found, running sdcpp setup`)
      const binarySetupSuccess = await runSetupScript('sdcpp')
      if (!binarySetupSuccess) {
        return false
      }
    }
    
    if (modelType === 'sd1.5') {
      const sd15Exists = existsSync(join(modelsDir, 'v1-5-pruned-emaonly.safetensors'))
      if (!sd15Exists) {
        l.warn(`${p} [${requestId}] SD 1.5 model not found, downloading models`)
        return await runSetupScript('sd1')
      }
    } else if (modelType === 'sd3.5' || modelType === 'sd3-medium') {
      const sd3MediumExists = existsSync(join(modelsDir, 'sd3_medium_incl_clips_t5xxlfp16.safetensors'))
      const sd35LargeExists = existsSync(join(modelsDir, 'sd3.5_large.safetensors'))
      
      if (!sd3MediumExists && !sd35LargeExists) {
        l.warn(`${p} [${requestId}] SD3 models not found, checking access and downloading`)
        
        if (!env['HF_TOKEN'] && !env['HUGGING_FACE_HUB_TOKEN']) {
          l.warn(`${p} [${requestId}] No HuggingFace token found. SD3 models require authentication.`)
          l.warn(`${p} [${requestId}] Please set HF_TOKEN or HUGGING_FACE_HUB_TOKEN in your .env file`)
          return false
        }
        
        const success = await runSetupScript('sd3')
        if (!success) {
          return false
        }
        
        const sd3MediumExistsAfter = existsSync(join(modelsDir, 'sd3_medium_incl_clips_t5xxlfp16.safetensors'))
        const sd35LargeExistsAfter = existsSync(join(modelsDir, 'sd3.5_large.safetensors'))
        
        if (!sd3MediumExistsAfter && !sd35LargeExistsAfter) {
          l.warn(`${p} [${requestId}] SD3 models still not found after setup attempt`)
          l.warn(`${p} [${requestId}] This usually means you haven't been granted access yet`)
          l.warn(`${p} [${requestId}] Please visit and request access:`)
          l.warn(`${p} [${requestId}]   https://huggingface.co/stabilityai/stable-diffusion-3-medium`)
          l.warn(`${p} [${requestId}]   https://huggingface.co/stabilityai/stable-diffusion-3.5-large`)
          return false
        }
        
        return true
      }
    }
    
    l.dim(`${p} [${requestId}] All required components found, no setup needed`)
    return true
  } catch (error) {
    l.warn(`${p} [${requestId}] Setup check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

async function runSetupScript(setupType: 'sdcpp' | 'sd1' | 'sd3'): Promise<boolean> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const scriptMap = {
    'sdcpp': '.github/setup/image/sdcpp.sh',
    'sd1': '.github/setup/image/sd1_5.sh',
    'sd3': '.github/setup/image/sd3_5.sh'
  }
  
  const scriptPath = scriptMap[setupType]
  
  try {
    l.opts(`${p} [${requestId}] Running automatic setup: ${setupType}`)
    l.dim(`${p} [${requestId}] This may take a few minutes...`)
    
    const envWithToken = { ...process.env }
    if (env['HF_TOKEN']) {
      envWithToken['HF_TOKEN'] = env['HF_TOKEN']
    }
    if (env['HUGGING_FACE_HUB_TOKEN']) {
      envWithToken['HUGGING_FACE_HUB_TOKEN'] = env['HUGGING_FACE_HUB_TOKEN']
    }
    
    execSync(`bash ${scriptPath}`, {
      stdio: 'inherit',
      encoding: 'utf8',
      env: envWithToken
    })
    
    l.success(`${p} [${requestId}] Setup script completed`)
    
    if (setupType === 'sdcpp') {
      l.dim(`${p} [${requestId}] Binary installed, now checking for model requirements`)
    }
    
    return true
  } catch (error) {
    l.warn(`${p} [${requestId}] Setup script exited with error`)
    
    if (setupType === 'sd3') {
      l.warn(`${p} [${requestId}] SD3 setup failed - this usually means:`)
      l.warn(`${p} [${requestId}] 1. You haven't been granted access to the models yet`)
      l.warn(`${p} [${requestId}] 2. Your HF_TOKEN doesn't have the right permissions`)
      l.warn(`${p} [${requestId}] 3. Network issues prevented download`)
    }
    
    return false
  }
}

export function checkBinaryExists(): boolean {
  return existsSync('build/bin/sd')
}

export function checkModelExists(modelType: string): boolean {
  const modelsDir = 'build/models/sd'
  
  switch (modelType) {
    case 'sd1.5':
      return existsSync(join(modelsDir, 'v1-5-pruned-emaonly.safetensors'))
    case 'sd3.5':
    case 'sd3-medium':
      const sd3Medium = existsSync(join(modelsDir, 'sd3_medium_incl_clips_t5xxlfp16.safetensors'))
      const sd35Large = existsSync(join(modelsDir, 'sd3.5_large.safetensors'))
      return sd3Medium || sd35Large
    default:
      return false
  }
}

export async function ensureCompleteSetup(modelType: string): Promise<boolean> {
  const requestId = Math.random().toString(36).substring(2, 10)
  l.dim(`${p} [${requestId}] Ensuring complete setup for ${modelType}`)
  
  const binExists = checkBinaryExists()
  if (!binExists) {
    l.warn(`${p} [${requestId}] Binary missing, installing stable-diffusion.cpp`)
    const binarySuccess = await runSetupScript('sdcpp')
    if (!binarySuccess) {
      l.warn(`${p} [${requestId}] Failed to install stable-diffusion.cpp binary`)
      return false
    }
    
    if (!checkBinaryExists()) {
      l.warn(`${p} [${requestId}] Binary still not found after setup`)
      return false
    }
  }
  
  const modelExists = checkModelExists(modelType)
  if (!modelExists) {
    if (modelType === 'sd1.5') {
      l.warn(`${p} [${requestId}] SD 1.5 model missing, downloading`)
      const success = await runSetupScript('sd1')
      if (!success || !checkModelExists(modelType)) {
        l.warn(`${p} [${requestId}] Failed to download SD 1.5 model`)
        return false
      }
    } else if (modelType === 'sd3.5' || modelType === 'sd3-medium') {
      l.warn(`${p} [${requestId}] SD3 model missing, downloading`)
      
      if (!env['HF_TOKEN'] && !env['HUGGING_FACE_HUB_TOKEN']) {
        l.warn(`${p} [${requestId}] SD3 models require HuggingFace authentication`)
        l.warn(`${p} [${requestId}] 1. Visit https://huggingface.co/stabilityai/stable-diffusion-3.5-large`)
        l.warn(`${p} [${requestId}] 2. Request access and accept the license`)
        l.warn(`${p} [${requestId}] 3. Set HF_TOKEN in your .env file with your HuggingFace token`)
        return false
      }
      
      const success = await runSetupScript('sd3')
      if (!success || !checkModelExists(modelType)) {
        l.warn(`${p} [${requestId}] Failed to download SD3 models`)
        l.warn(`${p} [${requestId}] Please check:`)
        l.warn(`${p} [${requestId}] 1. You have requested and been granted access to the models`)
        l.warn(`${p} [${requestId}] 2. Your HF_TOKEN is valid and has the right permissions`)
        l.warn(`${p} [${requestId}] 3. Your internet connection is stable`)
        return false
      }
    }
  }
  
  l.dim(`${p} [${requestId}] Complete setup verified`)
  return true
}